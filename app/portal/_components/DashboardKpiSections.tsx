// ポータルダッシュボードの目標・KPI 関連（未設定バナー・KPIサマリー・自己評価バナー／ダイアログ）
import type { Dispatch, SetStateAction } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ArrowRight } from 'lucide-react'
import JaWrap from '@/components/lp/JaWrap'

export type KpiItemSummary = {
  id: string
  title: string
  progress: number
  weight: number
  status: string
  deadline: string | null
}

// 目標・KPI未設定バナー（サーベイ・理解度テストと同じ「やってください」の通知）
// 自己評価バナー（DashboardReviewBanner）と同じ様式（全体が押せるピル・白文字・右端に矢印）。色だけ赤
export function DashboardGoalBanner({ goalPeriodType }: { goalPeriodType: string | null }) {
  const period =
    goalPeriodType === 'year'
      ? '１年間'
      : goalPeriodType === 'half'
        ? '半年間'
        : goalPeriodType === 'quarter'
          ? '３ヶ月間'
          : null
  return (
    <Link href="/portal/kpi?setup=true" className="block w-full mb-4 no-underline">
      <div className="rounded-full bg-red-500 px-6 py-4 flex items-center justify-between hover:opacity-90 transition-opacity">
        <p className="text-white text-base font-semibold m-0 text-left break-keep [overflow-wrap:break-word]">
          <JaWrap>{period ? `あなたの${period}の目標とKPIを決めましょう！` : '今期の目標とKPIを決めましょう！'}</JaWrap>
        </p>
        <ArrowRight size={18} className="text-white shrink-0 ml-3" />
      </div>
    </Link>
  )
}

// KPIサマリー（総合進捗率＋上位3件）
export function DashboardKpiSummary({
  kpiGoals,
  goalTitle,
}: {
  kpiGoals: KpiItemSummary[]
  goalTitle: string | null
}) {
  const STATUS_LABELS: Record<string, string> = { not_started: '未着手', in_progress: '進行中', completed: '達成' }
  const STATUS_COLORS: Record<string, string> = { not_started: 'bg-gray-100 text-gray-600', in_progress: 'bg-blue-100 text-ds-app-accent-hover', completed: 'bg-green-100 text-green-700' }
  let totalWeight = 0, weightedSum = 0
  kpiGoals.forEach(k => { const w = k.weight || 0; weightedSum += k.progress * w; totalWeight += w })
  const overallProgress = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0
  const displayKpis = kpiGoals.slice(0, 3)

  return (
    <div className="mb-4">
      <Card className="bg-white border shadow-none">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-foreground tracking-wide m-0">
              あなたの目標・KPI
            </h2>
            <Link href="/portal/kpi" className="text-xs text-muted-foreground hover:text-foreground no-underline flex items-center gap-0.5">
              すべての目標を見る <ArrowRight size={14} />
            </Link>
          </div>
          {goalTitle && (
            <p className="text-2xl font-semibold text-foreground m-0 mb-3 leading-relaxed">{goalTitle}</p>
          )}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">KPI 総合進捗率</span>
            <span className="text-2xl font-bold text-foreground">{overallProgress}%</span>
          </div>
          <Progress value={overallProgress} className="h-2 mb-4" animate />
          {displayKpis.length > 0 && (
            <div className="space-y-2">
              {displayKpis.map(k => (
                <div key={k.id} className="flex items-center gap-3">
                  <span className="text-sm font-bold text-foreground flex-1 truncate">{k.title}</span>
                  <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 shrink-0 ${STATUS_COLORS[k.status] || ''}`}>
                    {STATUS_LABELS[k.status] || k.status}
                  </Badge>
                  <span className="text-sm font-semibold text-foreground w-10 text-right shrink-0">{k.progress}%</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// 自己評価バナー（押すと自己評価ダイアログを開く）
export function DashboardReviewBanner({
  goalPeriodType,
  onOpen,
}: {
  goalPeriodType: string | null
  onOpen: () => void
}) {
  return (
    <button type="button" onClick={onOpen} className="w-full mb-4 cursor-pointer border-0 p-0 bg-transparent">
      <div className="rounded-full bg-[#47C95C] px-6 py-4 flex items-center justify-between hover:opacity-90 transition-opacity">
        {/* text-left: <button> の初期値（中央寄せ）だと2行になったとき目標バナーと揃わない。
            break-keep + JaWrap: 「自己評価／を」のような語の途中で折り返さない */}
        <p className="text-white text-base font-semibold m-0 text-left break-keep [overflow-wrap:break-word]">
          <JaWrap>{`あなたの${goalPeriodType === 'year' ? '１年間' : goalPeriodType === 'half' ? '半年間' : goalPeriodType === 'quarter' ? '３ヶ月間' : '期間'}を振り返り、自己評価を行いましょう！`}</JaWrap>
        </p>
        <ArrowRight size={18} className="text-white shrink-0 ml-3" />
      </div>
    </button>
  )
}

// 自己評価ダイアログ（KPIごとの進捗スライダー）
export function DashboardReviewDialog({
  open,
  onOpenChange,
  kpiGoals,
  reviewProgress,
  setReviewProgress,
  onSave,
  saving,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kpiGoals: KpiItemSummary[]
  reviewProgress: Record<string, number>
  setReviewProgress: Dispatch<SetStateAction<Record<string, number>>>
  onSave: () => void
  saving: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogTitle>KPI進捗を更新</DialogTitle>
        <div className="space-y-5 mt-3">
          {kpiGoals.map(kpi => (
            <div key={kpi.id}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-foreground">{kpi.title}</span>
                <span className="text-sm font-bold text-foreground">{reviewProgress[kpi.id] ?? kpi.progress}%</span>
              </div>
              <Slider
                value={[reviewProgress[kpi.id] ?? kpi.progress]}
                onValueChange={v => setReviewProgress(prev => ({ ...prev, [kpi.id]: v[0] }))}
                max={100}
                step={5}
                className="w-full"
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-5">
          <Button onClick={onSave} disabled={saving} className="min-w-[100px]">
            {saving ? '保存中...' : '保存する'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
