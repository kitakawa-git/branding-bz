'use client'

// Step 4: ジャーニーマップ（AI生成＋編集）
import { useState, useCallback, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, ArrowRight, WandSparkles, Plus, X, Smile, Meh, Frown, SmilePlus, Angry } from 'lucide-react'
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

interface JourneyStage {
  name: string
  description: string
  actions: string[]
  touchpoints: string[]
  emotions: string
  emotion_score: number
  pain_points: string[]
  opportunities: string[]
}

interface JourneyData {
  stages: JourneyStage[]
}

interface Step4Props {
  journey: JourneyData
  basicInfo: { company_name: string; industry_category: string; products: string; [key: string]: unknown }
  demographics: { persona_name: string; age: number | string; gender: string; occupation: string; company_role: string; media_channels: string[]; [key: string]: unknown }
  goals: { primary_goals: string[]; challenges: string[]; buying_motivation: string; buying_barriers: string[]; [key: string]: unknown }
  onNext: (data: JourneyData) => Promise<boolean>
  onBack: () => void
  onSaveField: (data: JourneyData) => Promise<void>
}

const STAGE_COLORS = [
  'border-blue-200 bg-blue-50',
  'border-green-200 bg-green-50',
  'border-amber-200 bg-amber-50',
  'border-purple-200 bg-purple-50',
  'border-rose-200 bg-rose-50',
]

const EMOTION_ICONS = [
  { score: -2, icon: Angry, label: '非常にネガティブ', color: 'text-red-500' },
  { score: -1, icon: Frown, label: 'ネガティブ', color: 'text-orange-500' },
  { score: 0, icon: Meh, label: '普通', color: 'text-gray-500' },
  { score: 1, icon: Smile, label: 'ポジティブ', color: 'text-green-500' },
  { score: 2, icon: SmilePlus, label: '非常にポジティブ', color: 'text-emerald-500' },
]

export function Step4Journey({ journey, basicInfo, demographics, goals, onNext, onBack, onSaveField }: Step4Props) {
  const [data, setData] = useState<JourneyData>(
    journey?.stages?.length > 0 ? journey : { stages: [] }
  )
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aiRequestedRef = useRef(false)

  const triggerAutoSave = useCallback((d: JourneyData) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { onSaveField(d) }, 1000)
  }, [onSaveField])

  const updateStage = useCallback((idx: number, updater: (stage: JourneyStage) => JourneyStage) => {
    setData(prev => {
      const next = {
        stages: prev.stages.map((s, i) => i === idx ? updater(s) : s),
      }
      triggerAutoSave(next)
      return next
    })
  }, [triggerAutoSave])

  const fetchAISuggestion = useCallback(async () => {
    setAiLoading(true)
    setAiError('')
    try {
      const res = await fetch('/api/tools/persona/suggest-journey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basic_info: basicInfo, demographics, goals }),
      })
      if (!res.ok) {
        const d = await res.json()
        setAiError(d.error || 'AI提案の取得に失敗しました')
        return
      }
      const { journey: suggested } = await res.json()
      setData(suggested)
      triggerAutoSave(suggested)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setAiLoading(false)
    }
  }, [basicInfo, demographics, goals, triggerAutoSave])

  useEffect(() => {
    if (data.stages.length === 0 && !aiRequestedRef.current) {
      aiRequestedRef.current = true
      fetchAISuggestion()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  const handleRegenerate = () => {
    if (data.stages.length > 0) { setConfirmOpen(true); return }
    fetchAISuggestion()
  }

  const handleNext = async () => {
    setSaving(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const success = await onNext(data)
    if (!success) setSaving(false)
  }

  // リスト操作ヘルパー
  const addListItem = (stageIdx: number, key: 'actions' | 'touchpoints' | 'pain_points' | 'opportunities') => {
    updateStage(stageIdx, s => ({ ...s, [key]: [...(s[key] || []), ''] }))
  }
  const removeListItem = (stageIdx: number, key: 'actions' | 'touchpoints' | 'pain_points' | 'opportunities', itemIdx: number) => {
    updateStage(stageIdx, s => ({ ...s, [key]: (s[key] || []).filter((_, i) => i !== itemIdx) }))
  }
  const updateListItem = (stageIdx: number, key: 'actions' | 'touchpoints' | 'pain_points' | 'opportunities', itemIdx: number, value: string) => {
    updateStage(stageIdx, s => {
      const arr = [...(s[key] || [])]
      arr[itemIdx] = value
      return { ...s, [key]: arr }
    })
  }

  if (aiLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-6">Step 4: ジャーニーマップ</h1>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="rounded-xl border bg-white p-5">
              <Skeleton className="mb-3 h-6 w-24" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
          <p className="text-center text-sm text-gray-400">
            {demographics.persona_name || 'ペルソナ'}のジャーニーマップを生成中...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Step 4: ジャーニーマップ</h1>
      <p className="mb-5 text-[13px] text-muted-foreground">
        {demographics.persona_name || 'ペルソナ'}の認知から継続までの5段階を可視化します
      </p>

      {!aiLoading && (
        <div className="flex justify-start mb-3">
          <Button variant="outline" size="sm" onClick={handleRegenerate} className="gap-1.5 text-xs">
            <WandSparkles className="h-3.5 w-3.5" />
            {data.stages.length > 0 ? 'AIに再提案してもらう' : 'AIに提案してもらう'}
          </Button>
        </div>
      )}

      {aiError && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 mb-4">
          {aiError}
          <button onClick={fetchAISuggestion} className="ml-2 font-medium underline hover:no-underline">再試行</button>
        </div>
      )}

      {/* 感情スコアグラフ（ミニ） */}
      {data.stages.length > 0 && (
        <div className="mb-6 rounded-xl border bg-white p-4">
          <h3 className="text-xs font-bold text-gray-500 mb-3">感情の推移</h3>
          <div className="flex items-end justify-between gap-1 h-20">
            {data.stages.map((stage, idx) => {
              const score = stage.emotion_score ?? 0
              const height = ((score + 2) / 4) * 100
              const emotionInfo = EMOTION_ICONS.find(e => e.score === score) || EMOTION_ICONS[2]
              const Icon = emotionInfo.icon
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <Icon className={`h-4 w-4 ${emotionInfo.color}`} />
                  <div className="w-full bg-gray-100 rounded-t-sm relative" style={{ height: '60px' }}>
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-t-sm transition-all"
                      style={{
                        height: `${Math.max(height, 10)}%`,
                        backgroundColor: score >= 1 ? '#10b981' : score >= 0 ? '#6b7280' : score >= -1 ? '#f97316' : '#ef4444',
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 text-center leading-tight">{stage.name}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ステージカード */}
      <div className="space-y-4">
        {data.stages.map((stage, stageIdx) => (
          <Card key={stageIdx} className={`border shadow-none ${STAGE_COLORS[stageIdx % STAGE_COLORS.length]}`}>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-white">
                  {stageIdx + 1}
                </span>
                <Input
                  value={stage.name}
                  onChange={e => updateStage(stageIdx, s => ({ ...s, name: e.target.value }))}
                  className="h-9 text-sm font-bold flex-1 bg-white/70"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">概要</label>
                <Input
                  value={stage.description}
                  onChange={e => updateStage(stageIdx, s => ({ ...s, description: e.target.value }))}
                  className="h-9 text-sm bg-white/70"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MiniList label="行動" items={stage.actions} stageIdx={stageIdx} fieldKey="actions" placeholder="行動" onAdd={addListItem} onRemove={removeListItem} onUpdate={updateListItem} />
                <MiniList label="タッチポイント" items={stage.touchpoints} stageIdx={stageIdx} fieldKey="touchpoints" placeholder="タッチポイント" onAdd={addListItem} onRemove={removeListItem} onUpdate={updateListItem} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">感情</label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={stage.emotions}
                      onChange={e => updateStage(stageIdx, s => ({ ...s, emotions: e.target.value }))}
                      className="h-9 text-sm bg-white/70 flex-1"
                    />
                    <div className="flex gap-0.5">
                      {EMOTION_ICONS.map(e => {
                        const Icon = e.icon
                        return (
                          <button
                            key={e.score}
                            onClick={() => updateStage(stageIdx, s => ({ ...s, emotion_score: e.score }))}
                            className={`rounded p-1 transition-colors ${stage.emotion_score === e.score ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                            title={e.label}
                          >
                            <Icon className={`h-4 w-4 ${e.color}`} />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MiniList label="この段階での課題" items={stage.pain_points} stageIdx={stageIdx} fieldKey="pain_points" placeholder="課題" onAdd={addListItem} onRemove={removeListItem} onUpdate={updateListItem} />
                <MiniList label="提供できる価値" items={stage.opportunities} stageIdx={stageIdx} fieldKey="opportunities" placeholder="施策" onAdd={addListItem} onRemove={removeListItem} onUpdate={updateListItem} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* フッターナビゲーション */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> 戻る
        </Button>
        <Button onClick={handleNext} disabled={saving || data.stages.length === 0} className="gap-1">
          {saving ? '保存中...' : '確認・出力へ'}
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

// ミニリスト入力
function MiniList({ label, items, stageIdx, fieldKey, placeholder, onAdd, onRemove, onUpdate }: {
  label: string
  items: string[]
  stageIdx: number
  fieldKey: 'actions' | 'touchpoints' | 'pain_points' | 'opportunities'
  placeholder: string
  onAdd: (stageIdx: number, key: 'actions' | 'touchpoints' | 'pain_points' | 'opportunities') => void
  onRemove: (stageIdx: number, key: 'actions' | 'touchpoints' | 'pain_points' | 'opportunities', itemIdx: number) => void
  onUpdate: (stageIdx: number, key: 'actions' | 'touchpoints' | 'pain_points' | 'opportunities', itemIdx: number, value: string) => void
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <div className="space-y-1">
        {(items || []).map((item, idx) => (
          <div key={idx} className="flex items-center gap-1">
            <Input value={item} onChange={e => onUpdate(stageIdx, fieldKey, idx, e.target.value)} placeholder={placeholder} className="h-8 text-xs bg-white/70 flex-1" />
            <button onClick={() => onRemove(stageIdx, fieldKey, idx)} className="rounded p-0.5 hover:bg-white/50">
              <X className="h-3 w-3 text-gray-400" />
            </button>
          </div>
        ))}
        <button onClick={() => onAdd(stageIdx, fieldKey)} className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700">
          <Plus className="h-3 w-3" /> 追加
        </button>
      </div>
    </div>
  )
}
