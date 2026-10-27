// KPI総合サマリー + KPI一覧カード（編集・削除ボタン付き）
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2, AlertCircle } from 'lucide-react'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  isOverdue,
  formatDate,
  type GoalKpi,
} from './kpi-utils'

type Props = {
  kpis: GoalKpi[]
  weightedProgress: number
  statusCounts: { not_started: number; in_progress: number; completed: number }
  totalWeight: number
  canEdit: boolean
  canReview: boolean
  openKpiAdd: () => void
  openKpiEdit: (kpi: GoalKpi) => void
  handleKpiDelete: (kpiId: string) => void
}

export function KpiListCard({
  kpis,
  weightedProgress,
  statusCounts,
  totalWeight,
  canEdit,
  canReview,
  openKpiAdd,
  openKpiEdit,
  handleKpiDelete,
}: Props) {
  return (
    <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-4 sm:p-5">
        {kpis.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold">KPI 総合進捗率</h2>
              <span className="text-2xl font-bold text-foreground">{weightedProgress}%</span>
            </div>
            <Progress value={weightedProgress} className="h-3 mb-4" animate />
            <div className="flex flex-wrap gap-2 mb-5">
              <Badge variant="secondary" className={STATUS_COLORS.not_started}>未着手 {statusCounts.not_started}</Badge>
              <Badge variant="secondary" className={STATUS_COLORS.in_progress}>進行中 {statusCounts.in_progress}</Badge>
              <Badge variant="secondary" className={STATUS_COLORS.completed}>達成 {statusCounts.completed}</Badge>
              <Badge variant="secondary" className="bg-purple-50 text-purple-700">配分合計 {totalWeight}%</Badge>
            </div>
          </>
        )}

        {kpis.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              {canEdit ? 'KPIが未設定です。KPIを追加してください。' : 'KPIが未設定です。'}
            </p>
            {canEdit && (
              <Button onClick={openKpiAdd} className="gap-1.5">
                <Plus size={16} />
                KPIを追加
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {kpis.map(kpi => {
                const overdue = isOverdue(kpi.deadline, kpi.status)
                return (
                  <div key={kpi.id} className="bg-background rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="text-sm font-bold text-foreground flex-1">{kpi.title}</h3>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[kpi.status]}`}>
                          {STATUS_LABELS[kpi.status]}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-700">
                          配分 {kpi.weight}%
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      <Progress value={kpi.progress} className="flex-1 h-2" animate />
                      <span className="text-xs font-semibold text-foreground w-10 text-right">{kpi.progress}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      {kpi.deadline && (
                        <span className={`text-[11px] flex items-center gap-0.5 ${overdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                          {overdue && <AlertCircle size={14} />}
                          期限: {formatDate(kpi.deadline)}
                          {overdue && ' (期限超過)'}
                        </span>
                      )}
                      {!kpi.deadline && <span />}
                      {canEdit ? (
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" className="size-11" onClick={() => openKpiEdit(kpi)}>
                            <Pencil size={16} />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-11 text-destructive hover:text-destructive">
                                <Trash2 size={16} />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>KPIを削除しますか？</AlertDialogTitle>
                                <AlertDialogDescription>「{kpi.title}」を削除します。この操作は取り消せません。</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleKpiDelete(kpi.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除する</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ) : canReview ? (
                        <Button variant="ghost" size="icon" className="size-11" onClick={() => openKpiEdit(kpi)}>
                          <Pencil size={16} />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
            {canEdit && kpis.length < 5 && (
              <div className="flex justify-end mt-4">
                <Button onClick={openKpiAdd} size="sm" variant="outline" className="gap-1.5">
                  <Plus size={14} />
                  KPIを追加
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
