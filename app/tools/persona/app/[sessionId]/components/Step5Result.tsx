'use client'

// Step 5: 確認・出力（全ペルソナ一覧 + branding.bz連携）— 複数ペルソナ対応
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ToolExportActions } from '@/components/shared/ToolExportActions'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
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
import {
  ArrowLeft,
  UserCircle,
  Target,
  Route,
  Smile,
  Meh,
  Frown,
  SmilePlus,
  Angry,
  ClipboardList,
  Flag,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react'

interface PersonaDetail {
  candidate_id: string
  name: string
  age: number
  gender: string
  occupation: string
  title: string
  catchcopy: string
  keywords: string[]
  income: string
  location: string
  family: string
  hobbies: string
  info_sources: string
  personality: string
  values: string
  daily_routine: string
  challenges: string
}

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

interface BasicInfo {
  company_name: string
  industry_category: string
  industry_subcategory: string
  products: string
  target_description: string
}

interface Step5Props {
  sessionId: string
  basicInfo: BasicInfo
  personas: PersonaDetail[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  goals: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  journey: Record<string, any>
  companyId: string | null
  onBack: () => void
}

const EMOTION_ICONS = [
  { score: -4, icon: Angry, color: 'text-red-500' },
  { score: -2, icon: Frown, color: 'text-orange-500' },
  { score: 0, icon: Meh, color: 'text-gray-500' },
  { score: 2, icon: Smile, color: 'text-green-500' },
  { score: 4, icon: SmilePlus, color: 'text-emerald-500' },
]

function getEmotionIcon(score: number) {
  let closest = EMOTION_ICONS[2]
  let minDist = Math.abs(score - closest.score)
  for (const e of EMOTION_ICONS) {
    const dist = Math.abs(score - e.score)
    if (dist < minDist) { closest = e; minDist = dist }
  }
  return closest
}

const STAGE_COLORS = ['bg-blue-100', 'bg-green-100', 'bg-amber-100', 'bg-purple-100', 'bg-rose-100']

export function Step5Result({ sessionId, basicInfo, personas, goals, journey, companyId, onBack }: Step5Props) {
  const router = useRouter()
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [hasCompanyId, setHasCompanyId] = useState(!!companyId)
  const [expandedPersonas, setExpandedPersonas] = useState<Record<string, boolean>>({})

  const toggleExpand = (candidateId: string) => {
    setExpandedPersonas(prev => ({ ...prev, [candidateId]: !prev[candidateId] }))
  }

  const isSingle = personas.length <= 1

  // ペルソナごとのgoals取得
  const getGoalsForPersona = (personaId: string): GoalsEntry => {
    const empty: GoalsEntry = { primary_goals: [], challenges: [], pain_points: [], buying_motivation: '', buying_barriers: [], decision_factors: [], brand_expectations: '', success_definition: '' }
    if (isSingle) return { ...empty, ...goals }
    return { ...empty, ...(goals[personaId] || {}) }
  }

  // ペルソナごとのjourney取得
  const getJourneyForPersona = (personaId: string): JourneyData => {
    if (isSingle) return journey?.stages ? journey as JourneyData : { stages: [] }
    const pj = journey[personaId]
    return pj?.stages ? pj : { stages: [] }
  }

  // branding.bz連携
  const connectToBrandingBz = useCallback(async () => {
    setConnecting(true)
    try {
      let cid = companyId
      if (!cid) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { toast.error('ログインが必要です'); return }
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('company_id')
          .eq('auth_id', user.id)
          .maybeSingle()
        if (!adminUser?.company_id) {
          toast.error('branding.bz本体のアカウントが必要です。管理画面から企業登録してください。')
          setConnecting(false)
          return
        }
        cid = adminUser.company_id
        setHasCompanyId(true)
      }

      const res = await fetch('/api/tools/persona/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, companyId: cid }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || '連携に失敗しました')
        return
      }

      setConnected(true)
      toast.success('ペルソナをbranding.bzに連携しました')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '連携中にエラーが発生しました')
    } finally {
      setConnecting(false)
    }
  }, [sessionId, companyId])

  const handleConnect = () => { setConfirmOpen(true) }
  const handleNewSession = () => { router.push('/tools/persona/app') }
  const handleExportPdf = () => { toast.info('PDF出力機能は準備中です') }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Step 5: 確認・出力</h1>
      <p className="mb-6 text-[13px] text-muted-foreground">
        作成したペルソナとジャーニーマップを確認し、branding.bzに連携できます
      </p>

      {/* 全ペルソナを1つのグレーカード内に並べて表示 */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-8">
        <CardContent className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">ペルソナ一覧</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        {personas.map((persona) => {
          const pGoals = getGoalsForPersona(persona.candidate_id)

          return (
                <div key={persona.candidate_id} className={`relative bg-white rounded-lg border border-border p-5 flex flex-col${expandedPersonas[persona.candidate_id] ? ' md:col-span-2' : ''}`}>
                  {expandedPersonas[persona.candidate_id] && (
                    <button
                      type="button"
                      onClick={() => toggleExpand(persona.candidate_id)}
                      aria-label="閉じる"
                      className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <div className="flex-1">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                      <UserCircle className="h-8 w-8 text-gray-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{persona.name || '名前未設定'}</h3>
                      <p className="text-sm text-gray-500">
                        {persona.age ? `${persona.age}歳` : ''} {persona.gender} / {persona.occupation}
                        {persona.title ? ` / ${persona.title}` : ''}
                      </p>
                    </div>
                  </div>

                  {persona.catchcopy && (
                    <div className="mb-5 rounded-lg bg-gray-50 p-3 border-l-4 border-gray-300">
                      <p className={`text-sm italic text-gray-600${!expandedPersonas[persona.candidate_id] ? ' line-clamp-2' : ''}`}>「{persona.catchcopy}」</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <InfoItem label="居住地" value={persona.location} clamp={!expandedPersonas[persona.candidate_id]} />
                    <InfoItem label="年収" value={persona.income} clamp={!expandedPersonas[persona.candidate_id]} />
                    <InfoItem label="家族構成" value={persona.family} clamp={!expandedPersonas[persona.candidate_id]} />
                    <InfoItem label="趣味・関心" value={persona.hobbies} clamp={!expandedPersonas[persona.candidate_id]} />
                    <InfoItem label="情報収集" value={persona.info_sources} clamp={!expandedPersonas[persona.candidate_id]} />
                  </div>

                  {expandedPersonas[persona.candidate_id] && (persona.personality || persona.values || persona.daily_routine) && (
                    <div className="mt-4 space-y-3">
                      {persona.personality && (
                        <div>
                          <span className="text-xs font-bold text-gray-500 mb-1 block">性格</span>
                          <p className="text-sm text-gray-600">{persona.personality}</p>
                        </div>
                      )}
                      {persona.values && (
                        <div>
                          <span className="text-xs font-bold text-gray-500 mb-1 block">価値観</span>
                          <p className="text-sm text-gray-600">{persona.values}</p>
                        </div>
                      )}
                      {persona.daily_routine && (
                        <div>
                          <span className="text-xs font-bold text-gray-500 mb-1 block">1日の過ごし方</span>
                          <p className="text-sm text-gray-600">{persona.daily_routine}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ゴール・課題（展開時のみ表示） */}
                  {expandedPersonas[persona.candidate_id] && (
                    <>
                      <Separator className="my-6" />
                      <div className="flex items-center gap-2 mb-4">
                        <Target className="h-5 w-5 text-gray-600" />
                        <h3 className="text-lg font-bold text-gray-900">ゴール・課題</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <TagList label="主な目標" items={pGoals.primary_goals} color="blue" />
                        <TagList label="課題・悩み" items={pGoals.challenges} color="red" />
                        <TagList label="ペインポイント" items={pGoals.pain_points} color="orange" />
                        <TagList label="意思決定要因" items={pGoals.decision_factors} color="green" />
                        <TagList label="購買の障壁" items={pGoals.buying_barriers} color="amber" />
                      </div>
                      {pGoals.buying_motivation && (
                        <div className="mt-4">
                          <span className="text-xs font-bold text-gray-500 mb-1 block">購買の動機</span>
                          <p className="text-sm text-gray-600">{pGoals.buying_motivation}</p>
                        </div>
                      )}
                      {pGoals.brand_expectations && (
                        <div className="mt-3">
                          <span className="text-xs font-bold text-gray-500 mb-1 block">ブランドへの期待</span>
                          <p className="text-sm text-gray-600">{pGoals.brand_expectations}</p>
                        </div>
                      )}
                      {pGoals.success_definition && (
                        <div className="mt-3">
                          <span className="text-xs font-bold text-gray-500 mb-1 block">成功の定義</span>
                          <p className="text-sm text-gray-600">{pGoals.success_definition}</p>
                        </div>
                      )}
                    </>
                  )}

                  </div>
                  <div className="mt-auto pt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpand(persona.candidate_id)}
                      className="text-muted-foreground text-sm gap-1 h-auto py-1 px-2"
                    >
                      {expandedPersonas[persona.candidate_id] ? (
                        <><ChevronUp className="h-4 w-4" /> 閉じる</>
                      ) : (
                        <><ChevronDown className="h-4 w-4" /> もっと見る</>
                      )}
                    </Button>
                  </div>
                </div>
          )
        })}
          </div>
        </CardContent>
      </Card>

      {/* 総合分析（ジャーニー保有ペルソナが1人以上いる場合） */}
      {personas.some(p => getJourneyForPersona(p.candidate_id).stages?.length > 0) && (() => {
        const ij = journey?.integrated_journey || {}
        const stages: string[] = ij.comparison_table?.stages || []
        const cpPersonas: Array<{ name: string; stages: Array<{ action: string; emotion: string; emotion_score: number; touchpoint: string }> }> = ij.comparison_table?.personas || []
        const personaApproaches: Array<{ candidate_id: string; name: string; appeal_point: string; channel: string; barrier: string; content: string }> = ij.persona_approaches || []
        const priorityTouchpoints: Array<{ rank: number; touchpoint: string; reason: string }> = ij.priority_touchpoints || []
        const personaColors = [
          { line: '#3b82f6' },
          { line: '#f97316' },
          { line: '#8b5cf6' },
          { line: '#10b981' },
          { line: '#ec4899' },
        ]
        return (
          <div className="mb-8">
            <Card className="border shadow-none mb-6 bg-[hsl(0_0%_97%)]">
              <CardContent className="p-6 space-y-6">
                <h2 className="text-xl font-bold text-gray-900">総合分析</h2>
                {/* 感情推移グラフ（全ペルソナ比較） */}
                {cpPersonas.length > 0 && stages.length > 0 && (
                  <div className="bg-white rounded-lg border border-border p-5">
                    <h3 className="text-xs font-bold text-gray-500 mb-4">感情の推移（ペルソナ比較）</h3>
                    <div className="overflow-x-auto">
                      <div className="min-w-[500px]">
                        <svg viewBox="0 0 500 160" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
                          {/* 背景グリッド */}
                          <line x1="50" y1="80" x2="470" y2="80" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 2" />
                          <line x1="50" y1="16" x2="470" y2="16" stroke="#f3f4f6" strokeWidth="0.5" />
                          <line x1="50" y1="144" x2="470" y2="144" stroke="#f3f4f6" strokeWidth="0.5" />
                          <text x="44" y="20" textAnchor="end" className="fill-gray-400" fontSize="9">+5</text>
                          <text x="44" y="84" textAnchor="end" className="fill-gray-400" fontSize="9">0</text>
                          <text x="44" y="148" textAnchor="end" className="fill-gray-400" fontSize="9">-5</text>

                          {/* ステージ区切り線 + ラベル */}
                          {stages.map((stage, sIdx) => {
                            const x = 50 + (420 / (stages.length - 1 || 1)) * sIdx
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
                              const score = Math.max(-5, Math.min(5, cs.emotion_score ?? 0))
                              const y = 80 - (score / 5) * 64
                              return { x, y, score }
                            })
                            const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

                            return (
                              <g key={pIdx}>
                                <path d={pathD} fill="none" stroke={color.line} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
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

                {/* 各ペルソナの個別ジャーニーマップ */}
                {personas.map((persona) => {
                  const pJourney = getJourneyForPersona(persona.candidate_id)
                  if (!pJourney.stages?.length) return null
                  return (
                    <div key={persona.candidate_id} className="bg-white rounded-lg border border-border p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <Route className="h-5 w-5 text-gray-600" />
                        <h3 className="text-lg font-bold text-gray-900">{persona.name}のカスタマージャーニー</h3>
                      </div>

                      {/* 感情グラフ（テーブル列と幅を揃える） */}
                      <div
                        className="mb-2 grid"
                        style={{ gridTemplateColumns: `repeat(${pJourney.stages.length}, 1fr)` }}
                      >
                        {pJourney.stages.map((stage, idx) => {
                          const score = stage.emotion_score ?? 0
                          const normalized = Math.max(-5, Math.min(5, score))
                          const height = ((normalized + 5) / 10) * 100
                          const emotionInfo = getEmotionIcon(normalized)
                          const Icon = emotionInfo.icon
                          return (
                            <div key={idx} className="px-2 flex flex-col items-center gap-1">
                              <Icon className={`h-3.5 w-3.5 ${emotionInfo.color}`} />
                              <div className="w-full bg-gray-100 rounded-t-sm relative" style={{ height: '40px' }}>
                                <div
                                  className="absolute bottom-0 left-0 right-0 rounded-t-sm"
                                  style={{
                                    height: `${Math.max(height, 5)}%`,
                                    backgroundColor: normalized >= 2 ? '#10b981' : normalized >= 0 ? '#6b7280' : normalized >= -2 ? '#f97316' : '#ef4444',
                                  }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* ステージ概要テーブル */}
                      <div>
                        <table className="w-full text-xs border-collapse table-fixed">
                          <thead>
                            <tr>
                              {pJourney.stages.map((stage, idx) => (
                                <th key={idx} className={`px-2 py-2 text-left font-bold border-b ${STAGE_COLORS[idx % STAGE_COLORS.length]}`}>
                                  {stage.name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              {pJourney.stages.map((stage, idx) => (
                                <td key={idx} className="px-2 py-2 align-top border-b border-gray-100">
                                  <div className="space-y-1">
                                    {stage.actions?.map((a, i) => (
                                      <p key={i} className="text-gray-600">• {a}</p>
                                    ))}
                                  </div>
                                </td>
                              ))}
                            </tr>
                            <tr>
                              {pJourney.stages.map((stage, idx) => (
                                <td key={idx} className="px-2 py-2 align-top border-b border-gray-100">
                                  <span className="text-[10px] font-bold text-gray-400 block mb-0.5">タッチポイント</span>
                                  {stage.touchpoints?.map((t, i) => (
                                    <p key={i} className="text-gray-600">• {t}</p>
                                  ))}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              {pJourney.stages.map((stage, idx) => (
                                <td key={idx} className="px-2 py-2 align-top">
                                  <span className="text-[10px] font-bold text-gray-400 block mb-0.5">施策</span>
                                  {stage.opportunities?.map((o, i) => (
                                    <p key={i} className="text-gray-600">• {o}</p>
                                  ))}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}

                {/* ペルソナ別アプローチ */}
                {personaApproaches.length > 0 && (
                  <div className="bg-white rounded-lg border border-border p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <ClipboardList className="h-5 w-5 text-purple-500" />
                      <h3 className="text-lg font-bold text-gray-900">ペルソナ別アプローチ</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse min-w-[600px]">
                        <thead>
                          <tr>
                            <th className="px-3 py-2 text-left font-bold text-gray-500 text-xs border-b border-gray-200 w-28"></th>
                            {personaApproaches.map((pa, idx) => (
                              <th key={idx} className="px-3 py-2 text-left font-bold text-gray-900 border-b border-gray-200">
                                {pa.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="px-3 py-3 text-xs font-bold text-gray-500 align-top border-b border-gray-100">訴求点</td>
                            {personaApproaches.map((pa, idx) => (
                              <td key={idx} className="px-3 py-3 text-sm text-gray-700 align-top border-b border-gray-100">{pa.appeal_point}</td>
                            ))}
                          </tr>
                          <tr>
                            <td className="px-3 py-3 text-xs font-bold text-gray-500 align-top border-b border-gray-100">チャネル</td>
                            {personaApproaches.map((pa, idx) => (
                              <td key={idx} className="px-3 py-3 text-sm text-gray-700 align-top border-b border-gray-100">{pa.channel}</td>
                            ))}
                          </tr>
                          <tr>
                            <td className="px-3 py-3 text-xs font-bold text-gray-500 align-top border-b border-gray-100">障壁</td>
                            {personaApproaches.map((pa, idx) => (
                              <td key={idx} className="px-3 py-3 text-sm text-gray-700 align-top border-b border-gray-100">{pa.barrier}</td>
                            ))}
                          </tr>
                          <tr>
                            <td className="px-3 py-3 text-xs font-bold text-gray-500 align-top">コンテンツ</td>
                            {personaApproaches.map((pa, idx) => (
                              <td key={idx} className="px-3 py-3 text-sm text-gray-700 align-top">{pa.content}</td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 優先タッチポイント */}
                {priorityTouchpoints.length > 0 && (
                  <div className="bg-white rounded-lg border border-border p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Flag className="h-5 w-5 text-green-600" />
                      <h3 className="text-lg font-bold text-gray-900">優先タッチポイント</h3>
                    </div>
                    <ol className="space-y-3">
                      {priorityTouchpoints.map((pt, idx) => (
                        <li key={idx} className="flex gap-3">
                          <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-green-50 border border-green-200 text-sm font-bold text-green-700">
                            {pt.rank}
                          </span>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 text-sm">{pt.touchpoint}</p>
                            <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{pt.reason}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* アクションボタン */}
                <ToolExportActions
                  onExportPdf={handleExportPdf}
                  onConnect={handleConnect}
                  onReset={() => setResetConfirmOpen(true)}
                  isExporting={false}
                  isConnecting={connecting}
                  isConnected={connected}
                />
              </CardContent>
            </Card>
          </div>
        )
      })()}

      {connected && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 mb-6">
          ペルソナをbranding.bzに連携しました。管理画面の「ブランド戦略」からペルソナを確認できます。
        </div>
      )}

      {/* フッターナビゲーション */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> 戻る
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>branding.bz に連携</AlertDialogTitle>
            <AlertDialogDescription>
              {personas.length > 1
                ? `${personas.map(p => p.name).join('、')}の${personas.length}人分のペルソナとジャーニーマップをbranding.bzに連携します。`
                : `ペルソナ「${personas[0]?.name || ''}」とジャーニーマップをbranding.bzに連携します。`}
              {!hasCompanyId && '（企業アカウントが必要です）'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={connectToBrandingBz}>連携する</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* やり直しの確認ダイアログ */}
      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>最初からやり直す</AlertDialogTitle>
            <AlertDialogDescription>
              現在のペルソナは保存されています。新しいペルソナを作成しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleNewSession}>やり直す</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function InfoItem({ label, value, clamp = false }: { label: string; value: string; clamp?: boolean }) {
  if (!value) return null
  return (
    <div>
      <span className="text-xs font-bold text-gray-500">{label}</span>
      <p className={`text-sm text-gray-700${clamp ? ' line-clamp-2' : ''}`}>{value}</p>
    </div>
  )
}

function TagList({ label, items, color }: { label: string; items: string[]; color: string }) {
  if (!items?.length) return null
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    red: 'bg-red-50 border-red-100 text-red-700',
    orange: 'bg-orange-50 border-orange-100 text-orange-700',
    green: 'bg-green-50 border-green-100 text-green-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
  }
  const cls = colorMap[color] || colorMap.blue
  return (
    <div>
      <span className="text-xs font-bold text-gray-500 mb-1 block">{label}</span>
      <div className="flex flex-wrap gap-1">
        {items.filter(i => i.trim()).map((item, idx) => (
          <span key={idx} className={`rounded-full border px-2 py-0.5 text-xs ${cls}`}>{item}</span>
        ))}
      </div>
    </div>
  )
}
