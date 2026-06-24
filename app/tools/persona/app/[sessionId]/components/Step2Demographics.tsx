'use client'

// Step 2: デモグラフィック（ターゲット別グループ・マルチペルソナ）
// target_segments ごとにグループ枠を描画し、各グループに target_name 一致のペルソナを表示。
// グループ単位で「このターゲットにペルソナを追加」（1ターゲット複数ペルソナ可）。
import { useState, useCallback, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, ArrowRight, Plus, X, Trash2 } from 'lucide-react'
import { AIButton } from '@/components/shared/AIButton'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  type Demographics, type Persona, type BasicInfo,
  EMPTY_DEMOGRAPHICS, emptyPersona, narrowBasicInfoToSegment,
} from './persona-types'

interface Step2Props {
  personas: Persona[]
  basicInfo: BasicInfo
  onNext: (personas: Persona[]) => Promise<boolean>
  onBack: () => void
  onSaveField: (personas: Persona[]) => Promise<void>
}

async function suggestForSegment(basicInfo: BasicInfo, segment?: { name: string; description?: string }): Promise<Demographics> {
  const res = await fetch('/api/tools/persona/suggest-demographics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ basic_info: narrowBasicInfoToSegment(basicInfo, segment) }),
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    throw new Error(d.error || 'AI提案の取得に失敗しました')
  }
  const { demographics } = await res.json()
  return { ...EMPTY_DEMOGRAPHICS, ...demographics }
}

export function Step2Demographics({ personas: initialPersonas, basicInfo, onNext, onBack, onSaveField }: Step2Props) {
  const [personas, setPersonas] = useState<Persona[]>(initialPersonas)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [addingIdx, setAddingIdx] = useState<number | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aiRequestedRef = useRef(false)

  const triggerAutoSave = useCallback((p: Persona[]) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { onSaveField(p) }, 1000)
  }, [onSaveField])

  const segments = (basicInfo.target_segments || []).filter(s => s?.name?.trim())
  const segNames = new Set(segments.map(s => s.name))

  // 初期/全件: 各セグメントで1ペルソナ生成（target_name 付与）。未分類は消える（全置換）。
  const generateAll = useCallback(async () => {
    setAiLoading(true)
    setAiError('')
    try {
      const segs = segments.length > 0 ? segments : [undefined]
      const demos = await Promise.all(segs.map(s => suggestForSegment(basicInfo, s)))
      const next = demos.map((d, i) => ({ ...emptyPersona(segs[i]?.name || ''), demographics: d }))
      setPersonas(next)
      triggerAutoSave(next)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setAiLoading(false)
    }
  }, [basicInfo, segments, triggerAutoSave])

  useEffect(() => {
    const hasContent = initialPersonas.some(p => p.demographics?.persona_name)
    if (!hasContent && !aiRequestedRef.current) {
      aiRequestedRef.current = true
      generateAll()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const updateDemographics = useCallback((absIdx: number, next: Demographics) => {
    setPersonas(prev => {
      const arr = prev.map((p, i) => (i === absIdx ? { ...p, demographics: next } : p))
      triggerAutoSave(arr)
      return arr
    })
  }, [triggerAutoSave])

  const removePersona = (absIdx: number) => {
    setPersonas(prev => {
      const arr = prev.filter((_, i) => i !== absIdx)
      triggerAutoSave(arr)
      return arr
    })
  }

  // ターゲット単位の追加（同じ target_name で末尾に追加）
  const addToSegment = async (segment?: { name: string; description?: string }) => {
    const targetName = segment?.name || ''
    const newIdx = personas.length
    setPersonas(prev => [...prev, emptyPersona(targetName)])
    setAddingIdx(newIdx)
    try {
      const demo = await suggestForSegment(basicInfo, segment)
      setPersonas(prev => {
        const arr = prev.map((p, i) => (i === newIdx ? { ...p, demographics: demo } : p))
        triggerAutoSave(arr)
        return arr
      })
    } catch (err) {
      setAiError(err instanceof Error ? err.message : '追加生成に失敗しました')
    } finally {
      setAddingIdx(null)
    }
  }

  const handleNext = async () => {
    setSaving(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const success = await onNext(personas)
    if (!success) setSaving(false)
  }

  const isValid = personas.length > 0 && personas.every(p => p.demographics.persona_name?.trim())

  if (aiLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-6">Step 2: ペルソナ生成</h1>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border bg-white p-5">
              <Skeleton className="mb-4 h-5 w-32" /><Skeleton className="h-10 w-full" />
            </div>
          ))}
          <p className="text-center text-sm text-gray-400">各ターゲットのペルソナを生成中...</p>
        </div>
      </div>
    )
  }

  // インデックス付きでグループ化（絶対indexで操作）
  const indexed = personas.map((p, idx) => ({ p, idx }))
  const unclassified = indexed.filter(({ p }) => !segNames.has(p.target_name))

  const renderForm = ({ p, idx }: { p: Persona; idx: number }, ordinal: number) => (
    <DemographicsForm
      key={idx}
      ordinal={ordinal}
      data={p.demographics}
      generating={addingIdx === idx}
      onChange={(next) => updateDemographics(idx, next)}
      onRemove={personas.length > 1 ? () => removePersona(idx) : undefined}
    />
  )

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Step 2: ペルソナ生成</h1>
      <p className="mb-4 text-[13px] text-muted-foreground">
        ターゲットごとにペルソナを定義します。1つのターゲットに複数のペルソナを追加できます。
      </p>

      <div className="flex justify-start mb-4">
        <AIButton onClick={() => setConfirmOpen(true)}>
          AIで一括生成
        </AIButton>
      </div>

      {aiError && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 mb-4">
          {aiError}
          <button onClick={generateAll} className="ml-2 font-medium underline hover:no-underline">再試行</button>
        </div>
      )}

      <div className="space-y-6">
        {segments.map((seg) => {
          const members = indexed.filter(({ p }) => p.target_name === seg.name)
          return (
            <section key={seg.name} className="rounded-xl border border-gray-200 bg-[hsl(0_0%_97%)] p-4">
              <div className="mb-3">
                <h2 className="text-sm font-bold text-gray-800">{seg.name}</h2>
                {seg.description && <p className="text-[12px] text-muted-foreground mt-0.5">{seg.description}</p>}
              </div>
              <div className="space-y-3">
                {members.length === 0 && (
                  <p className="text-[13px] text-muted-foreground">このターゲットのペルソナはまだありません。</p>
                )}
                {members.map((e, k) => renderForm(e, k + 1))}
              </div>
              <AIButton size="s" onClick={() => addToSegment(seg)} disabled={addingIdx !== null} className="mt-3" icon={<Plus className="w-4 h-4" />}>
                AIでペルソナを追加生成
              </AIButton>
            </section>
          )
        })}

        {unclassified.length > 0 && (
          <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
            <div className="mb-3">
              <h2 className="text-sm font-bold text-amber-800">未分類</h2>
              <p className="text-[12px] text-muted-foreground mt-0.5">現在のターゲットに紐づかないペルソナ（ターゲットの削除・改名など）。</p>
            </div>
            <div className="space-y-3">
              {unclassified.map((e, k) => renderForm(e, k + 1))}
            </div>
          </section>
        )}
      </div>

      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-4 flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="h-14 gap-2 px-6 text-base font-bold">
          <ArrowLeft className="h-4 w-4" /> 戻る
        </Button>
        <Button onClick={handleNext} disabled={saving || !isValid} className="h-14 gap-2 px-6 text-base font-bold">
          {saving ? '保存中...' : 'ゴール・課題へ'}
          {!saving && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認</AlertDialogTitle>
            <AlertDialogDescription>各ターゲットで1ペルソナを再生成します。現在の内容（未分類含む）は上書きされます。よろしいですか？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={generateAll}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// 1ペルソナぶんの編集フォーム（controlled）
function DemographicsForm({ ordinal, data, generating, onChange, onRemove }: {
  ordinal: number
  data: Demographics
  generating: boolean
  onChange: (next: Demographics) => void
  onRemove?: () => void
}) {
  const set = <K extends keyof Demographics>(key: K, value: Demographics[K]) => onChange({ ...data, [key]: value })
  type TagKey = 'hobbies' | 'media_channels' | 'personality_traits'
  const addTag = (key: TagKey) => set(key, [...(data[key] || []), ''])
  const removeTag = (key: TagKey, i: number) => set(key, (data[key] || []).filter((_, j) => j !== i))
  const updateTag = (key: TagKey, i: number, v: string) => {
    const arr = [...(data[key] || [])]; arr[i] = v; set(key, arr)
  }

  return (
    <Card className="bg-white border shadow-none">
      <CardContent className="p-4 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-700">ペルソナ{ordinal}</h3>
          {onRemove && (
            <Button type="button" variant="outline" size="icon" onClick={onRemove}
              className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
              <Trash2 size={14} />
            </Button>
          )}
        </div>

        {generating ? (
          <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-2/3" /><p className="text-xs text-gray-400">AIが生成中...</p></div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">呼称 / ペルソナ名称</label>
                <Input value={data.persona_name} onChange={e => set('persona_name', e.target.value)} placeholder="例: 地方中小企業の経営者" className="h-9 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">年齢層</label>
                  <Input type="text" value={data.age} onChange={e => set('age', e.target.value)} placeholder="例: 30-40歳" className="h-9 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">性別</label>
                  <Input value={data.gender} onChange={e => set('gender', e.target.value)} placeholder="男性 / 女性" className="h-9 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">職業</label>
                <Input value={data.occupation} onChange={e => set('occupation', e.target.value)} placeholder="中小企業経営者" className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">役職</label>
                <Input value={data.company_role} onChange={e => set('company_role', e.target.value)} placeholder="代表取締役" className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">勤務先規模</label>
                <Input value={data.company_size} onChange={e => set('company_size', e.target.value)} placeholder="50〜100名" className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">居住地</label>
                <Input value={data.location} onChange={e => set('location', e.target.value)} placeholder="地方都市 / 都市部" className="h-9 text-sm" />
              </div>
            </div>

            <TagSection label="趣味・関心" items={data.hobbies || []} fieldKey="hobbies" placeholder="例: ランニング" onAdd={addTag} onRemove={removeTag} onUpdate={updateTag} />
            <TagSection label="情報収集チャネル" items={data.media_channels || []} fieldKey="media_channels" placeholder="例: X (Twitter)" onAdd={addTag} onRemove={removeTag} onUpdate={updateTag} />
            <TagSection label="性格特性" items={data.personality_traits || []} fieldKey="personality_traits" placeholder="例: 慎重派" onAdd={addTag} onRemove={removeTag} onUpdate={updateTag} />

            <div>
              <label className="text-xs text-gray-500 mb-1 block">1日の過ごし方（任意）</label>
              <Textarea value={data.daily_routine} onChange={e => set('daily_routine', e.target.value)} placeholder="朝7時に起床、通勤中にニュースアプリをチェック..." rows={2} className="text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">口癖・座右の銘（任意）</label>
              <Input value={data.quote} onChange={e => set('quote', e.target.value)} placeholder="「まずは数字で見せないと」" className="h-9 text-sm" />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function TagSection({ label, items, fieldKey, placeholder, onAdd, onRemove, onUpdate }: {
  label: string
  items: string[]
  fieldKey: 'hobbies' | 'media_channels' | 'personality_traits'
  placeholder: string
  onAdd: (key: 'hobbies' | 'media_channels' | 'personality_traits') => void
  onRemove: (key: 'hobbies' | 'media_channels' | 'personality_traits', idx: number) => void
  onUpdate: (key: 'hobbies' | 'media_channels' | 'personality_traits', idx: number, value: string) => void
}) {
  return (
    <div>
      <h3 className="text-sm font-bold mb-2 text-gray-700">{label}</h3>
      <div className="flex flex-wrap gap-2 mb-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1 rounded-full border border-gray-200 bg-white pl-3 pr-1 py-1">
            <Input value={item} onChange={e => onUpdate(fieldKey, idx, e.target.value)} placeholder={placeholder} className="h-6 w-28 border-0 p-0 text-xs focus-visible:ring-0" />
            <button onClick={() => onRemove(fieldKey, idx)} className="rounded-full p-0.5 hover:bg-gray-100">
              <X className="h-3 w-3 text-gray-400" />
            </button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => onAdd(fieldKey)} className="h-8 text-xs gap-1 rounded-full">
          <Plus className="h-3 w-3" /> 追加
        </Button>
      </div>
    </div>
  )
}
