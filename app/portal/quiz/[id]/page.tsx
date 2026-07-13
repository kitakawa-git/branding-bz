'use client'

// ブランド理解度テスト 受験画面（ポータルメンバー向け・記名式）
// サーベイ回答ページのUXを下敷きに、正誤テスト用に実装。
// ★正解・解説は /take が返さないため、提出前にブラウザへは渡らない。
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
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
import { toast } from 'sonner'
import { AlertCircle, ArrowLeft, ClipboardCheck } from 'lucide-react'

type QuizOption = { id: string; text: string }
type TakeQuestion = {
  id: string
  category: string
  question_type: string
  question_text: string
  options: QuizOption[]
  sort_order: number
}
type QuizMeta = {
  id: string
  title: string
  description: string | null
  status: string
  pass_threshold: number
  randomize_questions: boolean
}

type PageState = 'loading' | 'form' | 'blocked' | 'error'

// 配列シャッフル（出題順ランダム用。正解は payload に無いので安全）
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function QuizTakePage() {
  const params = useParams()
  const router = useRouter()
  const quizId = params.id as string

  const [pageState, setPageState] = useState<PageState>('loading')
  const [blockedReason, setBlockedReason] = useState('')

  const [quiz, setQuiz] = useState<QuizMeta | null>(null)
  const [questions, setQuestions] = useState<TakeQuestion[]>([])
  const [roleCategory, setRoleCategory] = useState('')
  const [answers, setAnswers] = useState<Map<string, string>>(new Map())
  const [startedAt, setStartedAt] = useState<string>('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!quizId) return
    const fetchTake = async () => {
      try {
        const res = await fetch(`/api/brand-score/quizzes/${quizId}/take`)
        if (res.status === 401 || res.status === 403) {
          setBlockedReason('このテストを受験する権限がありません')
          setPageState('blocked')
          return
        }
        if (!res.ok) {
          setPageState('error')
          return
        }
        const data = await res.json()
        // 受験済み → 結果画面へ
        if (data.already_submitted) {
          router.replace(`/portal/quiz/${quizId}/result`)
          return
        }
        // 期間外・非active
        if (!data.takeable) {
          setQuiz(data.quiz)
          setBlockedReason(data.reason || 'このテストは現在受験できません')
          setPageState('blocked')
          return
        }
        setQuiz(data.quiz)
        const qs: TakeQuestion[] = data.questions || []
        setQuestions(data.quiz.randomize_questions ? shuffle(qs) : qs)
        setStartedAt(new Date().toISOString())
        setPageState('form')
      } catch (err) {
        console.error('[QuizTake] 取得エラー:', err)
        setPageState('error')
      }
    }
    fetchTake()
  }, [quizId, router])

  const totalCount = questions.length
  const answeredCount = answers.size
  const progressPercent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0
  const unansweredCount = totalCount - answeredCount
  const allAnswered = answeredCount === totalCount && totalCount > 0
  const canSubmit = allAnswered && !!roleCategory && !submitting

  const handleSelect = (questionId: string, optionId: string) => {
    setAnswers((prev) => {
      const next = new Map(prev)
      next.set(questionId, optionId)
      return next
    })
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setConfirmOpen(false)
    setSubmitting(true)
    try {
      const answersArray = questions.map((q) => ({
        question_id: q.id,
        selected_option_id: answers.get(q.id) ?? null,
      }))
      const res = await fetch(`/api/brand-score/quizzes/${quizId}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: answersArray,
          role_category: roleCategory,
          started_at: startedAt,
        }),
      })
      if (res.status === 409) {
        // 既に受験済み（二重提出など）→ 結果画面へ
        router.replace(`/portal/quiz/${quizId}/result`)
        return
      }
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      router.replace(`/portal/quiz/${quizId}/result`)
    } catch (err) {
      console.error('[QuizTake] 提出エラー:', err)
      toast.error(err instanceof Error ? err.message : '提出に失敗しました')
      setSubmitting(false)
    }
  }

  // グローバル設問番号
  const numbered = useMemo(
    () => questions.map((q, i) => ({ q, n: i + 1 })),
    [questions]
  )

  if (pageState === 'loading') {
    return (
      <div className="max-w-2xl mx-auto px-5 pt-4 pb-10">
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-full mb-6" />
        <Skeleton className="h-2 w-full mb-8" />
        <div className="space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-[hsl(0_0%_97%)] border shadow-none">
              <CardContent className="p-4 sm:p-5">
                <Skeleton className="h-4 w-3/4 mb-4" />
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((j) => (
                    <Skeleton key={j} className="h-10 w-full rounded-md" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (pageState === 'error') {
    return (
      <div className="max-w-2xl mx-auto px-5 pt-4 pb-10">
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-10 text-center">
            <AlertCircle size={48} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-base font-semibold text-foreground mb-2">
              テスト情報の取得に失敗しました
            </p>
            <Button variant="outline" onClick={() => router.push('/portal')} className="mt-4">
              <ArrowLeft size={14} />
              ポータルに戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (pageState === 'blocked') {
    return (
      <div className="max-w-2xl mx-auto px-5 pt-4 pb-10">
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-10 text-center">
            <AlertCircle size={48} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-base font-semibold text-foreground mb-2">{blockedReason}</p>
            {quiz && <p className="text-sm text-muted-foreground mb-2">{quiz.title}</p>}
            <Button variant="outline" onClick={() => router.push('/portal')} className="mt-4">
              <ArrowLeft size={14} />
              ポータルに戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── 受験フォーム ──
  return (
    <div className="max-w-2xl mx-auto px-5 pt-4 pb-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <ClipboardCheck size={22} className="text-ds-app-accent shrink-0" />
          {quiz?.title}
        </h1>
        {quiz?.description && (
          <p className="text-base sm:text-sm text-muted-foreground leading-relaxed mb-1">{quiz.description}</p>
        )}
        <p className="text-xs text-muted-foreground">
          記名式のテストです。あなたのスコア・解説はあなただけが確認でき、管理者には部署平均（3人以上）としてのみ集計されます。提出は1回のみです。
        </p>
      </div>

      {/* 進捗 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">回答進捗</span>
          <span className="text-xs font-medium text-foreground">
            {answeredCount} / {totalCount}問（{progressPercent}%）
          </span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* 役職カテゴリ（自己申告。department はサーバが profiles から取得） */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-6">
        <CardContent className="p-4 sm:p-5">
          <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">
            役職カテゴリ（集計用）
          </label>
          <Select value={roleCategory} onValueChange={setRoleCategory}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="executive">経営層</SelectItem>
              <SelectItem value="manager">管理職</SelectItem>
              <SelectItem value="staff">一般</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* 設問 */}
      <div className="space-y-4">
        {numbered.map(({ q, n }) => {
          const selected = answers.get(q.id)
          return (
            <Card
              key={q.id}
              className={`border shadow-none transition-colors ${
                selected ? 'bg-[hsl(0_0%_97%)]' : 'bg-white border-dashed'
              }`}
            >
              <CardContent className="p-4 sm:p-5">
                <p className="text-base text-foreground/80 leading-relaxed mb-4">
                  <span className="text-xs font-mono text-muted-foreground mr-2">Q{n}.</span>
                  {q.question_text}
                </p>
                <div className="space-y-2">
                  {q.options.map((o) => {
                    const isSel = selected === o.id
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => handleSelect(q.id, o.id)}
                        className={`w-full text-left flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-all border ${
                          isSel
                            ? 'bg-foreground text-background border-foreground'
                            : 'bg-background text-foreground border-border hover:bg-muted'
                        }`}
                      >
                        <span
                          className={`size-4 rounded-full border-2 shrink-0 ${
                            isSel ? 'border-background bg-background' : 'border-muted-foreground/40'
                          }`}
                        />
                        <span>{o.text}</span>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 提出 */}
      <div className="sticky bottom-0 -mx-5 mt-6 bg-background/80 backdrop-blur border-t border-border px-5 py-4">
        {unansweredCount > 0 && (
          <p className="text-xs text-muted-foreground text-center mb-2">未回答: {unansweredCount}問</p>
        )}
        {!roleCategory && (
          <p className="text-xs text-destructive text-center mb-2">役職カテゴリを選択してください</p>
        )}
        <Button
          onClick={() => setConfirmOpen(true)}
          disabled={!canSubmit}
          className="w-full h-12 text-base font-bold"
        >
          {submitting ? '提出中...' : '回答を提出する'}
        </Button>
      </div>

      {/* 提出確認 */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>回答を提出しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              提出すると再受験はできません。提出後に正解と解説が表示されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>戻る</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={submitting}>
              提出する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
