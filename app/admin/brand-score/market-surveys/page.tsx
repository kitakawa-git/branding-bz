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
import {
  Upload,
  BarChart3,
  ClipboardList,
  CalendarDays,
  Users,
  MoreHorizontal,
  Trash2,
  Loader2,
} from 'lucide-react'
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
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import {
  MARKET_STAGES,
  MARKET_STAGE_LABELS,
  type MarketStage,
} from '@/lib/brand-score/market-stages'
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

/** 市場浸透の年次推移の1点＝1調査 */
type TrendPoint = {
  survey_id: string
  title: string
  date: string
  date_is_fallback: boolean
  sample_size: number | null
  market_score: number | null
  stages: Record<MarketStage, number | null>
}

type ListCache = { surveys: MarketSurvey[]; trend: TrendPoint[] }

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
  const [trend, setTrend] = useState<TrendPoint[]>(cached?.trend ?? [])
  const [loading, setLoading] = useState(!cached)
  const [importOpen, setImportOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MarketSurvey | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchSurveys = useCallback(async () => {
    if (!companyId) return
    try {
      const [listRes, trendRes] = await Promise.all([
        fetch(`/api/brand-score/market-surveys?company_id=${companyId}`),
        fetch(`/api/brand-score/market-surveys/trend?company_id=${companyId}`),
      ])
      if (!listRes.ok) return
      const data = await listRes.json()
      const trendData = trendRes.ok ? await trendRes.json() : { points: [] }
      setSurveys(data.surveys ?? [])
      setTrend(trendData.points ?? [])
      setPageCache(cacheKey, {
        surveys: data.surveys ?? [],
        trend: trendData.points ?? [],
      })
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

  // サーベイ一覧と同じ書式。月までだと開始と終了が同じ月のとき
  // 「2026/06 〜 2026/06」になって期間が読めない
  const formatDate = (s: string | null) => {
    if (!s) return null
    const d = new Date(s)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
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

      {/* 市場浸透の推移。調査ごとの実施日を横軸にする。
          スナップショットには転記していない（総合スコアの合成が壊れるため）ので、
          割り当てを直せばここも自動で追随する */}
      {trend.length >= 2 && (
        <Card className="mb-4 bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <h2 className="m-0 mb-1 text-sm font-bold text-foreground">市場浸透の推移</h2>
            <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
              調査を実施した時点の数字です。認知は伸びても想起が動かない、
              のような段階ごとの差が見どころです。
            </p>

            <div className="mb-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trend.map(t => ({ 実施: formatDate(t.date), 市場浸透: t.market_score }))}
                  margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="実施" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <Tooltip formatter={(v: number) => [`${v}点`, '市場浸透']} />
                  <Line
                    type="monotone"
                    dataKey="市場浸透"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#16a34a' }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
          </div>

            {/* 段階ごとの値。線では読み取れない実数をここで見る */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[360px] text-xs">
                <thead>
                  <tr className="border-b text-[10px] text-muted-foreground">
                    <th className="py-1 text-left font-normal">段階</th>
                    {trend.map(t => (
                      <th key={t.survey_id} className="py-1 text-right font-normal">
                        {formatDate(t.date)}
                        {t.date_is_fallback && (
                          <span className="ml-1 text-muted-foreground/60">(取込日)</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50 font-bold">
                    <td className="py-1.5 pr-2">市場浸透</td>
                    {trend.map(t => (
                      <td
                        key={t.survey_id}
                        className="py-1.5 text-right tabular-nums text-green-600"
                      >
                        {t.market_score !== null ? t.market_score.toFixed(1) : '—'}
                      </td>
                    ))}
                  </tr>
                  {MARKET_STAGES.map((stage, i) => (
                    <tr key={stage} className="border-b border-border/50">
                      <td className="py-1.5 pr-2 text-muted-foreground">
                        {i + 1}. {MARKET_STAGE_LABELS[stage]}
                      </td>
                      {trend.map(t => (
                        <td
                          key={t.survey_id}
                          className="py-1.5 text-right tabular-nums text-muted-foreground"
                        >
                          {t.stages[stage] !== null ? t.stages[stage]!.toFixed(1) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

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
                      className="h-1.5 flex-1 [&>div]:bg-foreground"
                    />
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      5段階のうち {s.resolved_stage_count} 件を設定済み
                    </span>
                  </div>

                  {/* メタ情報。サーベイ一覧と同じ並び（件数 → 日付 → 終了） */}
                  <div className="flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {/* 設問数のアイコンはサーベイ一覧と同じ ClipboardList */}
                      <ClipboardList size={11} />
                      設問 {s.block_count}件
                    </span>
                    {s.sample_size !== null && (
                      <span className="flex items-center gap-1">
                        <Users size={11} />n = {s.sample_size}
                      </span>
                    )}
                    {s.fielded_from && (
                      <span className="flex items-center gap-1">
                        <CalendarDays size={11} />
                        {formatDate(s.fielded_from)}
                      </span>
                    )}
                    {s.fielded_to && <span>終了: {formatDate(s.fielded_to)}</span>}
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
