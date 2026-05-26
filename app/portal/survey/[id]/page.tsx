'use client'

// サーベイ回答ページ（ポータルメンバー向け・匿名回答）
import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { usePortalAuth } from '../../components/PortalDataProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react'

// 型定義
type Survey = {
  id: string
  title: string
  status: string
}

type Question = {
  id: string
  category: string
  question_text: string
  sort_order: number
  is_active: boolean
}

// カテゴリ表示名
const CATEGORY_LABELS: Record<string, string> = {
  why: '理念浸透（WHY）',
  how: '方針共感（HOW）',
  what: '行動体現（WHAT）',
}

// カテゴリ順序
const CATEGORY_ORDER = ['why', 'how', 'what']

// スコアラベル
const SCORE_LABELS: Record<number, string> = {
  1: 'まったく当てはまらない',
  2: 'あまり当てはまらない',
  3: 'どちらとも言えない',
  4: 'やや当てはまる',
  5: '非常に当てはまる',
}

// 画面状態
type PageState = 'loading' | 'form' | 'completed' | 'error'

export default function SurveyRespondPage() {
  const params = useParams()
  const router = useRouter()
  const { user, companyId } = usePortalAuth()
  const surveyId = params.id as string

  const [pageState, setPageState] = useState<PageState>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  // サーベイ・設問データ
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])

  // 回答者情報
  const [profileId, setProfileId] = useState<string | null>(null)
  const [department, setDepartment] = useState('')
  const [roleCategory, setRoleCategory] = useState('')

  // 回答データ: questionId → score
  const [answers, setAnswers] = useState<Map<string, number>>(new Map())

  // 送信中フラグ
  const [submitting, setSubmitting] = useState(false)

  // データ取得
  useEffect(() => {
    if (!user?.id || !companyId || !surveyId) return

    const fetchData = async () => {
      try {
        // 1. プロフィール情報を取得（profile_id, department）
        const { data: memberData, error: memberError } = await supabase
          .from('members')
          .select('*, profile:profiles(id, department, position)')
          .eq('auth_id', user.id)
          .eq('company_id', companyId)
          .eq('is_active', true)
          .single()

        if (memberError || !memberData) {
          setErrorMessage('メンバー情報の取得に失敗しました')
          setPageState('error')
          return
        }

        const profileRaw = memberData.profile as
          | { id: string; department: string; position: string }
          | { id: string; department: string; position: string }[]
          | null
        const profile = Array.isArray(profileRaw) ? profileRaw[0] ?? null : profileRaw

        if (!profile?.id) {
          setErrorMessage('プロフィール情報が見つかりません')
          setPageState('error')
          return
        }

        setProfileId(profile.id)
        setDepartment(profile.department || '')

        // 2. サーベイ情報 + 設問一覧を取得
        const res = await fetch(`/api/brand-score/surveys/${surveyId}`)
        if (!res.ok) {
          if (res.status === 404) {
            setErrorMessage('サーベイが見つかりません')
          } else {
            setErrorMessage('サーベイ情報の取得に失敗しました')
          }
          setPageState('error')
          return
        }

        const data = await res.json()
        const surveyData: Survey = data.survey
        const allQuestions: Question[] = data.questions || []

        // ステータスチェック
        if (surveyData.status !== 'active') {
          setErrorMessage('このサーベイは現在回答を受け付けていません')
          setPageState('error')
          return
        }

        // 3. 回答済みチェック（survey_participants）
        const { data: participant } = await supabase
          .from('survey_participants')
          .select('id, responded_at')
          .eq('survey_id', surveyId)
          .eq('profile_id', profile.id)
          .maybeSingle()

        if (!participant) {
          setErrorMessage('このサーベイの対象ではありません')
          setPageState('error')
          return
        }

        if (participant.responded_at) {
          setErrorMessage('このサーベイには回答済みです')
          setPageState('error')
          return
        }

        // 有効な設問のみフィルタ
        const activeQuestions = allQuestions.filter(q => q.is_active)
        setSurvey(surveyData)
        setQuestions(activeQuestions)
        setPageState('form')
      } catch (err) {
        console.error('[SurveyRespond] データ取得エラー:', err)
        setErrorMessage('データの取得に失敗しました')
        setPageState('error')
      }
    }

    fetchData()
  }, [user?.id, companyId, surveyId])

  // カテゴリ別にグループ化した設問
  const groupedQuestions = useMemo(() => {
    const groups: { category: string; label: string; questions: Question[] }[] = []
    for (const cat of CATEGORY_ORDER) {
      const qs = questions
        .filter(q => q.category === cat)
        .sort((a, b) => a.sort_order - b.sort_order)
      if (qs.length > 0) {
        groups.push({ category: cat, label: CATEGORY_LABELS[cat] || cat, questions: qs })
      }
    }
    return groups
  }, [questions])

  // 回答の進捗
  const answeredCount = answers.size
  const totalCount = questions.length
  const progressPercent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0
  const unansweredCount = totalCount - answeredCount
  const allAnswered = answeredCount === totalCount && totalCount > 0

  // スコア選択
  const handleScoreSelect = (questionId: string, score: number) => {
    setAnswers(prev => {
      const next = new Map(prev)
      next.set(questionId, score)
      return next
    })
  }

  // 送信
  const handleSubmit = async () => {
    if (!allAnswered || !profileId || !department.trim() || !roleCategory || submitting) return

    setSubmitting(true)
    try {
      const answersArray = Array.from(answers.entries()).map(([questionId, score]) => ({
        questionId,
        score,
      }))

      const res = await fetch(`/api/brand-score/surveys/${surveyId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: answersArray,
          department: department.trim(),
          roleCategory,
          profileId,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || `HTTP ${res.status}`)
      }

      setPageState('completed')
    } catch (err) {
      console.error('[SurveyRespond] 送信エラー:', err)
      const msg = err instanceof Error ? err.message : '送信に失敗しました'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // 送信ボタンの disabled 判定
  const canSubmit = allAnswered && !!department.trim() && !!roleCategory && !submitting

  // グローバル設問番号（カテゴリ横断の通し番号）
  let globalIndex = 0

  // ── ローディング ──
  if (pageState === 'loading') {
    return (
      <div className="max-w-2xl mx-auto px-5 pt-4 pb-10">
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-full mb-6" />
        <Skeleton className="h-2 w-full mb-8" />
        <div className="space-y-6">
          {[1, 2, 3, 4, 5].map(i => (
            <Card key={i} className="bg-[hsl(0_0%_97%)] border shadow-none">
              <CardContent className="p-5">
                <Skeleton className="h-4 w-3/4 mb-4" />
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(j => (
                    <Skeleton key={j} className="h-10 w-10 rounded-md" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // ── エラー画面 ──
  if (pageState === 'error') {
    return (
      <div className="max-w-2xl mx-auto px-5 pt-4 pb-10">
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-10 text-center">
            <AlertCircle size={48} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-base font-semibold text-foreground mb-2">
              {errorMessage}
            </p>
            <Button
              variant="outline"
              onClick={() => router.push('/portal')}
              className="mt-4"
            >
              <ArrowLeft size={14} />
              ポータルに戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── 完了画面 ──
  if (pageState === 'completed') {
    return (
      <div className="max-w-2xl mx-auto px-5 pt-4 pb-10">
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-10 text-center">
            <CheckCircle2 size={48} className="mx-auto mb-4 text-green-500" />
            <h2 className="text-xl font-bold text-foreground mb-2">
              ご回答ありがとうございました
            </h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              回答は匿名で集計されます。
            </p>
            <Button onClick={() => router.push('/portal')}>
              ポータルに戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── 回答フォーム ──
  return (
    <div className="max-w-2xl mx-auto px-5 pt-4 pb-10">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {survey?.title}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-1">
          回答は匿名で集計されます。各項目について、あなたの実感に最も近いものを選んでください。
        </p>
        <p className="text-xs text-muted-foreground">
          所要時間: 約5分
        </p>
      </div>

      {/* プログレスバー */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">
            回答進捗
          </span>
          <span className="text-xs font-medium text-foreground">
            {answeredCount} / {totalCount}問（{progressPercent}%）
          </span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* 回答者属性 */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-6">
        <CardContent className="p-5">
          <h2 className="text-sm font-bold text-foreground mb-4">回答者情報</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                部署
              </label>
              <Input
                value={department}
                onChange={e => setDepartment(e.target.value)}
                placeholder="例: 営業部"
                className="h-10"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                役職カテゴリ
              </label>
              <Select value={roleCategory} onValueChange={setRoleCategory}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="executive">経営層</SelectItem>
                  <SelectItem value="manager">管理職</SelectItem>
                  <SelectItem value="staff">一般</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 設問セクション（カテゴリ別） */}
      {groupedQuestions.map((group, groupIdx) => (
        <div key={group.category} className="mb-6">
          <h2 className="text-base font-bold text-foreground mb-4">
            {group.label}
          </h2>

          <div className="space-y-4">
            {group.questions.map((q, qIdx) => {
              globalIndex++
              const currentGlobalIndex = globalIndex
              const selectedScore = answers.get(q.id)
              // 各カテゴリセクションの先頭にはラベル表示
              const showLabels = qIdx === 0

              return (
                <Card
                  key={q.id}
                  className={`border shadow-none transition-colors ${
                    selectedScore ? 'bg-[hsl(0_0%_97%)]' : 'bg-white border-dashed'
                  }`}
                >
                  <CardContent className="p-5">
                    {/* 設問テキスト */}
                    <p className="text-sm text-foreground leading-relaxed mb-4">
                      <span className="text-xs font-mono text-muted-foreground mr-2">
                        Q{currentGlobalIndex}.
                      </span>
                      {q.question_text}
                    </p>

                    {/* ラベル行（セクション先頭のみ） */}
                    {showLabels && (
                      <div className="flex gap-1 mb-2">
                        {[1, 2, 3, 4, 5].map(score => (
                          <span
                            key={score}
                            className="flex-1 text-center text-[10px] text-muted-foreground leading-tight"
                          >
                            {SCORE_LABELS[score]}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 5段階ボタン */}
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(score => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => handleScoreSelect(q.id, score)}
                          className={`flex-1 h-11 rounded-md text-sm font-medium transition-all border ${
                            selectedScore === score
                              ? 'bg-foreground text-background border-foreground'
                              : 'bg-background text-foreground border-border hover:bg-muted'
                          }`}
                        >
                          {score}
                        </button>
                      ))}
                    </div>

                    {/* 選択中のラベル表示（セクション先頭以外） */}
                    {!showLabels && selectedScore && (
                      <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                        {SCORE_LABELS[selectedScore]}
                      </p>
                    )}
                    {/* セクション先頭でも選択中ラベル表示 */}
                    {showLabels && selectedScore && (
                      <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                        選択中: {SCORE_LABELS[selectedScore]}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      ))}

      {/* 送信ボタン */}
      <div className="sticky bottom-0 -mx-5 mt-6 bg-background/80 backdrop-blur border-t border-border px-5 py-4">
        {unansweredCount > 0 && (
          <p className="text-xs text-muted-foreground text-center mb-2">
            未回答: {unansweredCount}問
          </p>
        )}
        {!department.trim() && (
          <p className="text-xs text-destructive text-center mb-2">
            部署を入力してください
          </p>
        )}
        {!roleCategory && (
          <p className="text-xs text-destructive text-center mb-2">
            役職カテゴリを選択してください
          </p>
        )}
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full h-12 text-base font-bold"
        >
          {submitting ? '送信中...' : '回答を送信する'}
        </Button>
      </div>
    </div>
  )
}
