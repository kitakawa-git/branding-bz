'use client'

// Step 3: 課題・購買行動（マルチペルソナ・ペルソナ単位）
// 各ペルソナの demographics で suggest-goals を呼び、persona.goals に格納。
import { useState, useCallback, useEffect, useRef } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { FieldHeading, FieldSubLabel } from '@/components/shared/FieldHeading'
import { TagInput } from '@/components/shared/TagInput'
import { PersonaAvatarName } from '@/components/shared/PersonaAvatarName'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { AIButton } from '@/components/shared/AIButton'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  type Demographics, type GoalsData, type Persona, type BasicInfo, EMPTY_GOALS,
} from './persona-types'

interface Step3Props {
  personas: Persona[]
  basicInfo: BasicInfo
  onNext: (personas: Persona[]) => Promise<boolean>
  onBack: () => void
  onSaveField: (personas: Persona[]) => Promise<void>
}

async function suggestGoals(basicInfo: BasicInfo, demographics: Demographics): Promise<GoalsData> {
  const res = await fetch('/api/tools/persona/suggest-goals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ basic_info: basicInfo, demographics }),
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    throw new Error(d.error || 'AI提案の取得に失敗しました')
  }
  const { goals } = await res.json()
  return { ...EMPTY_GOALS, ...goals }
}

export function Step3Goals({ personas: initialPersonas, basicInfo, onNext, onBack, onSaveField }: Step3Props) {
  const [personas, setPersonas] = useState<Persona[]>(initialPersonas)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aiRequestedRef = useRef(false)

  const triggerAutoSave = useCallback((p: Persona[]) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { onSaveField(p) }, 1000)
  }, [onSaveField])

  // 全ペルソナの goals を（指定があればそれだけ・無ければ未生成のものを）生成
  const generate = useCallback(async (onlyMissing: boolean) => {
    setAiLoading(true)
    setAiError('')
    try {
      const targets = personas.map((p, i) => ({ p, i })).filter(({ p }) => !onlyMissing || !(p.goals?.primary_goals?.length))
      const results = await Promise.all(targets.map(({ p }) => suggestGoals(basicInfo, p.demographics)))
      setPersonas(prev => {
        const arr = [...prev]
        targets.forEach(({ i }, k) => { arr[i] = { ...arr[i], goals: results[k] } })
        triggerAutoSave(arr)
        return arr
      })
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setAiLoading(false)
    }
  }, [personas, basicInfo, triggerAutoSave])

  useEffect(() => {
    const needs = initialPersonas.some(p => !(p.goals?.primary_goals?.length))
    if (needs && !aiRequestedRef.current) {
      aiRequestedRef.current = true
      generate(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const updateGoals = useCallback((idx: number, next: GoalsData) => {
    setPersonas(prev => {
      const arr = prev.map((p, i) => (i === idx ? { ...p, goals: next } : p))
      triggerAutoSave(arr)
      return arr
    })
  }, [triggerAutoSave])

  const handleNext = async () => {
    setSaving(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const success = await onNext(personas)
    if (!success) setSaving(false)
  }

  const isValid = personas.length > 0 && personas.every(p =>
    p.goals?.primary_goals?.some(g => g.trim()) || p.goals?.pain_points?.some(c => c.trim()))

  const segments = (basicInfo.target_segments || []).filter(s => s?.name?.trim())
  const segNames = new Set(segments.map(s => s.name))
  const indexed = personas.map((p, idx) => ({ p, idx }))
  const unclassified = indexed.filter(({ p }) => !segNames.has(p.target_name))

  if (aiLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-6">Step 3: 課題・購買行動</h1>
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="rounded-xl border bg-white p-5">
              <Skeleton className="mb-4 h-5 w-40" />
              <Skeleton className="h-10 w-full mb-2" /><Skeleton className="h-10 w-full" />
            </div>
          ))}
          <p className="text-center text-sm text-gray-400">各ペルソナの目標と課題を分析中...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Step 3: 課題・購買行動</h1>
      <p className="mb-4 text-[13px] text-muted-foreground">
        各ペルソナが抱える目標・課題・購買行動を定義します（課題は短い体言止め）。
      </p>

      {aiError && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 mb-4">
          {aiError}
          <button onClick={() => generate(false)} className="ml-2 font-medium underline hover:no-underline">再試行</button>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-[hsl(0_0%_97%)] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <FieldHeading className="mb-0 mt-0">ペルソナ別の課題・購買行動</FieldHeading>
          <AIButton size="sm" onClick={() => setConfirmOpen(true)}>
            AIで一括生成
          </AIButton>
        </div>
        <div className="space-y-6">
        {segments.map((seg) => {
          const members = indexed.filter(({ p }) => p.target_name === seg.name)
          return (
            <section key={seg.name} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3">
                <h2 className="text-sm font-bold text-gray-800">{seg.name}</h2>
                {seg.description && <p className="text-[12px] text-muted-foreground mt-0.5">{seg.description}</p>}
              </div>
              <div className="space-y-3">
                {members.length === 0 && <p className="text-[13px] text-muted-foreground">このターゲットのペルソナはまだありません。</p>}
                {members.map(({ p, idx }) => (
                  <GoalsForm key={idx} personaName={p.demographics.persona_name || `ペルソナ${idx + 1}`} avatarEmoji={p.demographics.avatar_emoji} data={p.goals} onChange={(next) => updateGoals(idx, next)} />
                ))}
              </div>
            </section>
          )
        })}

        {unclassified.length > 0 && (
          <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
            <div className="mb-3">
              <h2 className="text-sm font-bold text-amber-800">未分類</h2>
            </div>
            <div className="space-y-3">
              {unclassified.map(({ p, idx }) => (
                <GoalsForm key={idx} personaName={p.demographics.persona_name || `ペルソナ${idx + 1}`} avatarEmoji={p.demographics.avatar_emoji} data={p.goals} onChange={(next) => updateGoals(idx, next)} />
              ))}
            </div>
          </section>
        )}
        </div>
      </div>

      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-4 flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="h-14 gap-2 px-6 text-base font-bold">
          <ArrowLeft className="h-4 w-4" /> 戻る
        </Button>
        <Button onClick={handleNext} disabled={saving || !isValid} className="h-14 gap-2 px-6 text-base font-bold">
          {saving ? '保存中...' : 'ジャーニー設計へ'}
          {!saving && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認</AlertDialogTitle>
            <AlertDialogDescription>全ペルソナの課題をAIで再生成します。現在の内容は上書きされます。よろしいですか？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={() => generate(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// 1ペルソナぶんの課題フォーム（controlled）
function GoalsForm({ personaName, avatarEmoji, data, onChange }: {
  personaName: string
  avatarEmoji?: string
  data: GoalsData
  onChange: (next: GoalsData) => void
}) {
  const set = <K extends keyof GoalsData>(key: K, value: GoalsData[K]) => onChange({ ...data, [key]: value })

  return (
    <Card className="bg-white border shadow-none">
      <CardContent className="p-5 space-y-6">
        <PersonaAvatarName emoji={avatarEmoji} name={`${personaName} の課題`} />
        <div>
          <FieldSubLabel className="mb-1">ニーズ</FieldSubLabel>
          <TagInput value={data.primary_goals} onChange={(next) => set('primary_goals', next)} chipClassName="bg-blue-50 border border-blue-100 text-ds-app-accent-hover" placeholder="例: 本業に集中できる環境の確保（Enterで追加）" />
        </div>
        <div>
          <FieldSubLabel className="mb-1">課題・ペインポイント</FieldSubLabel>
          <TagInput value={data.pain_points} onChange={(next) => set('pain_points', next)} chipClassName="bg-orange-50 border border-orange-100 text-orange-700" placeholder="例: 費用対効果が見えにくい（Enterで追加）" />
        </div>
        <div>
          <FieldSubLabel className="mb-1">意思決定の要因</FieldSubLabel>
          <TagInput value={data.decision_factors} onChange={(next) => set('decision_factors', next)} chipClassName="bg-green-50 border border-green-100 text-green-700" placeholder="例: 実績・事例の豊富さ（Enterで追加）" />
        </div>
        <div>
          <FieldSubLabel className="mb-1">購買の障壁</FieldSubLabel>
          <TagInput value={data.buying_barriers} onChange={(next) => set('buying_barriers', next)} chipClassName="bg-red-50 border border-red-100 text-red-700" placeholder="例: 費用対効果が見えにくい（Enterで追加）" />
        </div>
        <div>
          <FieldSubLabel className="mb-1">ブランドへの期待</FieldSubLabel>
          <Textarea value={data.brand_expectations} onChange={e => set('brand_expectations', e.target.value)} placeholder="どんな価値を期待するか" rows={2} className="text-sm" />
        </div>

        <Accordion type="single" collapsible>
          <AccordionItem value="details" className="rounded-lg border px-3">
            <AccordionTrigger className="py-3 text-sm font-bold text-gray-700">詳細設定（任意）</AccordionTrigger>
            <AccordionContent className="pb-4">
              <div>
                <FieldSubLabel className="mb-1">購買の動機</FieldSubLabel>
                <Textarea value={data.buying_motivation} onChange={e => set('buying_motivation', e.target.value)} placeholder="何がきっかけで検討するか" rows={2} className="text-sm" />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  )
}

