'use client'

// Step 5: 確認・出力（全ペルソナ一覧 + branding.bz連携）— 複数ペルソナ対応
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
  Link as LinkIcon,
  RotateCcw,
  Loader2,
  UserCircle,
  Target,
  Route,
  Smile,
  Meh,
  Frown,
  SmilePlus,
  Angry,
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
  { score: -2, icon: Angry, color: 'text-red-500' },
  { score: -1, icon: Frown, color: 'text-orange-500' },
  { score: 0, icon: Meh, color: 'text-gray-500' },
  { score: 1, icon: Smile, color: 'text-green-500' },
  { score: 2, icon: SmilePlus, color: 'text-emerald-500' },
]

const STAGE_COLORS = ['bg-blue-100', 'bg-green-100', 'bg-amber-100', 'bg-purple-100', 'bg-rose-100']

export function Step5Result({ sessionId, basicInfo, personas, goals, journey, companyId, onBack }: Step5Props) {
  const router = useRouter()
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [hasCompanyId, setHasCompanyId] = useState(!!companyId)

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

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Step 5: 確認・出力</h1>
      <p className="mb-6 text-[13px] text-muted-foreground">
        作成したペルソナとジャーニーマップを確認し、branding.bzに連携できます
      </p>

      {/* 全ペルソナを縦に並べて表示 */}
      {personas.map((persona, pIdx) => {
        const pGoals = getGoalsForPersona(persona.candidate_id)
        const pJourney = getJourneyForPersona(persona.candidate_id)

        return (
          <div key={persona.candidate_id} className="mb-8">
            {!isSingle && (
              <h2 className="text-lg font-bold text-gray-900 mb-3">
                ペルソナ {pIdx + 1}: {persona.name}
              </h2>
            )}

            {/* ペルソナカード */}
            <Card className="border shadow-none mb-6">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                    <UserCircle className="h-8 w-8 text-gray-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{persona.name || '名前未設定'}</h2>
                    <p className="text-sm text-gray-500">
                      {persona.age ? `${persona.age}歳` : ''} {persona.gender} / {persona.occupation}
                      {persona.title ? ` / ${persona.title}` : ''}
                    </p>
                  </div>
                </div>

                {persona.catchcopy && (
                  <div className="mb-5 rounded-lg bg-gray-50 p-3 border-l-4 border-gray-300">
                    <p className="text-sm italic text-gray-600">「{persona.catchcopy}」</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <InfoItem label="居住地" value={persona.location} />
                  <InfoItem label="年収" value={persona.income} />
                  <InfoItem label="家族構成" value={persona.family} />
                  <InfoItem label="趣味・関心" value={persona.hobbies} />
                  <InfoItem label="情報収集" value={persona.info_sources} />
                </div>

                {persona.keywords?.length > 0 && (
                  <div className="mt-4">
                    <span className="text-xs font-bold text-gray-500 mb-1 block">キーワード</span>
                    <div className="flex flex-wrap gap-1.5">
                      {persona.keywords.map((k, i) => (
                        <span key={i} className="rounded-full bg-blue-50 border border-blue-100 px-2.5 py-0.5 text-xs text-blue-700">#{k}</span>
                      ))}
                    </div>
                  </div>
                )}

                {persona.personality && (
                  <div className="mt-4">
                    <span className="text-xs font-bold text-gray-500 mb-1 block">性格</span>
                    <p className="text-sm text-gray-600">{persona.personality}</p>
                  </div>
                )}
                {persona.values && (
                  <div className="mt-3">
                    <span className="text-xs font-bold text-gray-500 mb-1 block">価値観</span>
                    <p className="text-sm text-gray-600">{persona.values}</p>
                  </div>
                )}
                {persona.daily_routine && (
                  <div className="mt-3">
                    <span className="text-xs font-bold text-gray-500 mb-1 block">1日の過ごし方</span>
                    <p className="text-sm text-gray-600">{persona.daily_routine}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ゴール・課題 */}
            <Card className="border shadow-none mb-6">
              <CardContent className="p-6">
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
              </CardContent>
            </Card>

            {/* ジャーニーマップ */}
            {pJourney.stages?.length > 0 && (
              <Card className="border shadow-none mb-6">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Route className="h-5 w-5 text-gray-600" />
                    <h3 className="text-lg font-bold text-gray-900">カスタマージャーニーマップ</h3>
                  </div>

                  {/* 感情グラフ */}
                  <div className="mb-6 flex items-end justify-between gap-1 h-16">
                    {pJourney.stages.map((stage, idx) => {
                      const score = stage.emotion_score ?? 0
                      const height = ((score + 2) / 4) * 100
                      const emotionInfo = EMOTION_ICONS.find(e => e.score === score) || EMOTION_ICONS[2]
                      const Icon = emotionInfo.icon
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                          <Icon className={`h-3.5 w-3.5 ${emotionInfo.color}`} />
                          <div className="w-full bg-gray-100 rounded-t-sm relative" style={{ height: '40px' }}>
                            <div
                              className="absolute bottom-0 left-0 right-0 rounded-t-sm"
                              style={{
                                height: `${Math.max(height, 10)}%`,
                                backgroundColor: score >= 1 ? '#10b981' : score >= 0 ? '#6b7280' : score >= -1 ? '#f97316' : '#ef4444',
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-500 text-center">{stage.name}</span>
                        </div>
                      )
                    })}
                  </div>

                  {/* ステージ概要テーブル */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
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
                </CardContent>
              </Card>
            )}
          </div>
        )
      })}

      {/* アクションボタン */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {!connected ? (
          <Button onClick={handleConnect} disabled={connecting} className="gap-2 flex-1">
            {connecting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> 連携中...</>
            ) : (
              <><LinkIcon className="h-4 w-4" /> branding.bz に連携</>
            )}
          </Button>
        ) : (
          <Button variant="outline" onClick={handleNewSession} className="gap-2 flex-1">
            <RotateCcw className="h-4 w-4" /> 新しいペルソナを作成
          </Button>
        )}
      </div>

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
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div>
      <span className="text-xs font-bold text-gray-500">{label}</span>
      <p className="text-sm text-gray-700">{value}</p>
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
