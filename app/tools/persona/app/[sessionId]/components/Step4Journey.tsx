'use client'

// Step 4: カスタマージャーニー（全ペルソナ集約ビュー）
// タブで1人ずつではなく、全ペルソナを一画面に集約：感情グラフ重ね描き＋(stage,name)集約のタッチポイント候補プール。
// 表示フィルタ（全員/単体ペルソナ・感情）で3パネル（グラフ/プール/詳細）が連動。ジャーニーはペルソナごとに保持。
import { useState, useCallback, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ArrowLeft, ArrowRight, WandSparkles, Plus, Trash2, X } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { type Persona, type BasicInfo, type JourneyStage } from './persona-types'

interface Step4Props {
  personas: Persona[]
  basicInfo: BasicInfo
  onNext: (personas: Persona[]) => Promise<boolean>
  onBack: () => void
  onSaveField: (personas: Persona[]) => Promise<void>
}

// ペルソナ識別色（Layer3＝項目の区別。ds-app-accentではなくこのパレット）
const PERSONA_COLORS = [
  { name: 'violet', solid: '#7c3aed', soft: '#ede9fe' },
  { name: 'teal', solid: '#0891b2', soft: '#cffafe' },
  { name: 'rose', solid: '#db2777', soft: '#fce7f3' },
  { name: 'amber', solid: '#d97706', soft: '#fef3c7' },
  { name: 'emerald', solid: '#059669', soft: '#d1fae5' },
]
const pColor = (idx: number) => PERSONA_COLORS[idx % PERSONA_COLORS.length]
const personaLabel = (p: Persona, i: number) =>
  p.demographics.persona_name?.trim() || p.target_name?.trim() || `ペルソナ${i + 1}`
const normTp = (s: string) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ')

type SortMode = 'priority' | 'stage' | 'coverage'
type Tier = 'High' | 'Mid' | 'Low'

type PersonaTouch = {
  idx: number; name: string; color: string
  emotion_score: number; pain_points: string[]; opportunities: string[]
}
type TouchpointRow = {
  name: string; stage: string; stageIdx: number
  personas: PersonaTouch[]; priority: Tier; avgEmotion: number
}

const TIER_DOT: Record<Tier, string> = { High: 'bg-red-500', Mid: 'bg-amber-500', Low: 'bg-muted-foreground' }
const TIER_RANK: Record<Tier, number> = { High: 0, Mid: 1, Low: 2 }

// 相対優先度: このジャーニー内の感情レンジで「最も低い×広く接触」を High、最も高いを Low に振る。
// AIの感情カーブは粗く（-1/0/1/2 等）全ペルソナで同一になりがちで、絶対しきい値だと
// 「全部High」か「Highゼロ」に振れる。レンジ正規化＋カバー人数ゲートで常に健全な分布を出す。
// rows を破壊的に更新（row.priority をセット）。
function assignPriorities(rows: TouchpointRow[]): void {
  if (rows.length === 0) return
  const avgs = rows.map(r => r.avgEmotion)
  const minA = Math.min(...avgs)
  const maxA = Math.max(...avgs)
  const range = maxA - minA
  for (const r of rows) {
    const cov = r.personas.length
    // t: 0=このジャーニーで最も感情が低い … 1=最も高い（rangeが0なら全行同点→0扱い）
    const t = range > 0 ? (r.avgEmotion - minA) / range : 0
    let tier: Tier
    if (t <= 0.2) tier = 'High'        // 最低感情帯（痛点）
    else if (t <= 0.7) tier = 'Mid'
    else tier = 'Low'                  // 最高感情帯（満足）
    // カバー人数ゲート: 1人しか通らない接点は High まで上げない（広さが優先度の条件）
    if (cov === 1 && tier === 'High') tier = 'Mid'
    r.priority = tier
  }
}
export function Step4Journey({ personas: initialPersonas, basicInfo, onNext, onBack, onSaveField }: Step4Props) {
  const [data, setData] = useState<Persona[]>(initialPersonas)
  const [filterIdx, setFilterIdx] = useState<number | 'all'>('all')
  const [coverageOnly, setCoverageOnly] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('priority')
  const [aiLoading, setAiLoading] = useState<Record<number, boolean>>({})
  const [aiError, setAiError] = useState<Record<number, string>>({})
  const [bulkLoading, setBulkLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerAutoSave = useCallback((p: Persona[]) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { onSaveField(p) }, 1000)
  }, [onSaveField])
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const commit = useCallback((next: Persona[]) => { setData(next); triggerAutoSave(next) }, [triggerAutoSave])

  // 共通: 特定ペルソナの stage を書き換え
  const mutateStage = (personaIdx: number, stageIdx: number, mut: (s: JourneyStage) => JourneyStage) => {
    commit(data.map((p, pi) => {
      if (pi !== personaIdx) return p
      const stages = (p.journey_map?.stages || []).map((s, si) => (si === stageIdx ? mut(s) : s))
      return { ...p, journey_map: { stages } }
    }))
  }

  // AI生成（ペルソナ別）
  const fetchAI = useCallback(async (idx: number, current: Persona[]): Promise<Persona[]> => {
    const p = current[idx]
    if (!p) return current
    setAiLoading(s => ({ ...s, [idx]: true })); setAiError(s => ({ ...s, [idx]: '' }))
    try {
      const res = await fetch('/api/tools/persona/suggest-journey', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basic_info: basicInfo, demographics: p.demographics, goals: p.goals }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'AI提案の取得に失敗しました') }
      const { journey } = await res.json()
      const stages: JourneyStage[] = journey?.stages || []
      return current.map((pp, i) => (i === idx ? { ...pp, journey_map: { stages } } : pp))
    } catch (err) {
      setAiError(s => ({ ...s, [idx]: err instanceof Error ? err.message : 'エラーが発生しました' }))
      return current
    } finally {
      setAiLoading(s => ({ ...s, [idx]: false }))
    }
  }, [basicInfo])

  const generateOne = async (idx: number) => { const next = await fetchAI(idx, data); commit(next) }
  const handleGenerateClick = (idx: number) => {
    if ((data[idx]?.journey_map?.stages?.length || 0) > 0) { setConfirmIdx(idx); return }
    generateOne(idx)
  }
  // 全ペルソナ一括（直列）
  const generateAll = async () => {
    setBulkLoading(true)
    let acc = data
    for (let i = 0; i < acc.length; i++) acc = await fetchAI(i, acc)
    commit(acc); setBulkLoading(false)
  }

  const handleNext = async () => {
    setSaving(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const ok = await onNext(data); if (!ok) setSaving(false)
  }

  if (data.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Step 4: カスタマージャーニー</h1>
        <p className="text-[14px] text-muted-foreground">先にペルソナを作成してください（Step2）。</p>
        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex items-center justify-between">
          <Button variant="outline" onClick={onBack} className="gap-1"><ArrowLeft className="h-4 w-4" /> 戻る</Button>
          <Button onClick={handleNext} disabled={saving} className="gap-1">確認・出力へ <ArrowRight className="h-4 w-4" /></Button>
        </div>
      </div>
    )
  }

  // スコープ内ペルソナ（グラフ重ね描き用）
  const scopeIdxs = filterIdx === 'all' ? data.map((_, i) => i) : [filterIdx]
  // 標準ステージ（生成済みペルソナの最大ステージ集合）
  const baseStages = (data.find(p => (p.journey_map?.stages?.length || 0) > 0)?.journey_map?.stages) || []
  const stageNames = baseStages.map(s => s.name)

  // 集約（全データ）→ スコープ/感情/カバレッジでフィルタ
  const aggregate = (): TouchpointRow[] => {
    const map = new Map<string, TouchpointRow>()
    data.forEach((p, idx) => {
      (p.journey_map?.stages || []).forEach((stage, stageIdx) => {
        (stage.touchpoints || []).forEach(tpRaw => {
          const tp = (tpRaw || '').trim(); if (!tp) return
          const key = `${stageIdx}::${normTp(tp)}`
          const entry: PersonaTouch = {
            idx, name: personaLabel(p, idx), color: pColor(idx).solid,
            emotion_score: stage.emotion_score ?? 0, pain_points: stage.pain_points || [], opportunities: stage.opportunities || [],
          }
          const ex = map.get(key)
          if (ex) ex.personas.push(entry)
          else map.set(key, { name: tp, stage: stage.name, stageIdx, personas: [entry], priority: 'Low', avgEmotion: 0 })
        })
      })
    })
    return Array.from(map.values()).map(r => {
      const avg = r.personas.reduce((s, x) => s + x.emotion_score, 0) / r.personas.length
      return { ...r, avgEmotion: avg } // priority は assignPriorities で後付け
    })
  }

  let rows = aggregate()
  const totalPersonaCount = data.length
  if (filterIdx !== 'all') {
    rows = rows
      .filter(r => r.personas.some(pe => pe.idx === filterIdx))
      .map(r => {
        const personas = r.personas.filter(pe => pe.idx === filterIdx)
        const avg = personas[0]?.emotion_score ?? 0
        return { ...r, personas, avgEmotion: avg }
      })
  }
  // 相対優先度はスコープ内の全行に対して算出（表示フィルタの前＝フィルタしても tier がぶれない）
  assignPriorities(rows)
  if (coverageOnly) rows = rows.filter(r => r.personas.length === totalPersonaCount && totalPersonaCount > 1)
  rows = [...rows].sort((a, b) => {
    if (sortMode === 'stage') return a.stageIdx - b.stageIdx
    if (sortMode === 'coverage') return b.personas.length - a.personas.length
    return TIER_RANK[a.priority] - TIER_RANK[b.priority]
  })

  const anyLoading = bulkLoading || Object.values(aiLoading).some(Boolean)

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Step 4: カスタマージャーニー</h1>
      <p className="mb-5 text-[14px] text-muted-foreground">
        ブランド施策を当てる「タッチポイント」を全ペルソナ横断で洗い出します。感情カーブは優先度の注釈です。
      </p>

      {/* A. ペルソナ一覧＋AI生成 */}
      <Card className="bg-card border shadow-none mb-4">
        <CardContent>
          <h2 className="text-sm font-bold text-foreground mb-3">ペルソナ</h2>
          <div className="space-y-2">
            {data.map((p, i) => {
              const has = (p.journey_map?.stages?.length || 0) > 0
              return (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: pColor(i).solid }} />
                    <span className="text-[14px] font-medium text-foreground truncate">{personaLabel(p, i)}</span>
                    <span className="text-[13px] text-muted-foreground shrink-0">{has ? `(${p.journey_map!.stages.length}ステージ生成済み)` : '(未生成)'}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleGenerateClick(i)} disabled={anyLoading} className="gap-1.5 shrink-0">
                    <WandSparkles className="h-4 w-4" />{aiLoading[i] ? '生成中...' : has ? 'ジャーニーを再生成' : 'ジャーニーを生成'}
                  </Button>
                </div>
              )
            })}
          </div>
          {data.length > 1 && (
            <Button variant="outline" size="sm" onClick={generateAll} disabled={anyLoading} className="mt-3 gap-1.5">
              <WandSparkles className="h-4 w-4" />{bulkLoading ? '一括生成中...' : '全ペルソナを一括生成'}
            </Button>
          )}
          {Object.entries(aiError).filter(([, v]) => v).map(([k, v]) => (
            <p key={k} className="mt-2 text-[13px] text-red-600">ペルソナ{Number(k) + 1}: {v}</p>
          ))}
        </CardContent>
      </Card>

      {/* B. 表示フィルタ */}
      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-muted-foreground">表示ペルソナ：</span>
          <FilterChip active={filterIdx === 'all'} onClick={() => setFilterIdx('all')}>全員</FilterChip>
          {data.map((p, i) => (
            <FilterChip key={i} active={filterIdx === i} onClick={() => setFilterIdx(i)} dot={pColor(i).solid}>{personaLabel(p, i)}</FilterChip>
          ))}
        </div>
        {filterIdx !== 'all' && (
          <p className="text-[13px] text-muted-foreground">
            「{personaLabel(data[filterIdx], filterIdx)}」のジャーニーを表示中
            <button onClick={() => setFilterIdx('all')} className="ml-2 underline hover:no-underline">全員に戻る</button>
          </p>
        )}
      </div>

      {baseStages.length === 0 ? (
        <Card className="bg-card border shadow-none">
          <CardContent><p className="text-[14px] text-muted-foreground">まだジャーニーがありません。上の各ペルソナの「AI生成」を押してください。</p></CardContent>
        </Card>
      ) : (
        <>
          {/* C. 感情グラフ（重ね描き） */}
          <Card className="bg-card border shadow-none mb-4">
            <CardContent>
              <h2 className="text-sm font-bold text-foreground mb-3">感情カーブ（優先度の注釈）</h2>
              <div className="mb-2 flex flex-wrap gap-3">
                {scopeIdxs.map(i => (
                  <span key={i} className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pColor(i).solid }} />{personaLabel(data[i], i)}
                  </span>
                ))}
              </div>
              <EmotionGraph personasInScope={scopeIdxs.map(i => ({ idx: i, stages: data[i].journey_map?.stages || [] }))} stageNames={stageNames} />
            </CardContent>
          </Card>

          {/* E. ステージ詳細（ペルソナ別サブタブ・感情カーブの編集元） */}
          <Card className="bg-card border shadow-none mb-4">
            <CardContent>
              <h2 className="text-sm font-bold text-foreground mb-2">ステージ詳細</h2>
              <Accordion type="multiple" className="w-full">
                {stageNames.map((sName, stageIdx) => {
                  const members = scopeIdxs.filter(i => (data[i].journey_map?.stages?.[stageIdx]))
                  const avg = members.length ? members.reduce((s, i) => s + (data[i].journey_map!.stages[stageIdx].emotion_score ?? 0), 0) / members.length : 0
                  return (
                    <AccordionItem key={stageIdx} value={`stage-${stageIdx}`}>
                      <AccordionTrigger className="text-[14px]">
                        <span className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${avg < 0 ? 'bg-red-500' : avg === 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                          {stageIdx + 1} {sName}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        {members.length === 0 ? (
                          <p className="text-[13px] text-muted-foreground">このステージのデータがありません。</p>
                        ) : (
                          <Tabs defaultValue={String(members[0])} className="w-full">
                            <TabsList className="flex-wrap h-auto">
                              {members.map(i => <TabsTrigger key={i} value={String(i)} className="text-[13px]">{personaLabel(data[i], i)}</TabsTrigger>)}
                            </TabsList>
                            {members.map(i => (
                              <TabsContent key={i} value={String(i)}>
                                <StageDetail stage={data[i].journey_map!.stages[stageIdx]} onChange={(patch) => mutateStage(i, stageIdx, (s) => ({ ...s, ...patch }))} />
                              </TabsContent>
                            ))}
                          </Tabs>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
              </Accordion>
            </CardContent>
          </Card>

          {/* D. タッチポイント候補プール */}
          <Card className="bg-card border shadow-none mb-4">
            <CardContent>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-foreground">タッチポイント候補プール</h2>
                <Button variant="outline" size="sm" onClick={() => setAddOpen(o => !o)} className="gap-1.5"><Plus className="h-4 w-4" /> タッチポイントを手動追加</Button>
              </div>

              <div className="mb-3 flex flex-wrap gap-1.5">
                {(['priority', 'stage', 'coverage'] as SortMode[]).map(m => (
                  <FilterChip key={m} active={sortMode === m} onClick={() => setSortMode(m)}>
                    {m === 'priority' ? '優先度順' : m === 'stage' ? 'ステージ順' : 'カバー人数順'}
                  </FilterChip>
                ))}
                {totalPersonaCount > 1 && (
                  <FilterChip active={coverageOnly} onClick={() => setCoverageOnly(v => !v)}>全ペルソナ接触のみ</FilterChip>
                )}
              </div>

              {addOpen && (
                <AddTouchpointPanel
                  data={data} stageNames={stageNames}
                  onAdd={(stageIdx, name, personaIdxs) => {
                    commit(data.map((p, pi) => {
                      if (!personaIdxs.includes(pi)) return p
                      const stages = (p.journey_map?.stages || [])
                      if (!stages[stageIdx]) return p
                      const next = stages.map((s, si) => si === stageIdx ? { ...s, touchpoints: [...(s.touchpoints || []), name] } : s)
                      return { ...p, journey_map: { stages: next } }
                    }))
                    setAddOpen(false)
                  }}
                  onCancel={() => setAddOpen(false)}
                />
              )}

              {rows.length === 0 ? (
                <p className="text-[14px] text-muted-foreground">条件に合うタッチポイントがありません。</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[14px] border-collapse">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">優先度</th>
                        <th className="py-2 pr-3 font-medium">タッチポイント</th>
                        <th className="py-2 pr-3 font-medium">ステージ</th>
                        <th className="py-2 pr-3 font-medium">接触ペルソナ</th>
                        <th className="py-2 pr-3 font-medium">施策の機会</th>
                        <th className="py-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={`${r.stageIdx}-${normTp(r.name)}`} className="border-b border-border/60 align-top">
                          <td className="py-2 pr-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${TIER_DOT[r.priority]}`} />{r.priority}</span>
                          </td>
                          <td className="py-2 pr-3 min-w-44">
                            <Input value={r.name} onChange={(e) => renameTouchpoint(data, commit, r.stageIdx, r.name, e.target.value)} className="h-8" />
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{r.stageIdx + 1} {r.stage}</td>
                          <td className="py-2 pr-3">
                            <div className="flex flex-wrap gap-1">
                              {r.personas.map(pe => (
                                <button key={pe.idx} onClick={() => removePersonaFromTp(data, commit, pe.idx, r.stageIdx, r.name)}
                                  title="クリックでこのペルソナを外す"
                                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px]"
                                  style={{ backgroundColor: pColor(pe.idx).soft, color: pColor(pe.idx).solid }}>
                                  {pe.name}
                                  <span className={`h-1.5 w-1.5 rounded-full ${pe.emotion_score < 0 ? 'bg-red-500' : pe.emotion_score === 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                  <X className="h-3 w-3" />
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="py-2 pr-3 text-muted-foreground min-w-40">
                            {[...new Set(r.personas.flatMap(pe => pe.opportunities))].slice(0, 2).join(' / ') || '—'}
                          </td>
                          <td className="py-2">
                            <Button type="button" variant="outline" size="icon"
                              onClick={() => deleteTouchpoint(data, commit, r.stageIdx, r.name)}
                              className="size-8 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
                              <Trash2 size={14} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="gap-1"><ArrowLeft className="h-4 w-4" /> 戻る</Button>
        <Button onClick={handleNext} disabled={saving} className="gap-1">{saving ? '保存中...' : '確認・出力へ'}{!saving && <ArrowRight className="h-4 w-4" />}</Button>
      </div>

      <AlertDialog open={confirmIdx !== null} onOpenChange={(o) => !o && setConfirmIdx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認</AlertDialogTitle>
            <AlertDialogDescription>このペルソナの現在のジャーニーが上書きされます。よろしいですか？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmIdx !== null) generateOne(confirmIdx); setConfirmIdx(null) }}>再生成する</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ===== タッチポイント操作（全ペルソナ横断） =====
function renameTouchpoint(data: Persona[], commit: (p: Persona[]) => void, stageIdx: number, oldName: string, newName: string) {
  const key = normTp(oldName)
  commit(data.map(p => {
    const stages = p.journey_map?.stages; if (!stages?.[stageIdx]) return p
    const next = stages.map((s, si) => si === stageIdx ? { ...s, touchpoints: (s.touchpoints || []).map(t => normTp(t) === key ? newName : t) } : s)
    return { ...p, journey_map: { stages: next } }
  }))
}
function deleteTouchpoint(data: Persona[], commit: (p: Persona[]) => void, stageIdx: number, name: string) {
  const key = normTp(name)
  commit(data.map(p => {
    const stages = p.journey_map?.stages; if (!stages?.[stageIdx]) return p
    const next = stages.map((s, si) => si === stageIdx ? { ...s, touchpoints: (s.touchpoints || []).filter(t => normTp(t) !== key) } : s)
    return { ...p, journey_map: { stages: next } }
  }))
}
function removePersonaFromTp(data: Persona[], commit: (p: Persona[]) => void, personaIdx: number, stageIdx: number, name: string) {
  const key = normTp(name)
  commit(data.map((p, pi) => {
    if (pi !== personaIdx) return p
    const stages = p.journey_map?.stages; if (!stages?.[stageIdx]) return p
    let removed = false
    const next = stages.map((s, si) => {
      if (si !== stageIdx) return s
      return { ...s, touchpoints: (s.touchpoints || []).filter(t => { if (!removed && normTp(t) === key) { removed = true; return false } return true }) }
    })
    return { ...p, journey_map: { stages: next } }
  }))
}

// ===== サブコンポーネント =====
function FilterChip({ active, onClick, dot, children }: { active: boolean; onClick: () => void; dot?: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 min-h-8 rounded-full border px-3 text-[13px] transition-colors ${
        active ? 'border-ds-app-accent bg-ds-app-accent text-white' : 'border-border bg-card text-muted-foreground hover:border-ds-app-accent'}`}>
      {dot && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dot }} />}{children}
    </button>
  )
}

function EmotionGraph({ personasInScope, stageNames }: { personasInScope: Array<{ idx: number; stages: JourneyStage[] }>; stageNames: string[] }) {
  const W = 520, H = 160, padL = 28, padR = 16, padT = 16, padB = 30
  const n = stageNames.length
  const innerW = W - padL - padR
  const x = (i: number) => (n > 1 ? padL + (innerW * i) / (n - 1) : padL + innerW / 2)
  const y = (score: number) => (padT + ((2 - score) / 4) * (H - padT - padB))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="感情カーブ">
      {[2, 0, -2].map(sc => (
        <g key={sc}>
          <line x1={padL} y1={y(sc)} x2={W - padR} y2={y(sc)} stroke="currentColor" className="text-border" strokeWidth={1} />
          <text x={2} y={y(sc) + 4} className="fill-muted-foreground" fontSize={10}>{sc === 2 ? '満足' : sc === 0 ? '普通' : '不満'}</text>
        </g>
      ))}
      {personasInScope.map(({ idx, stages }) => {
        if (!stages.length) return null
        const pts = stageNames.map((_, i) => `${x(i)},${y(stages[i]?.emotion_score ?? 0)}`).join(' ')
        const col = PERSONA_COLORS[idx % PERSONA_COLORS.length].solid
        return (
          <g key={idx}>
            <polyline points={pts} fill="none" stroke={col} strokeWidth={2} strokeOpacity={0.85} />
            {stageNames.map((_, i) => <circle key={i} cx={x(i)} cy={y(stages[i]?.emotion_score ?? 0)} r={3.5} fill={col} fillOpacity={0.85} />)}
          </g>
        )
      })}
      {stageNames.map((sName, i) => <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>{sName}</text>)}
    </svg>
  )
}

function StageDetail({ stage, onChange }: { stage: JourneyStage; onChange: (patch: Partial<JourneyStage>) => void }) {
  const listEdit = (key: 'pain_points' | 'opportunities', label: string) => (
    <div>
      <label className="text-[13px] font-medium text-muted-foreground mb-1 block">{label}</label>
      <div className="space-y-2">
        {(stage[key] || []).map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input value={item} onChange={(e) => onChange({ [key]: stage[key].map((v, vi) => vi === i ? e.target.value : v) } as Partial<JourneyStage>)} className="h-8 flex-1" />
            <button onClick={() => onChange({ [key]: stage[key].filter((_, vi) => vi !== i) } as Partial<JourneyStage>)} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => onChange({ [key]: [...(stage[key] || []), ''] } as Partial<JourneyStage>)} className="gap-1"><Plus className="h-3 w-3" /> 追加</Button>
      </div>
    </div>
  )
  return (
    <div className="space-y-4 pt-1">
      <div>
        <label className="text-[13px] font-medium text-muted-foreground mb-1 block">説明</label>
        <Textarea value={stage.description} onChange={(e) => onChange({ description: e.target.value })} rows={2} className="text-[14px]" />
      </div>
      <div>
        <label className="text-[13px] font-medium text-muted-foreground mb-1 block">感情（心情）</label>
        <Textarea value={stage.emotions} onChange={(e) => onChange({ emotions: e.target.value })} rows={2} className="text-[14px]" />
      </div>
      {listEdit('pain_points', '課題（pain points）')}
      {listEdit('opportunities', '提供価値・施策機会（opportunities）')}
    </div>
  )
}

function AddTouchpointPanel({ data, stageNames, onAdd, onCancel }: {
  data: Persona[]; stageNames: string[]
  onAdd: (stageIdx: number, name: string, personaIdxs: number[]) => void
  onCancel: () => void
}) {
  const [stageIdx, setStageIdx] = useState(0)
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<number[]>(data.map((_, i) => i).filter(i => (data[i].journey_map?.stages?.length || 0) > 0))
  const toggle = (i: number) => setPicked(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])
  const eligible = data.map((_, i) => i).filter(i => (data[i].journey_map?.stages?.[stageIdx]))
  return (
    <div className="mb-3 rounded-lg border border-border bg-muted/30 p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={stageIdx} onChange={(e) => setStageIdx(Number(e.target.value))} className="h-9 rounded-md border border-border bg-card px-2 text-[14px]">
          {stageNames.map((s, i) => <option key={i} value={i}>{i + 1} {s}</option>)}
        </select>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="タッチポイント名（例: 料金ページ閲覧）" className="h-9 flex-1 min-w-44" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {eligible.map(i => (
          <button key={i} onClick={() => toggle(i)}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[13px] ${picked.includes(i) ? 'border-transparent text-white' : 'border-border text-muted-foreground'}`}
            style={picked.includes(i) ? { backgroundColor: pColor(i).solid } : undefined}>
            {personaLabel(data[i], i)}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={!name.trim() || picked.filter(i => eligible.includes(i)).length === 0}
          onClick={() => onAdd(stageIdx, name.trim(), picked.filter(i => eligible.includes(i)))}>追加</Button>
        <Button size="sm" variant="outline" onClick={onCancel}>キャンセル</Button>
      </div>
    </div>
  )
}
