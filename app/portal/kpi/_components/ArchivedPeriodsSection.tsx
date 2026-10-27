// 過去の目標・KPIセクション（期間ごとのアコーディオン）
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronDown, ChevronUp, Archive } from 'lucide-react'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PERIOD_TYPE_LABELS,
  formatDate,
  type ArchivedPeriodData,
  type GoalPeriodRecord,
} from './kpi-utils'

type Props = {
  archivedPeriods: GoalPeriodRecord[]
  expandedArchiveId: string | null
  archiveData: ArchivedPeriodData | null
  archiveLoading: boolean
  toggleArchive: (periodId: string) => void
}

export function ArchivedPeriodsSection({ archivedPeriods, expandedArchiveId, archiveData, archiveLoading, toggleArchive }: Props) {
  if (archivedPeriods.length === 0) return null
  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Archive size={16} className="text-muted-foreground" />
        <h2 className="text-sm font-bold text-foreground">過去の目標・KPI</h2>
      </div>
      <div className="space-y-2">
        {archivedPeriods.map(ap => {
          const isArchExp = expandedArchiveId === ap.id
          return (
            <Card key={ap.id} className="bg-[hsl(0_0%_97%)] border shadow-none">
              <CardContent className="p-0">
                <button onClick={() => toggleArchive(ap.id)} className="w-full p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{PERIOD_TYPE_LABELS[ap.type] || ap.type}</Badge>
                      <span className="text-sm text-foreground">{formatDate(ap.start_date)} 〜 {formatDate(ap.end_date)}</span>
                    </div>
                  </div>
                  {isArchExp ? <ChevronUp size={16} className="text-muted-foreground shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
                </button>

                {isArchExp && (
                  <div className="border-t px-4 pb-4 pt-3">
                    {archiveLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ) : !archiveData?.goal ? (
                      <p className="text-sm text-muted-foreground text-center py-4">この期間には目標が設定されていません</p>
                    ) : (
                      <div className="space-y-3">
                        <div className="bg-background rounded-xl p-3 border">
                          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">目標</Label>
                          <p className="text-sm font-semibold text-foreground mt-1 m-0">{archiveData.goal.title}</p>
                        </div>
                        {archiveData.kpis.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">KPI ({archiveData.kpis.length}件)</span>
                            {archiveData.kpis.map(k => (
                              <div key={k.id} className="bg-background rounded-xl p-3 border">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <span className="text-xs font-semibold text-foreground flex-1">{k.title}</span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Badge variant="secondary" className={`text-[9px] px-1 py-0 ${STATUS_COLORS[k.status]}`}>{STATUS_LABELS[k.status]}</Badge>
                                    <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-purple-50 text-purple-700">配分 {k.weight}%</Badge>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Progress value={k.progress} className="flex-1 h-1.5" />
                                  <span className="text-[10px] font-semibold w-7 text-right">{k.progress}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {archiveData.kpis.length === 0 && <p className="text-xs text-muted-foreground">KPIが設定されていません</p>}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
