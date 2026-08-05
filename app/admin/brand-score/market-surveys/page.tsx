'use client'

// 市場調査 一覧ページ
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../components/AdminDataProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { toast } from 'sonner'
import { Upload, BarChart3, CalendarDays, Users, MoreHorizontal, Trash2, Loader2 } from 'lucide-react'
import { Fab, FabButton } from '@/components/ui/fab'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { MarketSurveyImportDialog } from './MarketSurveyImportDialog'

type MarketSurvey = {
  id: string
  title: string
  research_firm: string
  fielded_from: string | null
  fielded_to: string | null
  sample_size: number | null
  status: string
  source_file_name: string
  imported_at: string
  created_at: string
  block_count: number
  resolved_stage_count: number
  total_stage_count: number
}

type ListCache = { surveys: MarketSurvey[] }

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: '設定中', className: 'bg-amber-100 text-amber-700' },
  active: { label: '反映中', className: 'bg-green-100 text-green-700' },
  archived: { label: '過年度', className: 'bg-gray-100 text-gray-500' },
}

export default function MarketSurveysPage() {
  const { companyId } = useAuth()
  const router = useRouter()

  const cacheKey = `market-surveys-${companyId}`
  const cached = companyId ? getPageCache<ListCache>(cacheKey) : null

  const [surveys, setSurveys] = useState<MarketSurvey[]>(cached?.surveys ?? [])
  const [loading, setLoading] = useState(!cached)
  const [importOpen, setImportOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MarketSurvey | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchSurveys = useCallback(async () => {
    if (!companyId) return
    try {
      const res = await fetch(`/api/brand-score/market-surveys?company_id=${companyId}`)
      if (!res.ok) return
      const data = await res.json()
      setSurveys(data.surveys ?? [])
      setPageCache(cacheKey, { surveys: data.surveys ?? [] })
    } catch (err) {
      console.error('[MarketSurveys] 取得エラー:', err)
    } finally {
      setLoading(false)
    }
  }, [companyId, cacheKey])

  useEffect(() => {
    fetchSurveys()
  }, [fetchSurveys])

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/brand-score/market-surveys/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        throw new Error(d?.error || `HTTP ${res.status}`)
      }
      toast.success('調査を削除しました')
      setDeleteTarget(null)
      // キャッシュを捨ててから取り直す
      setPageCache(cacheKey, null as unknown as ListCache)
      await fetchSurveys()
    } catch (err) {
      console.error('[MarketSurveys] 削除エラー:', err)
      toast.error('削除に失敗しました')
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (s: string | null) => {
    if (!s) return null
    const d = new Date(s)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <Card key={i} className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5 space-y-3">
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div>
      <Fab>
        <FabButton onClick={() => setImportOpen(true)} icon={<Upload size={16} />}>
          調査を取り込む
        </FabButton>
      </Fab>

      <MarketSurveyImportDialog open={importOpen} onOpenChange={setImportOpen} />

      {/* 削除の確認。設問・集計値・割り当ても一緒に消えるので件数を明示する */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={open => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>この調査を削除しますか</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.title}」と、取り込んだ設問{deleteTarget?.block_count}件・
              5段階の割り当てをすべて削除します。元に戻せません。
              {deleteTarget?.status === 'active' &&
                'この調査はアウタースコアに反映中です。削除するとスコアから外れます。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 size={14} className="animate-spin" />}
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {surveys.length === 0 ? (
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-10 text-center">
            <BarChart3 size={28} className="mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              取り込んだ市場調査はまだありません
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
              調査会社のGT集計表（Excel）を取り込むと、認知・想起・評価・利用・推奨の
              5段階で市場での浸透度を見られます。名刺のアクセスログだけでは分からない
              「社外にどこまで届いているか」がアウタースコアに反映されます。
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {surveys.map(s => {
            const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.draft
            const period = [formatDate(s.fielded_from), formatDate(s.fielded_to)]
              .filter(Boolean)
              .join(' 〜 ')
            const mappingRate =
              s.total_stage_count > 0
                ? (s.resolved_stage_count / s.total_stage_count) * 100
                : 0

            return (
              <Card
                key={s.id}
                className="bg-[hsl(0_0%_97%)] border shadow-none cursor-pointer transition-colors hover:bg-[hsl(0_0%_95%)]"
                // 取り込み時に自動割り当てまで済むので、下書きでも詳細を開く。
                // 割り当てを直したいときは詳細の「指標の割り当て」から入る
                onClick={() => router.push(`/admin/brand-score/market-surveys/${s.id}`)}
              >
                <CardContent className="p-5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-sm font-bold text-foreground">
                          {s.title}
                        </h2>
                        <Badge
                          variant="secondary"
                          className={`shrink-0 px-1.5 py-0 text-[10px] ${cfg.className}`}
                        >
                          {cfg.label}
                        </Badge>
                      </div>
                      {s.research_firm && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {s.research_firm}
                        </p>
                      )}
                    </div>

                    {/* カード全体が詳細への遷移なので、メニュー側はクリックを止める */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="操作メニュー"
                          onClick={e => e.stopPropagation()}
                          className="-mr-1 -mt-1 shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => setDeleteTarget(s)}
                        >
                          <Trash2 size={14} />
                          削除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* 5段階のうち何段階が決まっているか */}
                  <div className="mb-2 flex items-center gap-3">
                    <Progress
                      value={mappingRate}
                      className="h-1.5 flex-1 [&>div]:bg-ds-app-accent-soft"
                    />
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      5段階のうち {s.resolved_stage_count} 件を設定済み
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground">
                    {period && (
                      <span className="flex items-center gap-1">
                        <CalendarDays size={11} />
                        {period}
                      </span>
                    )}
                    {s.sample_size !== null && (
                      <span className="flex items-center gap-1">
                        <Users size={11} />n = {s.sample_size}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <BarChart3 size={11} />
                      設問 {s.block_count}件
                    </span>
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
