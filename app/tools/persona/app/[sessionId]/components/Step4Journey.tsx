'use client'

// Step 4: ジャーニーマップ（AI生成＋編集）— 複数ペルソナ対応
import { useState, useCallback, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

interface PersonaInfo {
  candidate_id: string
  name: string
  age: number
  gender: string
  occupation: string
  title: string
  [key: string]: unknown
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JourneyMapData = Record<string, any>

interface Step4Props {
  journey: JourneyMapData
  basicInfo: { company_name: string; industry_category: string; products: string; [key: string]: unknown }
  personas: PersonaInfo[]
  goals: Record<string, unknown>
  onNext: (data: JourneyMapData) => Promise<boolean>
  onBack: () => void
  onSaveField: (data: JourneyMapData) => Promise<void>
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

function getJourneyForPersona(journey: JourneyMapData, personaId: string, isSingle: boolean): JourneyData {
  if (isSingle) {
    return journey?.stages ? { stages: journey.stages as JourneyStage[] } : { stages: [] }
  }
  const pd = journey[personaId] as JourneyMapData | undefined
  return pd?.stages ? { stages: pd.stages as JourneyStage[] } : { stages: [] }
}

export function Step4Journey({ journey, basicInfo, personas, goals, onNext, onBack, onSaveField }: Step4Props) {
  const isSingle = personas.length <= 1
  const firstPersona = personas[0] || { candidate_id: '_default', name: 'ペルソナ' }

  const [journeyMap, setJourneyMap] = useState<Record<string, JourneyData>>(() => {
    const map: Record<string, JourneyData> = {}
    for (const p of personas) {
      map[p.candidate_id] = getJourneyForPersona(journey, p.candidate_id, isSingle)
    }
    if (personas.length === 0) {
      map['_default'] = journey?.stages ? { stages: journey.stages as JourneyStage[] } : { stages: [] }
    }
    return map
  })
  const [activeTab, setActiveTab] = useState(firstPersona.candidate_id)
  const [aiLoading, setAiLoading] = useState<string | null>(null)
  const [aiError, setAiError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aiRequestedRef = useRef<Set<string>>(new Set())

  const buildSaveData = useCallback((map: Record<string, JourneyData>): JourneyMapData => {
    if (isSingle) return map[firstPersona.candidate_id] || { stages: [] }
    return map
  }, [isSingle, firstPersona.candidate_id])

  const triggerAutoSave = useCallback((map: Record<string, JourneyData>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { onSaveField(buildSaveData(map)) }, 1000)
  }, [onSaveField, buildSaveData])

  const updateStage = useCallback((personaId: string, stageIdx: number, updater: (s: JourneyStage) => JourneyStage) => {
    setJourneyMap(prev => {
      const pj = prev[personaId] || { stages: [] }
      const next = {
        ...prev,
        [personaId]: {
          stages: pj.stages.map((s, i) => i === stageIdx ? updater(s) : s),
        },
      }
      triggerAutoSave(next)
      return next
    })
  }, [triggerAutoSave])

  // ペルソナ用のgoalsデータを取得
  const getGoalsForPersona = useCallback((personaId: string) => {
    if (isSingle) return goals
    return (goals as Record<string, unknown>)[personaId] || {}
  }, [goals, isSingle])

  // ペルソナ用のdemographics互換データを構築
  const getDemographicsForPersona = useCallback((personaId: string) => {
    const p = personas.find(x => x.candidate_id === personaId)
    return p ? {
      persona_name: p.name,
      age: p.age,
      gender: p.gender,
      occupation: p.occupation,
      company_role: p.title,
      media_channels: [],
    } : {}
  }, [personas])

  const fetchAISuggestion = useCallback(async (personaId: string) => {
    setAiLoading(personaId)
    setAiError('')
    try {
      const res = await fetch('/api/tools/persona/suggest-journey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basic_info: basicInfo,
          demographics: getDemographicsForPersona(personaId),
          goals: getGoalsForPersona(personaId),
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setAiError(d.error || 'AI提案の取得に失敗しました')
        return
      }
      const { journey: suggested } = await res.json()
      setJourneyMap(prev => {
        const next = { ...prev, [personaId]: suggested }
        triggerAutoSave(next)
        return next
      })
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setAiLoading(null)
    }
  }, [basicInfo, getDemographicsForPersona, getGoalsForPersona, triggerAutoSave])

  // 初回マウント: データがないペルソナはAI提案
  useEffect(() => {
    const firstEmpty = personas.find(p => {
      const j = journeyMap[p.candidate_id]
      return (!j || j.stages.length === 0) && !aiRequestedRef.current.has(p.candidate_id)
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
    const current = journeyMap[activeTab]
    if (current?.stages?.length > 0) { setConfirmOpen(true); return }
    fetchAISuggestion(activeTab)
  }

  const handleNext = async () => {
    setSaving(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const success = await onNext(buildSaveData(journeyMap))
    if (!success) setSaving(false)
  }

  const currentJourney = journeyMap[activeTab] || { stages: [] }
  const isLoading = aiLoading === activeTab

  // リスト操作ヘルパー
  const addListItem = (personaId: string, stageIdx: number, key: 'actions' | 'touchpoints' | 'pain_points' | 'opportunities') => {
    updateStage(personaId, stageIdx, s => ({ ...s, [key]: [...(s[key] || []), ''] }))
  }
  const removeListItem = (personaId: string, stageIdx: number, key: 'actions' | 'touchpoints' | 'pain_points' | 'opportunities', itemIdx: number) => {
    updateStage(personaId, stageIdx, s => ({ ...s, [key]: (s[key] || []).filter((_, i) => i !== itemIdx) }))
  }
  const updateListItem = (personaId: string, stageIdx: number, key: 'actions' | 'touchpoints' | 'pain_points' | 'opportunities', itemIdx: number, value: string) => {
    updateStage(personaId, stageIdx, s => {
      const arr = [...(s[key] || [])]
      arr[itemIdx] = value
      return { ...s, [key]: arr }
    })
  }

  const renderJourneyForm = (personaId: string) => {
    const data = journeyMap[personaId] || { stages: [] }
    const personaLoading = aiLoading === personaId
    const personaName = personas.find(p => p.candidate_id === personaId)?.name || 'ペルソナ'

    if (personaLoading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="rounded-xl border bg-white p-5">
              <Skeleton className="mb-3 h-6 w-24" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
          <p className="text-center text-sm text-gray-400">
            {personaName}のジャーニーマップを生成中...
          </p>
        </div>
      )
    }

    return (
      <>
        {/* 感情スコアグラフ */}
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
                    onChange={e => updateStage(personaId, stageIdx, s => ({ ...s, name: e.target.value }))}
                    className="h-9 text-sm font-bold flex-1 bg-white/70"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">概要</label>
                  <Input
                    value={stage.description}
                    onChange={e => updateStage(personaId, stageIdx, s => ({ ...s, description: e.target.value }))}
                    className="h-9 text-sm bg-white/70"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <MiniList label="行動" items={stage.actions} onAdd={() => addListItem(personaId, stageIdx, 'actions')} onRemove={(i) => removeListItem(personaId, stageIdx, 'actions', i)} onUpdate={(i, v) => updateListItem(personaId, stageIdx, 'actions', i, v)} />
                  <MiniList label="タッチポイント" items={stage.touchpoints} onAdd={() => addListItem(personaId, stageIdx, 'touchpoints')} onRemove={(i) => removeListItem(personaId, stageIdx, 'touchpoints', i)} onUpdate={(i, v) => updateListItem(personaId, stageIdx, 'touchpoints', i, v)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">感情</label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={stage.emotions}
                        onChange={e => updateStage(personaId, stageIdx, s => ({ ...s, emotions: e.target.value }))}
                        className="h-9 text-sm bg-white/70 flex-1"
                      />
                      <div className="flex gap-0.5">
                        {EMOTION_ICONS.map(e => {
                          const Icon = e.icon
                          return (
                            <button
                              key={e.score}
                              onClick={() => updateStage(personaId, stageIdx, s => ({ ...s, emotion_score: e.score }))}
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
                  <MiniList label="この段階での課題" items={stage.pain_points} onAdd={() => addListItem(personaId, stageIdx, 'pain_points')} onRemove={(i) => removeListItem(personaId, stageIdx, 'pain_points', i)} onUpdate={(i, v) => updateListItem(personaId, stageIdx, 'pain_points', i, v)} />
                  <MiniList label="提供できる価値" items={stage.opportunities} onAdd={() => addListItem(personaId, stageIdx, 'opportunities')} onRemove={(i) => removeListItem(personaId, stageIdx, 'opportunities', i)} onUpdate={(i, v) => updateListItem(personaId, stageIdx, 'opportunities', i, v)} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Step 4: ジャーニーマップ</h1>
      <p className="mb-5 text-[13px] text-muted-foreground">
        {isSingle
          ? `${firstPersona.name}の認知から継続までの5段階を可視化します`
          : 'ペルソナごとのジャーニーマップを可視化します'}
      </p>

      {!isLoading && (
        <div className="flex justify-start mb-3">
          <Button variant="outline" size="sm" onClick={handleRegenerate} className="gap-1.5 text-xs">
            <WandSparkles className="h-3.5 w-3.5" />
            {currentJourney.stages.length > 0 ? 'AIに再提案してもらう' : 'AIに提案してもらう'}
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
              {renderJourneyForm(p.candidate_id)}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        renderJourneyForm(firstPersona.candidate_id)
      )}

      {/* フッターナビゲーション */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> 戻る
        </Button>
        <Button onClick={handleNext} disabled={saving || currentJourney.stages.length === 0} className="gap-1">
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
            <AlertDialogAction onClick={() => fetchAISuggestion(activeTab)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ミニリスト入力
function MiniList({ label, items, onAdd, onRemove, onUpdate }: {
  label: string
  items: string[]
  onAdd: () => void
  onRemove: (idx: number) => void
  onUpdate: (idx: number, value: string) => void
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <div className="space-y-1">
        {(items || []).map((item, idx) => (
          <div key={idx} className="flex items-center gap-1">
            <Input value={item} onChange={e => onUpdate(idx, e.target.value)} placeholder={label} className="h-8 text-xs bg-white/70 flex-1" />
            <button onClick={() => onRemove(idx)} className="rounded p-0.5 hover:bg-white/50">
              <X className="h-3 w-3 text-gray-400" />
            </button>
          </div>
        ))}
        <button onClick={onAdd} className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700">
          <Plus className="h-3 w-3" /> 追加
        </button>
      </div>
    </div>
  )
}
