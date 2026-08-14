'use client'

// 理解度テスト管理 一覧ページ（サーベイ管理一覧をミラー）
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAuth } from '../../components/AdminDataProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { Plus, ClipboardCheck, CalendarDays, Trash2, Loader2, Users } from 'lucide-react'
import { Fab, FabButton } from '@/components/ui/fab'
import { PlanUpsell } from '@/components/billing/plan-gate'
import { can } from '@/lib/billing/entitlements'

type Quiz = {
  id: string
  title: string
  status: string
  starts_at: string | null
  ends_at: string | null
  total_members: number | null
  pass_threshold: number
  randomize_questions: boolean
  created_at: string
  question_count?: number
  attempt_count?: number
}

type ListCache = {
  quizzes: Quiz[]
}

// ステータスバッジ（サーベイと統一）
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: '下書き', className: 'bg-gray-100 text-gray-700' },
  active: { label: '実施中', className: 'bg-green-100 text-green-700' },
  closed: { label: '終了', className: 'bg-blue-100 text-ds-app-accent-hover' },
  archived: { label: 'アーカイブ', className: 'bg-gray-100 text-gray-500' },
}

// 新規作成フォーム初期値
const DEFAULT_FORM = {
  title: '',
  description: '',
  pass_threshold: 80,
  randomize_questions: true,
}

export default function QuizzesListPage() {
  const { companyId, company } = useAuth()
  const router = useRouter()
  const cacheKey = `admin-quizzes-${companyId}`
  const cached = companyId ? getPageCache<ListCache>(cacheKey) : null
  const [quizzes, setQuizzes] = useState<Quiz[]>(cached?.quizzes ?? [])
  const [loading, setLoading] = useState(!cached)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [creating, setCreating] = useState(false)
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // 一覧取得（API が question_count / attempt_count を同梱）
  const fetchQuizzes = async () => {
    if (!companyId) return
    try {
      const res = await fetch(`/api/brand-score/quizzes?companyId=${companyId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const list: Quiz[] = data.quizzes || []
      setQuizzes(list)
      setPageCache(cacheKey, { quizzes: list })
    } catch (err) {
      console.error('[Quizzes] データ取得エラー:', err)
      toast.error('理解度テスト一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<ListCache>(cacheKey)) return
    fetchQuizzes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, cacheKey])

  // 新規作成（POST → 詳細へ遷移）
  const handleCreate = async () => {
    if (!companyId || creating) return
    if (!form.title.trim()) {
      toast.error('タイトルを入力してください')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/brand-score/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          title: form.title.trim(),
          description: form.description.trim() || null,
          pass_threshold: form.pass_threshold,
          randomize_questions: form.randomize_questions,
        }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      toast.success('理解度テストを作成しました')
      setPageCache(cacheKey, null as unknown as ListCache)
      router.push(`/admin/brand-score/quizzes/${data.quiz.id}`)
    } catch (err) {
      console.error('[Quizzes] 作成エラー:', err)
      toast.error('理解度テストの作成に失敗しました')
    } finally {
      setCreating(false)
    }
  }

  // 削除（draft のみ）
  const handleDelete = async () => {
    if (!deleteDialogId || deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/brand-score/quizzes/${deleteDialogId}`, { method: 'DELETE' })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      toast.success('理解度テストを削除しました')
      setDeleteDialogId(null)
      setPageCache(cacheKey, null as unknown as ListCache)
      await fetchQuizzes()
    } catch (err) {
      console.error('[Quizzes] 削除エラー:', err)
      toast.error('理解度テストの削除に失敗しました')
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  }

  const responseRate = (q: Quiz) => {
    const total = q.total_members ?? 0
    const attempts = q.attempt_count ?? 0
    return total > 0 ? Math.round((attempts / total) * 100) : 0
  }

  // プラン外: 隠さずアップセル面を出す（実効プランで判定＝期限切れならロック）
  if (!can(company, 'brandQuiz')) {
    return (
      <div>
        <PlanUpsell
          company={company}
          feature="brandQuiz"
          title="ブランド理解度テストを使うには"
          benefits={[
            '理念・行動指針の理解度を設問で測る',
            'AI が設問案を生成',
            '部署別・役職別に正答率を集計',
            '共感（サーベイ）とのギャップ分析につながる',
          ]}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-[hsl(0_0%_97%)] border shadow-none">
              <CardContent className="p-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <Skeleton className="h-2 w-full" />
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* 新規作成 FAB */}
      <Fab>
        <FabButton
          onClick={() => {
            setForm(DEFAULT_FORM)
            setCreateOpen(true)
          }}
          disabled={creating}
          icon={creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
        >
          {creating ? '作成中...' : '新規テスト作成'}
        </FabButton>
      </Fab>

      {/* 新規作成ダイアログ */}
      <AlertDialog open={createOpen} onOpenChange={setCreateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>理解度テストを新規作成</AlertDialogTitle>
            <AlertDialogDescription>
              下書きとして作成し、続けて設問を編集します。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">タイトル</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="第1回 ブランド理解度テスト"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">説明（任意）</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  合格ライン（正答率%）
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.pass_threshold}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, pass_threshold: Number(e.target.value) }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground pt-6 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.randomize_questions}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, randomize_questions: e.target.checked }))
                  }
                  className="size-4 rounded border-input"
                />
                出題順をランダム
              </label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={creating}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleCreate()
              }}
              disabled={creating || !form.title.trim()}
            >
              {creating ? '作成中...' : '作成して設問へ'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 削除確認 */}
      <AlertDialog
        open={!!deleteDialogId}
        onOpenChange={(open) => {
          if (!open) setDeleteDialogId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>このテストを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              設問もすべて削除されます。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? '削除中...' : '削除する'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {quizzes.length === 0 ? (
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-10 text-center">
            <ClipboardCheck size={40} className="mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm mb-1">まだ理解度テストがありません</p>
            <p className="text-muted-foreground/60 text-xs">
              「新規テスト作成」ボタンから、社員のブランド理解度を測るテストを作成しましょう
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {quizzes.map((quiz) => {
            const statusConfig = STATUS_CONFIG[quiz.status] || STATUS_CONFIG.draft
            const total = quiz.total_members ?? 0
            const attempts = quiz.attempt_count ?? 0
            return (
              <Card
                key={quiz.id}
                className="bg-[hsl(0_0%_97%)] border shadow-none cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => router.push(`/admin/brand-score/quizzes/${quiz.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-sm font-semibold text-foreground flex-1">{quiz.title}</h3>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] px-1.5 py-0 ${statusConfig.className}`}
                    >
                      {statusConfig.label}
                    </Badge>
                    {quiz.status === 'draft' && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteDialogId(quiz.id)
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>

                  {/* 受験率（実施中・終了のみ意味があるが常に表示） */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">受験率</span>
                      <span className="text-xs font-medium text-foreground">
                        {attempts}/{total}人（{responseRate(quiz)}%）
                      </span>
                    </div>
                    <Progress value={responseRate(quiz)} className="h-1.5" />
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {quiz.question_count !== undefined && (
                      <span className="flex items-center gap-1">
                        <ClipboardCheck size={12} />
                        {quiz.question_count}問
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      合格 {quiz.pass_threshold}%
                    </span>
                    <span className="flex items-center gap-1" suppressHydrationWarning>
                      <CalendarDays size={12} />
                      {formatDate(quiz.created_at)}
                    </span>
                    {quiz.status === 'active' && quiz.starts_at && (
                      <span>開始: {formatDate(quiz.starts_at)}</span>
                    )}
                    {quiz.status === 'closed' && quiz.ends_at && (
                      <span>終了: {formatDate(quiz.ends_at)}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
