// 目標カード（目標タイトル + 目標期間・残り日数）
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Pencil, CalendarDays } from 'lucide-react'
import {
  PERIOD_TYPE_LABELS,
  formatDateShort,
  getRemainingDays,
  type GoalPeriod,
  type PersonalGoal,
} from './kpi-utils'

type Props = {
  goal: PersonalGoal
  goalPeriod: GoalPeriod | null
  canEdit: boolean
  openGoalEdit: () => void
}

export function GoalCard({ goal, goalPeriod, canEdit, openGoalEdit }: Props) {
  return (
    <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="text-xl font-bold text-foreground m-0 leading-relaxed">{goal.title}</h2>
          {canEdit && (
            <Button variant="ghost" size="icon" className="size-11 shrink-0" onClick={openGoalEdit}>
              <Pencil size={16} />
            </Button>
          )}
        </div>
        {goalPeriod && (
          <div className="flex items-center gap-2">
            <CalendarDays size={14} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {PERIOD_TYPE_LABELS[goalPeriod.type]}（{formatDateShort(goalPeriod.start_date)} 〜 {formatDateShort(goalPeriod.end_date)}）
            </span>
            {(() => {
              const remaining = getRemainingDays(goalPeriod.end_date)
              const untilStart = getRemainingDays(goalPeriod.start_date)
              if (remaining < 0) return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700">期間終了</Badge>
              if (untilStart > 0) return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700">開始まで{untilStart}日</Badge>
              return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">残り{remaining}日</Badge>
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
