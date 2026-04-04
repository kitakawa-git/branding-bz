'use client'

// Step 3: ゴール・課題（AI深掘り＋編集）— 複数ペルソナ対応
import { useState, useCallback, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

interface GoalsEntry {
  primary_goals: string[]
  challenges: string[]
  pain_points: string[]
  buying_motivation: string
  buying_barriers: string[]
  decision_factors: string[]
  brand_expectations: string
  success_definition: string
}

interface PersonaInfo {
  candidate_id: string
  name: string
  age: number
  gender: string
  occupation: string
  title: string
  [key: string]: unknown
}

interface BasicInfo {
  company_name: string
  industry_category: string
  industry_subcategory: string
  products: string
  target_description: string
}

// goals データ形式: ペルソナが1人の場合は従来の GoalsEntry、複数の場合は { [candidate_id]: GoalsEntry }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GoalsData = Record<string, any>

interface Step3Props {
  goals: GoalsData
  personas: PersonaInfo[]
  basicInfo: BasicInfo
  onNext: (data: GoalsData) => Promise<boolean>
  onBack: () => void
  onSaveField: (data: GoalsData) => Promise<void>
}

const EMPTY_GOALS: GoalsEntry = {
  primary_goals: [], challenges: [], pain_points: [],
  buying_motivation: '', buying_barriers: [], decision_factors: [],
  brand_expectations: '', success_definition: '',
}

// ペルソナIDからgoalsを取得するヘルパー
function getGoalsForPersona(goals: GoalsData, personaId: string, isSingle: boolean): GoalsEntry {
  if (isSingle) {
    // 単一ペルソナの場合、goalsデータをそのまま使う
    return { ...EMPTY_GOALS, ...goals }
  }
  return { ...EMPTY_GOALS, ...(goals[personaId] || {}) }
}

export function Step3Goals({ goals, personas, basicInfo, onNext, onBack, onSaveField }: Step3Props) {
  const isSingle = personas.length <= 1
  const firstPersona = personas[0] || { candidate_id: '_default', name: 'ペルソナ' }

  // 各ペルソナのgoalsをstate管理
  const [goalsMap, setGoalsMap] = useState<Record<string, GoalsEntry>>(() => {
    const map: Record<string, GoalsEntry> = {}
    for (const p of personas) {
      map[p.candidate_id] = getGoalsForPersona(goals, p.candidate_id, isSingle)
    }
    if (personas.length === 0) {
      map['_default'] = { ...EMPTY_GOALS, ...goals }
    }
    return map
  })
  const [activeTab, setActiveTab] = useState(firstPersona.candidate_id)
  const [aiLoading, setAiLoading] = useState<string | null>(null) // 読み込み中のペルソナID
  const [aiError, setAiError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aiRequestedRef = useRef<Set<string>>(new Set())

  const buildSaveData = useCallback((map: Record<string, GoalsEntry>): GoalsData => {
    if (isSingle) {
      return map[firstPersona.candidate_id] || EMPTY_GOALS
    }
    return map
  }, [isSingle, firstPersona.candidate_id])

  const triggerAutoSave = useCallback((map: Record<string, GoalsEntry>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { onSaveField(buildSaveData(map)) }, 1000)
  }, [onSaveField, buildSaveData])

  const updateGoalsField = useCallback((personaId: string, key: keyof GoalsEntry, value: GoalsEntry[keyof GoalsEntry]) => {
    setGoalsMap(prev => {
      const next = { ...prev, [personaId]: { ...(prev[personaId] || EMPTY_GOALS), [key]: value } }
      triggerAutoSave(next)
      return next
    })
  }, [triggerAutoSave])

  // AI提案（指定ペルソナのgoals）
  const fetchAISuggestion = useCallback(async (personaId: string) => {
    setAiLoading(personaId)
    setAiError('')
    try {
      const persona = personas.find(p => p.candidate_id === personaId)
      // demographics互換データを構築
      const demographics = persona ? {
        persona_name: persona.name,
        age: persona.age,
        gender: persona.gender,
        occupation: persona.occupation,
        company_role: persona.title,
        personality_traits: [],
        quote: '',
      } : {}

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
      setGoalsMap(prev => {
        const next = { ...prev, [personaId]: merged }
        triggerAutoSave(next)
        return next
      })
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setAiLoading(null)
    }
  }, [basicInfo, personas, triggerAutoSave])

  // 初回マウント時、データがないペルソナはAI提案
  useEffect(() => {
    const firstEmpty = personas.find(p => {
      const g = goalsMap[p.candidate_id]
      return !g?.primary_goals?.length && !aiRequestedRef.current.has(p.candidate_id)
    })
    if (firstEmpty) {
      aiRequestedRef.current.add(firstEmpty.candidate_id)
      fetchAISuggestion(firstEmpty.candidate_id)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  const handleRegenerate = () => {
    const current = goalsMap[activeTab]
    if (current?.primary_goals?.length > 0) { setConfirmOpen(true); return }
    fetchAISuggestion(activeTab)
  }

  const handleNext = async () => {
    setSaving(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const success = await onNext(buildSaveData(goalsMap))
    if (!success) setSaving(false)
  }

  const currentGoals = goalsMap[activeTab] || EMPTY_GOALS
  const isValid = currentGoals.primary_goals?.some(g => g.trim()) || currentGoals.challenges?.some(c => c.trim())
  const isLoading = aiLoading === activeTab

  const renderGoalsForm = (personaId: string) => {
    const data = goalsMap[personaId] || EMPTY_GOALS
    const personaLoading = aiLoading === personaId

    if (personaLoading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border bg-white p-5">
              <Skeleton className="mb-4 h-5 w-40" />
              <Skeleton className="h-10 w-full mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          <p className="text-center text-sm text-gray-400">
            {personas.find(p => p.candidate_id === personaId)?.name || 'ペルソナ'}の目標と課題を分析中...
          </p>
        </div>
      )
    }

    // リスト操作
    const addItem = (key: keyof GoalsEntry) => {
      const arr = data[key]
      if (Array.isArray(arr)) updateGoalsField(personaId, key, [...arr, ''])
    }
    const removeItem = (key: keyof GoalsEntry, idx: number) => {
      const arr = data[key]
      if (Array.isArray(arr)) updateGoalsField(personaId, key, arr.filter((_: string, i: number) => i !== idx))
    }
    const updateItem = (key: keyof GoalsEntry, idx: number, value: string) => {
      const arr = data[key]
      if (Array.isArray(arr)) {
        const next = [...arr]
        next[idx] = value
        updateGoalsField(personaId, key, next)
      }
    }

    return (
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5 space-y-6">
          <ListSection label="主な目標" items={data.primary_goals} fieldKey="primary_goals" placeholder="例: 自社ブランドの認知度を高めたい" onAdd={addItem} onRemove={removeItem} onUpdate={updateItem} />
          <ListSection label="課題・悩み" items={data.challenges} fieldKey="challenges" placeholder="例: ブランディングの知識が不足している" onAdd={addItem} onRemove={removeItem} onUpdate={updateItem} />
          <ListSection label="ペインポイント" items={data.pain_points} fieldKey="pain_points" placeholder="例: 予算が限られている" onAdd={addItem} onRemove={removeItem} onUpdate={updateItem} />
          <div>
            <label className="text-sm font-bold text-gray-700 mb-2 block">購買の動機</label>
            <Textarea value={data.buying_motivation} onChange={e => updateGoalsField(personaId, 'buying_motivation', e.target.value)} placeholder="何がきっかけで商品・サービスを検討するか" rows={2} className="text-sm" />
          </div>
          <ListSection label="購買の障壁" items={data.buying_barriers} fieldKey="buying_barriers" placeholder="例: 費用対効果が見えにくい" onAdd={addItem} onRemove={removeItem} onUpdate={updateItem} />
          <ListSection label="意思決定の要因" items={data.decision_factors} fieldKey="decision_factors" placeholder="例: 実績・事例の豊富さ" onAdd={addItem} onRemove={removeItem} onUpdate={updateItem} />
          <div>
            <label className="text-sm font-bold text-gray-700 mb-2 block">ブランドへの期待</label>
            <Textarea value={data.brand_expectations} onChange={e => updateGoalsField(personaId, 'brand_expectations', e.target.value)} placeholder="このブランドにどんな価値を期待するか" rows={2} className="text-sm" />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-700 mb-2 block">成功の定義</label>
            <Textarea value={data.success_definition} onChange={e => updateGoalsField(personaId, 'success_definition', e.target.value)} placeholder="この人にとっての「成功」とは" rows={2} className="text-sm" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Step 3: ゴール・課題</h1>
      <p className="mb-5 text-[13px] text-muted-foreground">
        {isSingle
          ? `${firstPersona.name}が抱える目標・課題・購買行動を定義します`
          : 'ペルソナごとの目標・課題・購買行動を定義します'}
      </p>

      {!isLoading && (
        <div className="flex justify-start mb-3">
          <Button variant="outline" size="sm" onClick={handleRegenerate} className="gap-1.5 text-xs">
            <WandSparkles className="h-3.5 w-3.5" />
            {currentGoals.primary_goals?.length > 0 ? 'AIに再提案してもらう' : 'AIに提案してもらう'}
          </Button>
        </div>
      )}

      {aiError && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 mb-4">
          {aiError}
          <button onClick={() => fetchAISuggestion(activeTab)} className="ml-2 font-medium underline hover:no-underline">再試行</button>
        </div>
      )}

      {!isSingle && personas.length > 1 ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            {personas.map(p => (
              <TabsTrigger key={p.candidate_id} value={p.candidate_id}>
                {p.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {personas.map(p => (
            <TabsContent key={p.candidate_id} value={p.candidate_id}>
              {renderGoalsForm(p.candidate_id)}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        renderGoalsForm(firstPersona.candidate_id)
      )}

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
            <AlertDialogAction onClick={() => fetchAISuggestion(activeTab)}>OK</AlertDialogAction>
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
  fieldKey: keyof GoalsEntry
  placeholder: string
  onAdd: (key: keyof GoalsEntry) => void
  onRemove: (key: keyof GoalsEntry, idx: number) => void
  onUpdate: (key: keyof GoalsEntry, idx: number, value: string) => void
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
