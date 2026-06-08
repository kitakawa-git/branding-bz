'use client'

// ブランド理解度テスト 本人結果画面（学習＝提出後に初めて正解・解説を表示）
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, CheckCircle2, XCircle, Check, X } from 'lucide-react'

type QuizOption = { id: string; text: string }
type ReviewAnswer = {
  question_id: string
  category: string
  question_text: string
  options: QuizOption[]
  selected_option_id: string | null
  correct_option_id: string
  is_correct: boolean
  explanation: string | null
}
type Attempt = {
  id: string
  score: number | null
  why_score: number | null
  how_score: number | null
  what_score: number | null
  total_questions: number | null
  correct_count: number | null
  passed: boolean | null
}
type MyAttempt = {
  quiz: { id: string; title: string; pass_threshold: number; status: string }
  attempt: Attempt
  answers: ReviewAnswer[]
  company_average_score: number | null
  insufficient: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  why: 'WHY（理念）',
  how: 'HOW（戦略・ルール）',
  what: 'WHAT（行動）',
}

function scoreColor(v: number | null): string {
  if (v === null) return 'text-muted-foreground'
  if (v >= 80) return 'text-green-600'
  if (v >= 60) return 'text-blue-600'
  if (v >= 40) return 'text-yellow-600'
  return 'text-red-600'
}

export default function QuizResultPage() {
  const params = useParams()
  const router = useRouter()
  const quizId = params.id as string

  const [data, setData] = useState<MyAttempt | null>(null)
  const [loading, setLoading] = useState(true)
  const [notTaken, setNotTaken] = useState(false)

  useEffect(() => {
    if (!quizId) return
    const fetchResult = async () => {
      try {
        const res = await fetch(`/api/brand-score/quizzes/${quizId}/my-attempt`)
        if (res.status === 404) {
          // 未受験 → 受験画面へ（受験画面側で active/closed を判定）
          setNotTaken(true)
          router.replace(`/portal/quiz/${quizId}`)
          return
        }
        if (!res.ok) {
          setLoading(false)
          return
        }
        setData(await res.json())
      } catch (err) {
        console.error('[QuizResult] 取得エラー:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchResult()
  }, [quizId, router])

  if (loading || notTaken) {
    return (
      <div className="max-w-2xl mx-auto px-5 pt-4 pb-10">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-40 w-full mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto px-5 pt-4 pb-10">
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-10 text-center">
            <p className="text-base font-semibold text-foreground mb-2">結果を取得できませんでした</p>
            <Button variant="outline" onClick={() => router.push('/portal')} className="mt-4">
              <ArrowLeft size={14} />
              ポータルに戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { quiz, attempt, answers, company_average_score, insufficient } = data
  const passed = attempt.passed === true

  return (
    <div className="max-w-2xl mx-auto px-5 pt-4 pb-10">
      <h1 className="text-2xl font-bold text-foreground mb-1">{quiz.title}</h1>
      <p className="text-xs text-muted-foreground mb-6">あなたの結果（この結果はあなただけが確認できます）</p>

      {/* スコアサマリ */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-4">
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-end gap-2">
                <span className={`text-4xl font-bold ${scoreColor(attempt.score)}`}>
                  {attempt.score ?? '—'}
                </span>
                <span className="text-lg text-muted-foreground mb-1">%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {attempt.correct_count ?? 0} / {attempt.total_questions ?? 0}問 正解
              </p>
            </div>
            <div className="text-right">
              {passed ? (
                <Badge className="bg-green-100 text-green-700 border-green-200 text-sm px-3 py-1">
                  <CheckCircle2 size={14} className="mr-1" /> 合格
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-700 border-red-200 text-sm px-3 py-1">
                  <XCircle size={14} className="mr-1" /> 不合格
                </Badge>
              )}
              <p className="text-xs text-muted-foreground mt-1.5">合格ライン {quiz.pass_threshold}%</p>
            </div>
          </div>

          {/* カテゴリ別 */}
          <div className="grid grid-cols-2 gap-4 mt-5">
            {attempt.why_score !== null && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">{CATEGORY_LABELS.why}</span>
                  <span className={`text-xs font-semibold ${scoreColor(attempt.why_score)}`}>
                    {attempt.why_score}%
                  </span>
                </div>
                <Progress value={attempt.why_score} className="h-1.5" />
              </div>
            )}
            {attempt.how_score !== null && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">{CATEGORY_LABELS.how}</span>
                  <span className={`text-xs font-semibold ${scoreColor(attempt.how_score)}`}>
                    {attempt.how_score}%
                  </span>
                </div>
                <Progress value={attempt.how_score} className="h-1.5" />
              </div>
            )}
            {attempt.what_score !== null && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">{CATEGORY_LABELS.what}</span>
                  <span className={`text-xs font-semibold ${scoreColor(attempt.what_score)}`}>
                    {attempt.what_score}%
                  </span>
                </div>
                <Progress value={attempt.what_score} className="h-1.5" />
              </div>
            )}
          </div>

          {/* 全社平均（小N時は非表示） */}
          {!insufficient && company_average_score !== null && (
            <p className="text-xs text-muted-foreground mt-4">
              全社平均: <span className="font-semibold text-foreground">{company_average_score}%</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* 設問別の振り返り（提出後のみ正解・解説を表示） */}
      <h2 className="text-base font-bold text-foreground mb-3">設問の振り返り</h2>
      <div className="space-y-3">
        {answers.map((a, idx) => (
          <Card key={a.question_id} className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-2 mb-3">
                <span className="text-xs font-mono text-muted-foreground mt-0.5">Q{idx + 1}.</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-700">
                      {CATEGORY_LABELS[a.category] ?? a.category}
                    </Badge>
                    {a.is_correct ? (
                      <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200">
                        <Check size={14} className="mr-0.5" /> 正解
                      </Badge>
                    ) : (
                      <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-200">
                        <X size={14} className="mr-0.5" /> 不正解
                      </Badge>
                    )}
                  </div>
                  <p className="text-base sm:text-sm text-foreground leading-relaxed">{a.question_text}</p>
                </div>
              </div>

              {/* 選択肢: 正解=緑、誤って選んだもの=赤 */}
              <div className="space-y-1.5 mb-3">
                {a.options.map((o) => {
                  const isCorrect = o.id === a.correct_option_id
                  const isSelected = o.id === a.selected_option_id
                  const wrongPick = isSelected && !isCorrect
                  return (
                    <div
                      key={o.id}
                      className={`flex items-center gap-2 text-xs rounded px-2.5 py-1.5 border ${
                        isCorrect
                          ? 'bg-green-50 text-green-700 border-green-200 font-medium'
                          : wrongPick
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'text-muted-foreground border-transparent'
                      }`}
                    >
                      {isCorrect ? (
                        <Check size={14} className="shrink-0 text-green-600" />
                      ) : wrongPick ? (
                        <X size={14} className="shrink-0 text-red-600" />
                      ) : (
                        <span className="size-[13px] shrink-0" />
                      )}
                      <span>{o.text}</span>
                      {isSelected && (
                        <span className="ml-auto text-[10px] opacity-70">あなたの解答</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* 解説 */}
              {a.explanation && (
                <p className="text-xs text-muted-foreground leading-relaxed bg-muted/40 rounded p-2.5">
                  解説: {a.explanation}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <Button variant="outline" onClick={() => router.push('/portal')} className="w-full">
          <ArrowLeft size={14} />
          ポータルに戻る
        </Button>
      </div>
    </div>
  )
}
