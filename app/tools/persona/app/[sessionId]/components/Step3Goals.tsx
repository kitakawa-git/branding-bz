'use client'

// Step 3: ゴール・課題（AI深掘り＋編集）
import { useState, useCallback, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, ArrowRight, WandSparkles, Plus, X } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface GoalsData {
  primary_goals: string[]
  challenges: string[]
  pain_points: string[]
  buying_motivation: string
  buying_barriers: string[]
  decision_factors: string[]
  brand_expectations: string
  success_definition: string
}

interface Demographics {
  persona_name: string
  age: number | string
  gender: string
  occupation: string
  company_role: string
  personality_traits: string[]
  quote: string
  [key: string]: unknown
}

interface BasicInfo {
  company_name: string
  industry_category: string
  industry_subcategory: string
  products: string
  target_description: string
}

interface Step3Props {
  goals: GoalsData
  demographics: Demographics
  basicInfo: BasicInfo
  onNext: (data: GoalsData) => Promise<boolean>
  onBack: () => void
  onSaveField: (data: GoalsData) => Promise<void>
}

const EMPTY_GOALS: GoalsData = {
  primary_goals: [], challenges: [], pain_points: [],
  buying_motivation: '', buying_barriers: [], decision_factors: [],
  brand_expectations: '', success_definition: '',
}

export function Step3Goals({ goals, demographics, basicInfo, onNext, onBack, onSaveField }: Step3Props) {
  const [data, setData] = useState<GoalsData>({ ...EMPTY_GOALS, ...goals })
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aiRequestedRef = useRef(false)

  const triggerAutoSave = useCallback((d: GoalsData) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { onSaveField(d) }, 1000)
  }, [onSaveField])

  const updateField = useCallback(<K extends keyof GoalsData>(key: K, value: GoalsData[K]) => {
    setData(prev => {
      const next = { ...prev, [key]: value }
      triggerAutoSave(next)
      return next
    })
  }, [triggerAutoSave])

  const fetchAISuggestion = useCallback(async () => {
    setAiLoading(true)
    setAiError('')
    try {
      const res = await fetch('/api/tools/persona/suggest-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basic_info: basicInfo, demographics }),
      })
      if (!res.ok) {
        const d = await res.json()
        setAiError(d.error || 'AI提案の取得に失敗しました')
        return
      }
      const { goals: suggested } = await res.json()
      const merged = { ...EMPTY_GOALS, ...suggested }
      setData(merged)
      triggerAutoSave(merged)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setAiLoading(false)
    }
  }, [basicInfo, demographics, triggerAutoSave])

  useEffect(() => {
    if (!data.primary_goals?.length && !aiRequestedRef.current) {
      aiRequestedRef.current = true
      fetchAISuggestion()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  const handleRegenerate = () => {
    if (data.primary_goals?.length > 0) { setConfirmOpen(true); return }
    fetchAISuggestion()
  }

  // リスト操作
  const addItem = (key: keyof GoalsData) => {
    const arr = data[key]
    if (Array.isArray(arr)) updateField(key, [...arr, ''] as GoalsData[typeof key])
  }
  const removeItem = (key: keyof GoalsData, idx: number) => {
    const arr = data[key]
    if (Array.isArray(arr)) updateField(key, arr.filter((_, i) => i !== idx) as GoalsData[typeof key])
  }
  const updateItem = (key: keyof GoalsData, idx: number, value: string) => {
    const arr = data[key]
    if (Array.isArray(arr)) {
      const next = [...arr]
      next[idx] = value
      updateField(key, next as GoalsData[typeof key])
    }
  }

  const handleNext = async () => {
    setSaving(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const success = await onNext(data)
    if (!success) setSaving(false)
  }

  const isValid = data.primary_goals?.some(g => g.trim()) || data.challenges?.some(c => c.trim())

  if (aiLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-6">Step 3: ゴール・課題</h1>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border bg-white p-5">
              <Skeleton className="mb-4 h-5 w-40" />
              <Skeleton className="h-10 w-full mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          <p className="text-center text-sm text-gray-400">
            {demographics.persona_name}の目標と課題を分析中...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Step 3: ゴール・課題</h1>
      <p className="mb-5 text-[13px] text-muted-foreground">
        {demographics.persona_name || 'ペルソナ'}が抱える目標・課題・購買行動を定義します
      </p>

      {!aiLoading && (
        <div className="flex justify-start mb-3">
          <Button variant="outline" size="sm" onClick={handleRegenerate} className="gap-1.5 text-xs">
            <WandSparkles className="h-3.5 w-3.5" />
            {data.primary_goals?.length > 0 ? 'AIに再提案してもらう' : 'AIに提案してもらう'}
          </Button>
        </div>
      )}

      {aiError && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 mb-4">
          {aiError}
          <button onClick={fetchAISuggestion} className="ml-2 font-medium underline hover:no-underline">再試行</button>
        </div>
      )}

      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5 space-y-6">
          <ListSection label="主な目標" items={data.primary_goals} fieldKey="primary_goals" placeholder="例: 自社ブランドの認知度を高めたい" onAdd={addItem} onRemove={removeItem} onUpdate={updateItem} />
          <ListSection label="課題・悩み" items={data.challenges} fieldKey="challenges" placeholder="例: ブランディングの知識が不足している" onAdd={addItem} onRemove={removeItem} onUpdate={updateItem} />
          <ListSection label="ペインポイント" items={data.pain_points} fieldKey="pain_points" placeholder="例: 予算が限られている" onAdd={addItem} onRemove={removeItem} onUpdate={updateItem} />

          <div>
            <label className="text-sm font-bold text-gray-700 mb-2 block">購買の動機</label>
            <Textarea value={data.buying_motivation} onChange={e => updateField('buying_motivation', e.target.value)} placeholder="何がきっかけで商品・サービスを検討するか" rows={2} className="text-sm" />
          </div>

          <ListSection label="購買の障壁" items={data.buying_barriers} fieldKey="buying_barriers" placeholder="例: 費用対効果が見えにくい" onAdd={addItem} onRemove={removeItem} onUpdate={updateItem} />
          <ListSection label="意思決定の要因" items={data.decision_factors} fieldKey="decision_factors" placeholder="例: 実績・事例の豊富さ" onAdd={addItem} onRemove={removeItem} onUpdate={updateItem} />

          <div>
            <label className="text-sm font-bold text-gray-700 mb-2 block">ブランドへの期待</label>
            <Textarea value={data.brand_expectations} onChange={e => updateField('brand_expectations', e.target.value)} placeholder="このブランドにどんな価値を期待するか" rows={2} className="text-sm" />
          </div>

          <div>
            <label className="text-sm font-bold text-gray-700 mb-2 block">成功の定義</label>
            <Textarea value={data.success_definition} onChange={e => updateField('success_definition', e.target.value)} placeholder="この人にとっての「成功」とは" rows={2} className="text-sm" />
          </div>
        </CardContent>
      </Card>

      {/* フッターナビゲーション */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> 戻る
        </Button>
        <Button onClick={handleNext} disabled={saving || !isValid} className="gap-1">
          {saving ? '保存中...' : 'ジャーニーマップへ'}
          {!saving && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認</AlertDialogTitle>
            <AlertDialogDescription>現在の内容が上書きされます。よろしいですか？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={() => fetchAISuggestion()}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// リスト入力セクション
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
            <Input
              value={item}
              onChange={e => onUpdate(fieldKey, idx, e.target.value)}
              placeholder={placeholder}
              className="h-9 text-sm flex-1"
            />
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
