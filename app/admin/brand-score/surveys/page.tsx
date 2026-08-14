'use client'

// サーベイ管理 一覧ページ
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
import {
  Plus,
  ClipboardList,
  CalendarDays,
  Trash2,
  Loader2,
  Upload,
  MoreHorizontal,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Fab, FabButton } from '@/components/ui/fab'
import { SurveyImportDialog } from './SurveyImportDialog'
import { PlanUpsell } from '@/components/billing/plan-gate'
import { can } from '@/lib/billing/entitlements'
import { isFeatureEnabled } from '@/lib/constants/feature-toggles'
import { FeatureDisabledNotice } from '@/components/billing/feature-disabled'

type Survey = {
  id: string
  title: string
  status: string
  starts_at: string | null
  ends_at: string | null
  target_response_rate: number
  total_members: number
  response_rate: number
  responded_count: number
  created_at: string
}

type SurveyWithQuestionCount = Survey & {
  question_count?: number
  /** 'internal'（社内配信）か 'imported'（外部調査の取り込み） */
  source?: string
}

type ListCache = {
  surveys: SurveyWithQuestionCount[]
}

// ステータスバッジの色定義
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: '下書き', className: 'bg-gray-100 text-gray-700' },
  active: { label: '実施中', className: 'bg-green-100 text-green-700' },
  closed: { label: '終了', className: 'bg-blue-100 text-ds-app-accent-hover' },
  archived: { label: 'アーカイブ', className: 'bg-gray-100 text-gray-500' },
}

export default function SurveysListPage() {
  const { companyId, company } = useAuth()
  const router = useRouter()
  const cacheKey = `admin-surveys-${companyId}`
  const cached = companyId ? getPageCache<ListCache>(cacheKey) : null
  const [surveys, setSurveys] = useState<SurveyWithQuestionCount[]>(cached?.surveys ?? [])
  const [loading, setLoading] = useState(!cached)
  const [creating, setCreating] = useState(false)
  const [draftDialogOpen, setDraftDialogOpen] = useState(false)
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  // サーベイ一覧取得
  const fetchSurveys = async () => {
    if (!companyId) return
    try {
      const res = await fetch(`/api/brand-score/surveys?company_id=${companyId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const surveyList: SurveyWithQuestionCount[] = data.surveys || []

      // 各サーベイの設問数を取得
      const surveysWithCounts = await Promise.all(
        surveyList.map(async (survey) => {
          try {
            const qRes = await fetch(`/api/brand-score/surveys/${survey.id}/questions`)
            if (qRes.ok) {
              const qData = await qRes.json()
              return { ...survey, question_count: qData.questions?.length ?? 0 }
            }
          } catch {
            // 設問数取得失敗はスキップ
          }
          return { ...survey, question_count: undefined }
        })
      )

      setSurveys(surveysWithCounts)
      setPageCache(cacheKey, { surveys: surveysWithCounts })
    } catch (err) {
      console.error('[Surveys] データ取得エラー:', err)
      toast.error('サーベイ一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<ListCache>(cacheKey)) return
    fetchSurveys()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, cacheKey])

  // 新規作成ボタンクリック（draft存在チェック）
  const handleCreateClick = () => {
    const draftSurvey = surveys.find(s => s.status === 'draft')
    if (draftSurvey) {
      setDraftDialogOpen(true)
    } else {
      handleCreateNew()
    }
  }

  // 新規サーベイ作成（POST）
  const handleCreateNew = async () => {
    if (!companyId || creating) return
    setDraftDialogOpen(false)
    setCreating(true)
    try {
      const res = await fetch('/api/brand-score/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      toast.success('サーベイを作成しました')
      router.push(`/admin/brand-score/surveys/${data.survey.id}`)
    } catch (err) {
      console.error('[Surveys] 作成エラー:', err)
      toast.error('サーベイの作成に失敗しました')
    } finally {
      setCreating(false)
    }
  }

  // 既存draftに遷移
  const handleGoToDraft = () => {
    const draftSurvey = surveys.find(s => s.status === 'draft')
    if (draftSurvey) {
      setDraftDialogOpen(false)
      router.push(`/admin/brand-score/surveys/${draftSurvey.id}`)
    }
  }

  // サーベイ削除
  const handleDeleteSurvey = async () => {
    if (!deleteDialogId || deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/brand-score/surveys/${deleteDialogId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      toast.success('サーベイを削除しました')
      setDeleteDialogId(null)
      // キャッシュクリアして再取得
      setPageCache(cacheKey, null as unknown as ListCache)
      await fetchSurveys()
    } catch (err) {
      console.error('[Surveys] 削除エラー:', err)
      toast.error('サーベイの削除に失敗しました')
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  }

  // ローディング
  // プラン外: 隠さずアップセル面を出す（実効プランで判定）
  // 会社が機能トグルでオフにしている場合は、プラン案内より先に閉じる
  if (!isFeatureEnabled(company, 'survey_enabled')) return <FeatureDisabledNotice />

  if (!can(company, 'innerSurvey')) {
    return (
      <div>
        <PlanUpsell
          company={company}
          feature="innerSurvey"
          title="インナーサーベイを使うには"
          benefits={[
            '社員サーベイで理念の浸透度を測る',
            'AI が設問案を生成',
            '浸透の5段階（認知→理解→共感→行動→推奨）で可視化',
            'ID INC. の四半期レビューで打ち手まで伴走',
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
          {[1, 2, 3].map(i => (
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
      {/* 新規サーベイ作成 FAB（右下固定・include-bz の FabButton と同装飾） */}
      <Fab>
        <FabButton
          variant="secondary"
          onClick={() => setImportOpen(true)}
          disabled={creating}
          icon={<Upload size={16} />}
        >
          回答を取り込む
        </FabButton>
        <FabButton
          onClick={handleCreateClick}
          disabled={creating}
          icon={creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
        >
          {creating ? '作成中...' : '新規サーベイ作成'}
        </FabButton>
      </Fab>

      {/* Googleフォーム回答の取り込みダイアログ */}
      <SurveyImportDialog open={importOpen} onOpenChange={setImportOpen} />

      {/* draft存在時の確認ダイアログ */}
      <AlertDialog open={draftDialogOpen} onOpenChange={setDraftDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>編集中の下書きがあります</AlertDialogTitle>
            <AlertDialogDescription>
              「{surveys.find(s => s.status === 'draft')?.title}」が下書き状態です。下書きを編集するか、新しいサーベイを作成してください。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleGoToDraft} className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
              下書きを編集
            </AlertDialogAction>
            <AlertDialogAction onClick={handleCreateNew}>
              新しく作成
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 削除確認ダイアログ */}
      <AlertDialog open={!!deleteDialogId} onOpenChange={(open) => { if (!open) setDeleteDialogId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>このサーベイを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              設問もすべて削除されます。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSurvey}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? '削除中...' : '削除する'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {surveys.length === 0 ? (
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-10 text-center">
            <ClipboardList size={40} className="mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm mb-1">まだサーベイがありません</p>
            <p className="text-muted-foreground/60 text-xs">
              「新規サーベイ作成」ボタンからブランド浸透度調査を始めましょう
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {surveys.map(survey => {
            const statusConfig = STATUS_CONFIG[survey.status] || STATUS_CONFIG.draft
            return (
              <Card
                key={survey.id}
                className="bg-[hsl(0_0%_97%)] border shadow-none cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => router.push(`/admin/brand-score/surveys/${survey.id}`)}
              >
                <CardContent className="p-5">
                  {/* タイトル行 */}
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-sm font-semibold text-foreground flex-1">
                      {survey.title}
                    </h3>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] px-1.5 py-0 ${statusConfig.className}`}
                    >
                      {statusConfig.label}
                    </Badge>
                    {/* 下書きのほか、取り込みぶんは外部ファイルの写しなので消して入れ直せる。
                        カード全体が詳細への遷移なので、メニュー側はクリックを止める */}
                    {(survey.status === 'draft' || survey.source === 'imported') && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`${survey.title} の操作メニュー`}
                            onClick={(e) => e.stopPropagation()}
                            className="-mr-1 shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => setDeleteDialogId(survey.id)}
                          >
                            <Trash2 size={14} />
                            削除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {/* 回答率プログレスバー */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">
                        回答率
                      </span>
                      <span className="text-xs font-medium text-foreground">
                        {survey.responded_count}/{survey.total_members}人
                        （{survey.response_rate}%）
                      </span>
                    </div>
                    <Progress value={survey.response_rate} className="h-1.5" />
                  </div>

                  {/* メタ情報 */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {survey.question_count !== undefined && (
                      <span className="flex items-center gap-1">
                        <ClipboardList size={12} />
                        {survey.question_count}問
                      </span>
                    )}
                    <span className="flex items-center gap-1" suppressHydrationWarning>
                      <CalendarDays size={12} />
                      {formatDate(survey.created_at)}
                    </span>
                    {survey.status === 'active' && survey.starts_at && (
                      <span>
                        開始: {formatDate(survey.starts_at)}
                      </span>
                    )}
                    {survey.status === 'closed' && survey.ends_at && (
                      <span>
                        終了: {formatDate(survey.ends_at)}
                      </span>
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
