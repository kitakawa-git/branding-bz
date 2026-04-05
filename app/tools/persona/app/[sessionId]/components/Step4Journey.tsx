'use client'

// Step 4: ジャーニーマップ（AI生成＋編集）— 各ペルソナの個別ジャーニーを表示。総合版はStep 5へ移動済み
import { Fragment, useState, useCallback, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, ArrowRight, Plus, X, Smile, Meh, Frown, SmilePlus, Angry } from 'lucide-react'

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

// 総合ジャーニーマップの型
interface IntegratedStage {
  stage: string
  action: string
  emotion: 'positive' | 'neutral' | 'negative'
  emotion_score: number
  touchpoint: string
}

interface IntegratedPersona {
  candidate_id: string
  name: string
  stages: IntegratedStage[]
}

interface PersonaApproach {
  candidate_id: string
  name: string
  appeal_point: string
  channel: string
  barrier: string
  content: string
}

interface PriorityTouchpoint {
  rank: number
  touchpoint: string
  reason: string
}

interface IntegratedJourney {
  comparison_table: {
    stages: string[]
    personas: IntegratedPersona[]
  }
  core_message?: string
  persona_approaches?: PersonaApproach[]
  priority_touchpoints?: PriorityTouchpoint[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JourneyMapData = Record<string, any>

interface Step4Props {
  journey: JourneyMapData
  journeyStale?: boolean
  basicInfo: { company_name: string; industry_category: string; products: string; [key: string]: unknown }
  personas: PersonaInfo[]
  goals: Record<string, unknown>
  onNext: (data: JourneyMapData) => Promise<boolean>
  onBack: () => void
  onSaveField: (data: JourneyMapData) => Promise<void>
  onClearStale?: () => void
}

const STAGE_COLORS = [
  'border-blue-200 bg-blue-50',
  'border-green-200 bg-green-50',
  'border-amber-200 bg-amber-50',
  'border-purple-200 bg-purple-50',
  'border-rose-200 bg-rose-50',
]

// 感情アイコン（-5〜+5 の代表値5段階）
const EMOTION_ICONS = [
  { score: -4, icon: Angry, label: '非常にネガティブ', color: 'text-red-500' },
  { score: -2, icon: Frown, label: 'ネガティブ', color: 'text-orange-500' },
  { score: 0, icon: Meh, label: '普通', color: 'text-gray-500' },
  { score: 2, icon: Smile, label: 'ポジティブ', color: 'text-green-500' },
  { score: 4, icon: SmilePlus, label: '非常にポジティブ', color: 'text-emerald-500' },
]

function getEmotionIcon(score: number) {
  // 最も近いアイコンを返す
  let closest = EMOTION_ICONS[2]
  let minDist = Math.abs(score - closest.score)
  for (const e of EMOTION_ICONS) {
    const dist = Math.abs(score - e.score)
    if (dist < minDist) { closest = e; minDist = dist }
  }
  return closest
}

function getJourneyForPersona(journey: JourneyMapData, personaId: string, isSingle: boolean): JourneyData {
  if (isSingle) {
    return journey?.stages ? { stages: journey.stages as JourneyStage[] } : { stages: [] }
  }
  const pd = journey[personaId] as JourneyMapData | undefined
  return pd?.stages ? { stages: pd.stages as JourneyStage[] } : { stages: [] }
}

export function Step4Journey({ journey, journeyStale, basicInfo, personas, goals, onNext, onBack, onSaveField, onClearStale }: Step4Props) {
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
  const [aiLoading, setAiLoading] = useState<string | null>(null)
  const [aiError, setAiError] = useState('')
  const [saving, setSaving] = useState(false)
  const [integratedJourney, setIntegratedJourney] = useState<IntegratedJourney | null>(
    journey?.integrated_journey || null
  )
  const [integratedLoading, setIntegratedLoading] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aiRequestedRef = useRef<Set<string>>(new Set())

  const buildSaveData = useCallback((map: Record<string, JourneyData>, integrated?: IntegratedJourney | null): JourneyMapData => {
    if (isSingle) return map[firstPersona.candidate_id] || { stages: [] }
    const data: JourneyMapData = { ...map }
    if (integrated) data.integrated_journey = integrated
    return data
  }, [isSingle, firstPersona.candidate_id])

  const triggerAutoSave = useCallback((map: Record<string, JourneyData>, integrated?: IntegratedJourney | null) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { onSaveField(buildSaveData(map, integrated)) }, 1000)
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
      triggerAutoSave(next, integratedJourney)
      return next
    })
  }, [triggerAutoSave, integratedJourney])

  const getGoalsForPersona = useCallback((personaId: string) => {
    if (isSingle) return goals
    return (goals as Record<string, unknown>)[personaId] || {}
  }, [goals, isSingle])

  const getDemographicsForPersona = useCallback((personaId: string) => {
    const p = personas.find(x => x.candidate_id === personaId)
    return p ? {
      persona_name: p.name,
      age: p.age,
      gender: p.gender,
      occupation: p.occupation,
      company_role: p.title,
      personality: (p as Record<string, unknown>).personality || '',
      values: (p as Record<string, unknown>).values || '',
      challenges: (p as Record<string, unknown>).challenges || '',
      info_sources: (p as Record<string, unknown>).info_sources || '',
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
        triggerAutoSave(next, integratedJourney)
        return next
      })
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setAiLoading(null)
    }
  }, [basicInfo, getDemographicsForPersona, getGoalsForPersona, triggerAutoSave, integratedJourney])

  // 総合ジャーニーマップ生成
  const fetchIntegratedJourney = useCallback(async (currentMap: Record<string, JourneyData>) => {
    if (isSingle) return
    const allReady = personas.every(p => currentMap[p.candidate_id]?.stages?.length > 0)
    if (!allReady) return

    setIntegratedLoading(true)
    try {
      const personaJourneys = personas.map(p => ({
        candidate_id: p.candidate_id,
        name: p.name,
        stages: (currentMap[p.candidate_id]?.stages || []).map(s => ({
          name: s.name,
          actions: s.actions,
          touchpoints: s.touchpoints,
          emotion_score: s.emotion_score,
          emotions: s.emotions,
        })),
      }))

      const res = await fetch('/api/tools/persona/suggest-integrated-journey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basic_info: basicInfo, persona_journeys: personaJourneys }),
      })
      if (!res.ok) return

      const data = await res.json()
      const integrated: IntegratedJourney = {
        comparison_table: data.comparison_table,
        core_message: data.core_message,
        persona_approaches: data.persona_approaches,
        priority_touchpoints: data.priority_touchpoints,
      }
      setIntegratedJourney(integrated)
      triggerAutoSave(currentMap, integrated)
    } catch {
      // 総合ジャーニー生成エラーは致命的ではない
    } finally {
      setIntegratedLoading(false)
    }
  }, [isSingle, personas, basicInfo, triggerAutoSave])

  // 初回マウント: staleフラグ or ペルソナ変更 or 空データの検知
  useEffect(() => {
    // ペルソナIDの変更検知（選択ペルソナの増減）
    const currentIds = personas.map(p => p.candidate_id).sort()
    const journeyIds = Object.keys(journeyMap).filter(k => k !== '_default' && journeyMap[k]?.stages?.length > 0).sort()
    const personasChanged = currentIds.length !== journeyIds.length || !currentIds.every((id, i) => id === journeyIds[i])

    if (journeyStale || personasChanged) {
      // stale or ペルソナ変更 → 全ペルソナを再生成
      console.log('[Step4] ジャーニーマップ再生成:', journeyStale ? 'staleフラグ' : 'ペルソナ変更')
      // 既存データをクリア
      const freshMap: Record<string, JourneyData> = {}
      for (const p of personas) {
        freshMap[p.candidate_id] = { stages: [] }
      }
      setJourneyMap(freshMap)
      setIntegratedJourney(null)
      // staleフラグをクリア
      onClearStale?.()
      // 全ペルソナのAI提案を順次取得
      const fetchAll = async () => {
        for (const p of personas) {
          aiRequestedRef.current.add(p.candidate_id)
          await fetchAISuggestion(p.candidate_id)
        }
      }
      fetchAll()
    } else {
      // 通常: データがないペルソナのみAI提案
      const firstEmpty = personas.find(p => {
        const j = journeyMap[p.candidate_id]
        return (!j || j.stages.length === 0) && !aiRequestedRef.current.has(p.candidate_id)
      })
      if (firstEmpty) {
        aiRequestedRef.current.add(firstEmpty.candidate_id)
        fetchAISuggestion(firstEmpty.candidate_id)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 全ペルソナのジャーニーが揃ったら総合ジャーニーを自動生成
  useEffect(() => {
    if (isSingle) return
    const allReady = personas.every(p => journeyMap[p.candidate_id]?.stages?.length > 0)
    if (allReady && personas.length > 1) {
      // integratedJourney が null の場合、または stale で再生成された場合に生成
      if (!integratedJourney) {
        fetchIntegratedJourney(journeyMap)
      }
    }
  }, [journeyMap, personas, isSingle]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  const handleNext = async () => {
    setSaving(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const success = await onNext(buildSaveData(journeyMap, integratedJourney))
    if (!success) setSaving(false)
  }

  // バリデーション
  const hasJourney = personas.some(p => journeyMap[p.candidate_id]?.stages?.length > 0)

  // リスト操作ヘルパー
  const addListItem = (personaId: string, stageIdx: number, key: 'actions' | 'touchpoints' | 'pain_points' | 'opportunities') => {
    updateStage(personaId, stageIdx, s => ({ ...s, [key]: [...(s[key] || []), ''] }))
  }
  const removeListItem = (personaId: string, stageIdx: number, key: 'actions' | 'touchpoints' | 'pain_points' | 'opportunities', itemIdx: number) => {
    updateStage(personaId, stageIdx, s => ({ ...s, [key]: (s[key] || []).filter((_: string, i: number) => i !== itemIdx) }))
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
                const normalized = Math.max(-5, Math.min(5, score))
                const height = ((normalized + 5) / 10) * 100
                const emotionInfo = getEmotionIcon(normalized)
                const Icon = emotionInfo.icon
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <Icon className={`h-4 w-4 ${emotionInfo.color}`} />
                    <div className="w-full bg-gray-100 rounded-t-sm relative" style={{ height: '60px' }}>
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-t-sm transition-all"
                        style={{
                          height: `${Math.max(height, 5)}%`,
                          backgroundColor: normalized >= 2 ? '#10b981' : normalized >= 0 ? '#6b7280' : normalized >= -2 ? '#f97316' : '#ef4444',
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
                  <span className="text-sm font-bold flex-1 text-gray-900">
                    {stage.name}
                  </span>
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
                              title={`${e.label}（${e.score > 0 ? '+' : ''}${e.score}）`}
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

  // 総合ジャーニーマップ表示（Step 5 で使用中・Step 4 からは非表示）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const renderIntegratedJourney = () => {
    if (integratedLoading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <p className="text-center text-sm text-gray-400">総合分析を生成中...</p>
        </div>
      )
    }

    if (!integratedJourney) {
      return (
        <div className="rounded-lg border-2 border-dashed border-gray-200 py-8 text-center">
          <p className="text-sm text-gray-500">全ペルソナのジャーニーマップが揃うと、総合分析が自動生成されます</p>
        </div>
      )
    }

    const stages = integratedJourney.comparison_table.stages || []
    const cpPersonas = integratedJourney.comparison_table.personas || []
    const stageBgColors = ['bg-blue-50', 'bg-green-50', 'bg-amber-50', 'bg-purple-50', 'bg-rose-50']

    // ペルソナごとの色
    const personaColors = [
      { line: '#3b82f6', bg: 'rgba(59,130,246,0.15)', label: 'text-blue-600' },
      { line: '#f97316', bg: 'rgba(249,115,22,0.15)', label: 'text-orange-600' },
      { line: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', label: 'text-violet-600' },
      { line: '#10b981', bg: 'rgba(16,185,129,0.15)', label: 'text-emerald-600' },
      { line: '#ec4899', bg: 'rgba(236,72,153,0.15)', label: 'text-pink-600' },
    ]

    return (
      <Card className="border shadow-none bg-[hsl(0_0%_97%)]">
        <CardContent className="p-5 space-y-5">
          {/* 感情推移グラフ（全ペルソナ比較） */}
          {cpPersonas.length > 0 && stages.length > 0 && (
            <div className="bg-white rounded-lg border border-border p-5">
              <h3 className="text-xs font-bold text-gray-500 mb-4">感情の推移（ペルソナ比較）</h3>

              {/* グラフ本体: SVG */}
              <div className="overflow-x-auto">
                <div className="min-w-[500px]">
                  <svg viewBox="0 0 500 160" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
                    {/* 背景グリッド */}
                    {/* ゼロライン */}
                    <line x1="50" y1="80" x2="470" y2="80" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 2" />
                    {/* +5 ライン */}
                    <line x1="50" y1="16" x2="470" y2="16" stroke="#f3f4f6" strokeWidth="0.5" />
                    {/* -5 ライン */}
                    <line x1="50" y1="144" x2="470" y2="144" stroke="#f3f4f6" strokeWidth="0.5" />
                    {/* 軸ラベル */}
                    <text x="44" y="20" textAnchor="end" className="fill-gray-400" fontSize="9">+5</text>
                    <text x="44" y="84" textAnchor="end" className="fill-gray-400" fontSize="9">0</text>
                    <text x="44" y="148" textAnchor="end" className="fill-gray-400" fontSize="9">-5</text>

                    {/* ステージ区切り線 + ラベル */}
                    {stages.map((stage, sIdx) => {
                      const x = 50 + (420 / (stages.length - 1 || 1)) * sIdx
                      // stages.length === 1 の場合は中央に
                      const xPos = stages.length === 1 ? 260 : x
                      return (
                        <g key={sIdx}>
                          <line x1={xPos} y1="12" x2={xPos} y2="148" stroke="#f3f4f6" strokeWidth="0.5" />
                          <text x={xPos} y="158" textAnchor="middle" className="fill-gray-500" fontSize="9" fontWeight="600">
                            {stage}
                          </text>
                        </g>
                      )
                    })}

                    {/* 各ペルソナの折れ線 + ドット */}
                    {cpPersonas.map((cp, pIdx) => {
                      const color = personaColors[pIdx % personaColors.length]
                      const points = (cp.stages || []).map((cs, sIdx) => {
                        const x = stages.length === 1 ? 260 : 50 + (420 / (stages.length - 1)) * sIdx
                        // score -5〜+5 → y 144〜16
                        const score = Math.max(-5, Math.min(5, cs.emotion_score ?? 0))
                        const y = 80 - (score / 5) * 64
                        return { x, y, score }
                      })
                      const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

                      return (
                        <g key={pIdx}>
                          {/* 線 */}
                          <path d={pathD} fill="none" stroke={color.line} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
                          {/* ドット + スコア */}
                          {points.map((p, i) => (
                            <g key={i}>
                              <circle cx={p.x} cy={p.y} r="4" fill="white" stroke={color.line} strokeWidth="2" />
                              <text
                                x={p.x}
                                y={p.y - 8}
                                textAnchor="middle"
                                fontSize="8"
                                fontWeight="700"
                                fill={color.line}
                              >
                                {p.score > 0 ? '+' : ''}{p.score}
                              </text>
                            </g>
                          ))}
                        </g>
                      )
                    })}
                  </svg>
                </div>
              </div>

              {/* 凡例 */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 justify-center">
                {cpPersonas.map((cp, pIdx) => {
                  const color = personaColors[pIdx % personaColors.length]
                  return (
                    <div key={pIdx} className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-[3px] rounded-full" style={{ backgroundColor: color.line }} />
                      <span className="text-[11px] text-gray-600 font-medium">{cp.name}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 比較テーブル（CSS Grid: 行動/感情/TPの3行をサブ行で揃える） */}
          <div className="bg-white rounded-lg border border-border p-5">
            <div className="overflow-x-auto">
              <div
                className="text-xs min-w-[600px]"
                style={{ display: 'grid', gridTemplateColumns: `auto repeat(${stages.length}, 1fr)` }}
              >
                {/* ヘッダー行 */}
                <div className="px-3 py-2 border-b" />
                {stages.map((stage, idx) => (
                  <div key={idx} className={`px-3 py-2 text-center font-bold border-b ${stageBgColors[idx % 5]}`}>
                    {stage}
                  </div>
                ))}

                {/* 各ペルソナ: 3サブ行（行動 / 感情 / TP） */}
                {cpPersonas.map((cp, pIdx) => (
                  <Fragment key={pIdx}>
                    {/* 名前セル: 行動行に配置 */}
                    <div className="px-3 pt-3 pb-1 text-base font-bold text-gray-700 flex items-end">
                      {cp.name}
                    </div>
                    {/* 行動行 */}
                    {(cp.stages || []).map((cs, sIdx) => (
                      <div key={`action-${sIdx}`} className="px-3 pt-3 pb-1 text-sm font-medium text-gray-800">
                        {cs.action}
                      </div>
                    ))}
                    {/* 名前列: 感情行（空） */}
                    <div className="px-3 pt-1 pb-3" />
                    {/* 感情スコア行 */}
                    {(cp.stages || []).map((cs, sIdx) => {
                      const emotionColor = cs.emotion === 'positive'
                        ? 'text-green-600 bg-green-50'
                        : cs.emotion === 'negative'
                        ? 'text-red-600 bg-red-50'
                        : 'text-gray-600 bg-gray-50'
                      const emotionEmoji = cs.emotion === 'positive' ? '😊' : cs.emotion === 'negative' ? '😟' : '😐'
                      return (
                        <div key={`emotion-${sIdx}`} className="px-3 pt-1 pb-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm ${emotionColor}`}>
                            {emotionEmoji} {cs.emotion_score > 0 ? '+' : ''}{cs.emotion_score}
                          </span>
                        </div>
                      )
                    })}
                    {/* 名前列: タッチポイントラベル */}
                    <div className="px-3 pb-3 text-xs font-bold text-gray-400 border-b border-gray-100 flex items-start">
                      タッチポイント
                    </div>
                    {/* タッチポイント行 */}
                    {(cp.stages || []).map((cs, sIdx) => (
                      <div key={`tp-${sIdx}`} className="px-3 pb-3 text-xs text-muted-foreground border-b border-gray-100">
                        {cs.touchpoint}
                      </div>
                    ))}
                  </Fragment>
                ))}

                {/* 総合タッチポイントまとめ */}
                <div className="px-3 py-3 text-sm font-bold text-gray-900 bg-gray-100 border-t-2 border-gray-300 flex items-center">
                  総合タッチポイント
                </div>
                {stages.map((_, sIdx) => {
                  const allTps = cpPersonas
                    .map(cp => (cp.stages || [])[sIdx]?.touchpoint)
                    .filter(Boolean)
                  // 重複を除いてまとめる
                  const uniqueTps = [...new Set(allTps)]
                  return (
                    <div key={`summary-tp-${sIdx}`} className="px-3 py-3 text-xs text-gray-700 bg-gray-100 border-t-2 border-gray-300">
                      {uniqueTps.map((tp, i) => (
                        <p key={i} className="leading-relaxed">• {tp}</p>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

        </CardContent>
      </Card>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Step 4: ジャーニーマップ</h1>
      <p className="mb-5 text-[13px] text-muted-foreground">
        {isSingle
          ? `${firstPersona.name}の認知から継続までの5段階を可視化します`
          : '各ペルソナのカスタマージャーニーをご確認ください。'}
      </p>

      {/* 単一ペルソナ */}
      {isSingle ? (
        <>
          {aiError && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 mb-4">
              {aiError}
              <button onClick={() => fetchAISuggestion(firstPersona.candidate_id)} className="ml-2 font-medium underline hover:no-underline">再試行</button>
            </div>
          )}

          {renderJourneyForm(firstPersona.candidate_id)}

          {/* フッター */}
          <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex items-center justify-between">
            <Button variant="outline" onClick={onBack} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> 戻る
            </Button>
            <Button onClick={handleNext} disabled={saving || !hasJourney} className="gap-1">
              {saving ? '保存中...' : '確認へ'}
              {!saving && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </>
      ) : (
        <>
          {aiError && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 mb-4">
              {aiError}
            </div>
          )}

          {/* 各ペルソナの個別ジャーニー（総合版はStep 5へ移動） */}
          <div className="flex flex-col gap-6">
            {personas.map(p => (
              <div
                key={p.candidate_id}
                className="rounded-xl border border-gray-200 bg-[hsl(0_0%_97%)]"
              >
                {/* ヘッダー（読み取り専用） */}
                <div className="p-5">
                  <p className="text-lg font-bold text-foreground mb-0.5">
                    {p.name}（{p.age}歳・{p.gender}）
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {p.occupation} {p.title}
                  </p>
                </div>

                {/* フォーム部分 */}
                <div className="border-t border-gray-200 px-5 pb-5 pt-4">
                  {renderJourneyForm(p.candidate_id)}
                </div>
              </div>
            ))}
          </div>

          {/* フッター */}
          <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex items-center justify-between">
            <Button variant="outline" onClick={onBack} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> 戻る
            </Button>
            <Button onClick={handleNext} disabled={saving || !hasJourney} className="gap-1">
              {saving ? '保存中...' : '確認へ'}
              {!saving && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </>
      )}
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
