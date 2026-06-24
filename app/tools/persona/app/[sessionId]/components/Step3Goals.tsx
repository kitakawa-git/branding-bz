'use client'

// Step 3: 課題・購買行動（マルチペルソナ・ペルソナ単位）
// 各ペルソナの demographics で suggest-goals を呼び、persona.goals に格納。
import { useState, useCallback, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, ArrowRight, Plus, X } from 'lucide-react'
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

      <div className="flex justify-start mb-4">
        <AIButton onClick={() => setConfirmOpen(true)}>
          AIで一括生成
        </AIButton>
      </div>

      {aiError && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 mb-4">
          {aiError}
          <button onClick={() => generate(false)} className="ml-2 font-medium underline hover:no-underline">再試行</button>
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
                {members.length === 0 && <p className="text-[13px] text-muted-foreground">このターゲットのペルソナはまだありません。</p>}
                {members.map(({ p, idx }) => (
                  <GoalsForm key={idx} personaName={p.demographics.persona_name || `ペルソナ${idx + 1}`} data={p.goals} onChange={(next) => updateGoals(idx, next)} />
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
                <GoalsForm key={idx} personaName={p.demographics.persona_name || `ペルソナ${idx + 1}`} data={p.goals} onChange={(next) => updateGoals(idx, next)} />
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-4 flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="h-14 gap-2 px-6 text-base font-bold">
          <ArrowLeft className="h-4 w-4" /> 戻る
        </Button>
        <Button onClick={handleNext} disabled={saving || !isValid} className="h-14 gap-2 px-6 text-base font-bold">
          {saving ? '保存中...' : 'ジャーニー／タッチポイントへ'}
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
function GoalsForm({ personaName, data, onChange }: {
  personaName: string
  data: GoalsData
  onChange: (next: GoalsData) => void
}) {
  const set = <K extends keyof GoalsData>(key: K, value: GoalsData[K]) => onChange({ ...data, [key]: value })
  const addItem = (key: keyof GoalsData) => {
    const arr = data[key]; if (Array.isArray(arr)) set(key, [...arr, ''] as GoalsData[typeof key])
  }
  const removeItem = (key: keyof GoalsData, idx: number) => {
    const arr = data[key]; if (Array.isArray(arr)) set(key, arr.filter((_, i) => i !== idx) as GoalsData[typeof key])
  }
  const updateItem = (key: keyof GoalsData, idx: number, value: string) => {
    const arr = data[key]
    if (Array.isArray(arr)) { const next = [...arr]; next[idx] = value; set(key, next as GoalsData[typeof key]) }
  }

  return (
    <Card className="bg-white border shadow-none">
      <CardContent className="p-5 space-y-6">
        <h3 className="text-sm font-bold text-gray-700">{personaName} の課題</h3>
        <ListSection label="主な目標" items={data.primary_goals} fieldKey="primary_goals" placeholder="例: 本業に集中できる環境の確保" onAdd={addItem} onRemove={removeItem} onUpdate={updateItem} />
        <ListSection label="課題・悩み" items={data.challenges} fieldKey="challenges" placeholder="例: IT専任者がいない" onAdd={addItem} onRemove={removeItem} onUpdate={updateItem} />
        <ListSection label="ペインポイント" items={data.pain_points} fieldKey="pain_points" placeholder="例: 費用対効果が見えにくい" onAdd={addItem} onRemove={removeItem} onUpdate={updateItem} />

        <div>
          <label className="text-sm font-bold text-gray-700 mb-2 block">購買の動機</label>
          <Textarea value={data.buying_motivation} onChange={e => set('buying_motivation', e.target.value)} placeholder="何がきっかけで検討するか" rows={2} className="text-sm" />
        </div>
        <ListSection label="購買の障壁" items={data.buying_barriers} fieldKey="buying_barriers" placeholder="例: 費用対効果が見えにくい" onAdd={addItem} onRemove={removeItem} onUpdate={updateItem} />
        <ListSection label="意思決定の要因" items={data.decision_factors} fieldKey="decision_factors" placeholder="例: 実績・事例の豊富さ" onAdd={addItem} onRemove={removeItem} onUpdate={updateItem} />
        <div>
          <label className="text-sm font-bold text-gray-700 mb-2 block">ブランドへの期待</label>
          <Textarea value={data.brand_expectations} onChange={e => set('brand_expectations', e.target.value)} placeholder="どんな価値を期待するか" rows={2} className="text-sm" />
        </div>
      </CardContent>
    </Card>
  )
}

function ListSection({ label, items, fieldKey, placeholder, onAdd, onRemove, onUpdate }: {
  label: string
  items: string[]
  fieldKey: keyof GoalsData
  placeholder: string
  onAdd: (key: keyof GoalsData) => void
  onRemove: (key: keyof GoalsData, idx: number) => void
  onUpdate: (key: keyof GoalsData, idx: number, value: string) => void
}) {
  return (
    <div>
      <h3 className="text-sm font-bold mb-2 text-gray-700">{label}</h3>
      <div className="space-y-2">
        {(items || []).map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Input value={item} onChange={e => onUpdate(fieldKey, idx, e.target.value)} placeholder={placeholder} className="h-9 text-sm flex-1" />
            <button onClick={() => onRemove(fieldKey, idx)} className="rounded p-1 hover:bg-gray-100">
              <X className="h-4 w-4 text-gray-400" />
            </button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => onAdd(fieldKey)} className="h-8 text-xs gap-1">
          <Plus className="h-3 w-3" /> 追加
        </Button>
      </div>
    </div>
  )
}
