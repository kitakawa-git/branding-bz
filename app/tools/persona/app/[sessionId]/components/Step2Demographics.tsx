'use client'

// Step 2: デモグラフィック（ターゲット別グループ・マルチペルソナ）
// target_segments ごとにグループ枠を描画し、各グループに target_name 一致のペルソナを表示。
// グループ単位で「このターゲットにペルソナを追加」（1ターゲット複数ペルソナ可）。
import { useState, useCallback, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FieldHeading, FieldSubLabel } from '@/components/shared/FieldHeading'
import { TagInput } from '@/components/shared/TagInput'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react'
import { AIButton } from '@/components/shared/AIButton'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  type Demographics, type Persona, type BasicInfo,
  EMPTY_DEMOGRAPHICS, emptyPersona, narrowBasicInfoToSegment, AVATAR_EMOJIS,
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

  const isValid = personas.length > 0 && personas.every(p =>
    p.demographics.persona_name?.trim()
    && p.demographics.avatar_emoji?.trim()
    && String(p.demographics.age ?? '').trim()
    && p.demographics.occupation?.trim())

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
      onRemove={() => removePersona(idx)}
    />
  )

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Step 2: ペルソナ生成</h1>
      <p className="mb-4 text-[13px] text-muted-foreground">
        ターゲットごとに代表的な人物像（ペルソナ）を定義します。AIの提案を確認・編集でき、複数追加も可能です。
      </p>

      {aiError && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 mb-4">
          {aiError}
          <button onClick={generateAll} className="ml-2 font-medium underline hover:no-underline">再試行</button>
        </div>
      )}

      <div className="space-y-4 rounded-lg border border-border bg-[hsl(0_0%_97%)] p-4">
        <div className="flex items-center justify-between gap-2">
          <FieldHeading className="mb-0 mt-0">ターゲット別ペルソナ</FieldHeading>
          <AIButton size="sm" onClick={() => setConfirmOpen(true)} className="shrink-0">
            AIで一括生成
          </AIButton>
        </div>
        {segments.map((seg) => {
          const members = indexed.filter(({ p }) => p.target_name === seg.name)
          return (
            <section key={seg.name} className="rounded-xl border border-gray-200 bg-white p-4">
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
          {saving ? '保存中...' : '課題・購買行動へ'}
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

  return (
    <Card className="bg-white border shadow-none">
      <CardContent className="p-4 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-700">ペルソナ{ordinal}</h3>
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
            <div>
              <FieldSubLabel>呼称 / ペルソナ名称 <span className="text-red-500">*</span></FieldSubLabel>
              <Input value={data.persona_name} onChange={e => set('persona_name', e.target.value)} placeholder="例: 地方中小企業の経営者" className="h-9 text-sm" />
            </div>
            <div>
              <FieldSubLabel>顔アイコン <span className="text-red-500">*</span></FieldSubLabel>
              <div className="flex flex-wrap gap-1">
                {AVATAR_EMOJIS.map(em => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => set('avatar_emoji', data.avatar_emoji === em ? '' : em)}
                    className={`relative flex h-9 w-9 items-center justify-center rounded-lg border text-xl transition-transform duration-150 hover:z-10 hover:scale-[2] ${
                      data.avatar_emoji === em
                        ? 'border-ds-app-accent bg-blue-50 ring-1 ring-ds-app-accent'
                        : 'border-border bg-white hover:border-muted-foreground'
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
              {!data.avatar_emoji?.trim() && (
                <p className="mt-1 text-[11px] text-red-500">顔アイコンを1つ選んでください</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldSubLabel>年齢層 <span className="text-red-500">*</span></FieldSubLabel>
                <Input type="text" value={data.age} onChange={e => set('age', e.target.value)} placeholder="例: 30-40歳" className="h-9 text-sm" />
              </div>
              <div>
                <FieldSubLabel>職業 <span className="text-red-500">*</span></FieldSubLabel>
                <Input value={data.occupation} onChange={e => set('occupation', e.target.value)} placeholder="中小企業経営者" className="h-9 text-sm" />
              </div>
            </div>
            <div>
              <FieldSubLabel>説明</FieldSubLabel>
              <Textarea value={data.description} onChange={e => set('description', e.target.value)} placeholder="このペルソナの背景・状況・課題感を1〜2文で" rows={2} className="text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldSubLabel>性別</FieldSubLabel>
                <Input value={data.gender} onChange={e => set('gender', e.target.value)} placeholder="男性 / 女性" className="h-9 text-sm" />
              </div>
              <div>
                <FieldSubLabel>役職</FieldSubLabel>
                <Input value={data.company_role} onChange={e => set('company_role', e.target.value)} placeholder="代表取締役" className="h-9 text-sm" />
              </div>
              <div>
                <FieldSubLabel>勤務先規模</FieldSubLabel>
                <Input value={data.company_size} onChange={e => set('company_size', e.target.value)} placeholder="50〜100名" className="h-9 text-sm" />
              </div>
            </div>
            <div>
              <FieldHeading className="mb-3">情報収集チャネル</FieldHeading>
              <TagInput value={data.media_channels || []} onChange={(next) => set('media_channels', next)} placeholder="例: X (Twitter)（Enterで追加）" />
            </div>
            <div>
              <FieldHeading className="mb-3">性格特性</FieldHeading>
              <TagInput value={data.personality_traits || []} onChange={(next) => set('personality_traits', next)} placeholder="例: 慎重派（Enterで追加）" />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

