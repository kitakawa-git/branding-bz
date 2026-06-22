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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ArrowLeft, ArrowRight, WandSparkles, Plus, Trash2, X, ChevronDown, ChevronRight } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
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

const TIER_RANK: Record<Tier, number> = { High: 0, Mid: 1, Low: 2 }

// 優先度ティア配色（Layer3 ティア配色：ds-app-accent系は使わず red/amber/gray 直書き）
const PRIORITY_STYLES: Record<Tier, { bar: string; badgeBg: string; text: string; label: string }> = {
  High: { bar: 'bg-red-500', badgeBg: 'bg-red-500', text: 'text-red-600', label: '優先度高（全員カバー＋感情低い）' },
  Mid: { bar: 'bg-amber-500', badgeBg: 'bg-amber-500', text: 'text-amber-600', label: '優先度中' },
  Low: { bar: 'bg-gray-400', badgeBg: 'bg-gray-400', text: 'text-gray-500', label: '優先度低' },
}

// ペルソナ名の短縮（コンパクト行に収めるため。括弧以降を落として先頭6文字）
function shortenPersonaName(name: string): string {
  return name.replace(/[（(].*$/, '').slice(0, 6)
}
// 感情ドット色（emotion_score: -2〜2）
function emoColor(score: number): string {
  if (score <= -1) return 'bg-red-500'
  if (score <= 0) return 'bg-amber-500'
  if (score <= 1) return 'bg-gray-400'
  return 'bg-emerald-500'
}
function emoLabel(score: number): string {
  if (score <= -2) return '不満'
  if (score <= -1) return 'もやもや'
  if (score <= 0) return '普通'
  if (score <= 1) return 'ポジ'
  return '満足'
}
// 施策メモ（opportunities + pain_points を重複除去して上位3件）
function buildOpportunityText(r: TouchpointRow): string {
  return [...r.personas.flatMap(p => p.opportunities), ...r.personas.flatMap(p => p.pain_points)]
    .map(v => (v || '').trim())
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .slice(0, 3)
    .join(' / ')
}

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
  const [showLow, setShowLow] = useState(false)
  const [selectedStageIdx, setSelectedStageIdx] = useState<number>(0) // 統合パネル：選択中ステージ

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
              <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                {scopeIdxs.map(i => (
                  <span key={i} className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                    <span className="inline-block h-[3px] w-[18px] rounded-full" style={{ backgroundColor: pColor(i).solid }} />{personaLabel(data[i], i)}
                  </span>
                ))}
              </div>
              <EmotionGraph
                personasInScope={scopeIdxs.map(i => ({ idx: i, name: personaLabel(data[i], i), color: pColor(i).solid, stages: data[i].journey_map?.stages || [] }))}
                stageNames={stageNames}
                selectedStageIdx={selectedStageIdx}
                onSelectStage={setSelectedStageIdx}
              />

              {/* 統合：選択中ステージの詳細パネル（旧ステージ詳細Accordionを移行） */}
              {(() => {
                const sName = stageNames[selectedStageIdx]
                if (sName == null) return null
                const members = scopeIdxs.filter(i => (data[i].journey_map?.stages?.[selectedStageIdx]))
                const avg = members.length ? members.reduce((s, i) => s + (data[i].journey_map!.stages[selectedStageIdx].emotion_score ?? 0), 0) / members.length : 0
                return (
                  <div key={`${selectedStageIdx}-${filterIdx}`} className="mt-4 rounded-lg border border-border bg-muted/40 p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Stage {selectedStageIdx + 1}</span>
                      <span className="text-sm font-bold text-foreground">{sName}</span>
                      <span className="ml-auto text-[12px] text-muted-foreground">avg {(avg + 3).toFixed(1)}</span>
                    </div>
                    {members.length === 0 ? (
                      <p className="text-[13px] text-muted-foreground">このステージのデータがありません。</p>
                    ) : (
                      <Tabs defaultValue={String(members[0])} className="w-full">
                        <TabsList className="flex-wrap h-auto">
                          {members.map(i => (
                            <TabsTrigger key={i} value={String(i)} className="text-[13px]">
                              <span className="mr-1.5 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: pColor(i).solid }} />
                              {personaLabel(data[i], i)}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                        {members.map(i => (
                          <TabsContent key={i} value={String(i)}>
                            <StageDetail stage={data[i].journey_map!.stages[selectedStageIdx]} onChange={(patch) => mutateStage(i, selectedStageIdx, (s) => ({ ...s, ...patch }))} />
                          </TabsContent>
                        ))}
                      </Tabs>
                    )}
                  </div>
                )
              })()}
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
                <TooltipProvider delayDuration={150}>
                  <div className="rounded-lg border border-border overflow-hidden bg-card">
                    {(['High', 'Mid', 'Low'] as Tier[]).map(tier => {
                      const groupRows = rows.filter(r => r.priority === tier)
                      if (groupRows.length === 0) return null
                      const isLow = tier === 'Low'
                      return (
                        <div key={tier}>
                          <GroupHeader priority={tier} count={groupRows.length}
                            collapsible={isLow} collapsed={isLow && !showLow}
                            onToggle={isLow ? () => setShowLow(v => !v) : undefined} />
                          {(!isLow || showLow) && groupRows.map(r => (
                            <CompactRow key={`${r.stageIdx}-${normTp(r.name)}`} row={r} priority={tier}
                              onDelete={() => deleteTouchpoint(data, commit, r.stageIdx, r.name)}
                              onRemovePersona={(pi) => removePersonaFromTp(data, commit, pi, r.stageIdx, r.name)} />
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </TooltipProvider>
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

// ===== タッチポイント候補プール（コンパクトリスト） =====
function GroupHeader({ priority, count, collapsible, collapsed, onToggle }: {
  priority: Tier; count: number
  collapsible?: boolean; collapsed?: boolean; onToggle?: () => void
}) {
  const style = PRIORITY_STYLES[priority]
  const badge = priority === 'High' ? 'HIGH' : priority === 'Mid' ? 'MID' : 'LOW'
  const inner = (
    <>
      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold text-white ${style.badgeBg}`}>{badge}</span>
      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{style.label} — {count}件</span>
      {collapsible && (
        <span className="ml-auto text-muted-foreground">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      )}
    </>
  )
  const cls = 'flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-border'
  return collapsible
    ? <button type="button" onClick={onToggle} className={`${cls} w-full text-left hover:bg-gray-100 transition-colors`}>{inner}</button>
    : <div className={cls}>{inner}</div>
}

function CompactRow({ row, priority, onDelete, onRemovePersona }: {
  row: TouchpointRow; priority: Tier
  onDelete: () => void; onRemovePersona: (personaIdx: number) => void
}) {
  const style = PRIORITY_STYLES[priority]
  const oppText = buildOpportunityText(row)
  return (
    <div className="relative flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 pl-5 pr-4 border-b border-border hover:bg-gray-50 transition-colors">
      <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${style.bar}`} />
      {/* TP名＋ステージ */}
      <div className="flex-none w-[200px] min-w-0">
        <div className="font-bold text-sm text-foreground truncate" title={row.name}>{row.name}</div>
        <div className="text-[11px] text-muted-foreground">{row.stageIdx + 1} {row.stage}</div>
      </div>
      {/* ペルソナピル（クリックで外す） */}
      <div className="flex-none w-[180px] flex gap-1 flex-wrap">
        {row.personas.map(pe => (
          <button key={pe.idx} onClick={() => onRemovePersona(pe.idx)} title={`${pe.name}（クリックで外す）`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
            style={{ background: pColor(pe.idx).soft, color: pColor(pe.idx).solid }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: pColor(pe.idx).solid }} />
            {shortenPersonaName(pe.name)}
          </button>
        ))}
      </div>
      {/* 感情ドット（ペルソナ順） */}
      <div className="flex-none w-[120px] flex gap-1.5 items-center">
        {row.personas.map(pe => (
          <span key={pe.idx} className={`w-2 h-2 rounded-full ${emoColor(pe.emotion_score)}`}
            title={`${pe.name}: ${emoLabel(pe.emotion_score)}`} />
        ))}
      </div>
      {/* 施策メモ（1行省略＋ホバーで全文） */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex-1 min-w-[120px] text-xs text-muted-foreground truncate cursor-default">{oppText || '—'}</div>
        </TooltipTrigger>
        {oppText && (
          <TooltipContent className="max-w-[400px] whitespace-pre-line text-xs">{oppText}</TooltipContent>
        )}
      </Tooltip>
      {/* 削除 */}
      <button type="button" onClick={onDelete} title="このタッチポイントを削除"
        className="flex-none p-1.5 rounded hover:bg-red-50 text-red-500">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

type ScopePersona = { idx: number; name: string; color: string; stages: JourneyStage[] }

// 感情スコア(-2〜2)の5段グリッドラベル
const EMO_LEVELS: Array<{ score: number; label: string }> = [
  { score: 2, label: '満足' },
  { score: 1, label: '好印象' },
  { score: 0, label: '普通' },
  { score: -1, label: 'もやもや' },
  { score: -2, label: '不満' },
]

function EmotionGraph({ personasInScope, stageNames, selectedStageIdx, onSelectStage }: {
  personasInScope: ScopePersona[]; stageNames: string[]
  selectedStageIdx: number; onSelectStage: (i: number) => void
}) {
  const n = stageNames.length
  if (n === 0) return null

  // SVG座標系（width:100% で可変描画）
  const padL = 88, padR = 28, padT = 28, padB = 76
  const colW = 200
  const W = padL + padR + colW * n
  const chartTop = padT
  const chartH = 192
  const chartBottom = chartTop + chartH
  const H = chartBottom + padB
  const x = (i: number) => padL + colW * (i + 0.5)
  const y = (score: number) => chartTop + ((2 - Math.max(-2, Math.min(2, score))) / 4) * chartH

  // ステージごとの集計（注釈カード＆avgサブラベル用）
  const stageInfo = stageNames.map((sName, i) => {
    const entries = personasInScope
      .map(p => ({ name: p.name, color: p.color, stage: p.stages[i] }))
      .filter((e): e is { name: string; color: string; stage: JourneyStage } => !!e.stage)
    const scores = entries.map(e => e.stage.emotion_score ?? 0)
    const min = scores.length ? Math.min(...scores) : 0
    const worst = entries.length
      ? entries.reduce((a, b) => ((b.stage.emotion_score ?? 0) < (a.stage.emotion_score ?? 0) ? b : a))
      : null
    const tier: 'bad' | 'warn' | 'good' = min < 0 ? 'bad' : min === 0 ? 'warn' : 'good'
    let note: string
    if (tier === 'good') note = '全員ポジティブ。強みとして活かせる接点。'
    else {
      const reason = worst?.stage.pain_points?.[0]?.trim() || worst?.stage.emotions?.trim() || '課題あり'
      note = `${worst?.name}が低い：${reason}`
    }
    return { sName, i, entries, tier, note }
  })

  const CARD_STYLE: Record<'bad' | 'warn' | 'good', string> = {
    bad: 'bg-red-50 border-red-200 text-red-800',
    warn: 'bg-amber-50 border-amber-200 text-amber-800',
    good: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto" role="img" aria-label="感情カーブ">
        {/* 横ガイドライン＋Y軸ラベル */}
        {EMO_LEVELS.map(({ score, label }) => (
          <g key={score}>
            <line x1={padL} y1={y(score)} x2={W - padR} y2={y(score)} stroke="currentColor" className="text-border" strokeWidth={1} />
            <text x={padL - 12} y={y(score) + 4} textAnchor="end" className="fill-muted-foreground" fontSize={12}>{label}</text>
          </g>
        ))}
        {/* ステージの縦区切り */}
        {stageNames.map((_, i) => (
          <line key={i} x1={x(i)} y1={chartTop} x2={x(i)} y2={chartBottom} stroke="currentColor" className="text-border/50" strokeWidth={1} />
        ))}
        {/* ペルソナの折れ線 */}
        {personasInScope.map(({ idx, color, stages }) => {
          if (!stages.length) return null
          const pts = stageNames.map((_, i) => `${x(i)},${y(stages[i]?.emotion_score ?? 0)}`).join(' ')
          return (
            <g key={idx}>
              <polyline points={pts} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              {stageNames.map((_, i) => stages[i] && <circle key={i} cx={x(i)} cy={y(stages[i].emotion_score ?? 0)} r={5} fill={color} />)}
            </g>
          )
        })}
        {/* X軸ラベル（Stage N 名前）＋ avgサブラベル */}
        {stageInfo.map(({ sName, i, entries }) => (
          <g key={i}>
            <text x={x(i)} y={chartBottom + 28} textAnchor="middle" className="fill-foreground" fontSize={13} fontWeight={700}>
              Stage {i + 1} {sName}
            </text>
            <text x={x(i)} y={chartBottom + 48} textAnchor="middle" fontSize={11}>
              {entries.map((e, k) => (
                <tspan key={k} fill={e.color}>
                  {k > 0 ? ' / ' : 'avg '}{((e.stage.emotion_score ?? 0) + 3).toFixed(1)}
                </tspan>
              ))}
            </text>
          </g>
        ))}
        {/* 選択中ステージのハイライト（破線円＋「↓ 選択中」） */}
        {selectedStageIdx >= 0 && selectedStageIdx < n && (
          <g pointerEvents="none">
            <circle cx={x(selectedStageIdx)} cy={y(0)} r={32} fill="none" stroke="var(--ds-app-accent)" strokeWidth={2} strokeDasharray="4 3" opacity={0.5} />
          </g>
        )}
        {/* ステージ単位のクリック領域（透明・列全幅） */}
        {stageNames.map((sName, i) => {
          const w = colW - 10
          const selected = selectedStageIdx === i
          return (
            <rect key={i} x={x(i) - w / 2} y={4} width={w} height={H - 8}
              fill={selected ? 'rgba(37,99,235,0.04)' : 'transparent'} cursor="pointer"
              onClick={() => onSelectStage(i)}
              onMouseEnter={(e) => { if (!selected) e.currentTarget.setAttribute('fill', 'rgba(0,0,0,0.03)') }}
              onMouseLeave={(e) => { if (!selected) e.currentTarget.setAttribute('fill', 'transparent') }}>
              <title>{`Stage ${i + 1} ${sName}`}</title>
            </rect>
          )
        })}
      </svg>

      {/* ステージ別の読み取りメモ（クリックで詳細パネルへナビ＝選択chip兼用） */}
      <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {stageInfo.map(({ sName, i, tier, note }) => {
          const sel = selectedStageIdx === i
          return (
            <div key={i} role="button" tabIndex={0}
              aria-pressed={sel}
              onClick={() => onSelectStage(i)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectStage(i) } }}
              className={`cursor-pointer rounded-md border p-2 text-[11.5px] leading-snug transition-all ${CARD_STYLE[tier]} ${
                sel ? 'ring-2 ring-ds-app-accent shadow-md scale-[1.02]' : 'hover:shadow-sm hover:scale-[1.01]'}`}>
              <b className="font-bold">{i + 1} {sName}</b>：{note}
            </div>
          )
        })}
      </div>
    </div>
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
