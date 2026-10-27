// 会社タブ: 今の期間の会社目標と会社KPI（閲覧のみ。作成・編集は管理画面）
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { GoalItem } from '@/components/goals/GoalItem'
import { GoalKpiSection } from '@/components/goals/GoalKpiSection'
import type { Goal } from '@/lib/goals/types'
import type { GoalKpi } from './kpi-utils'

type Props = {
  companyGoals: Goal[]
  teamGoals: Goal[]
  sharedKpis: GoalKpi[]
  contributionCounts: Record<string, number>
  userId: string
  isAdmin: boolean
}

export function CompanyGoalsTab({ companyGoals, teamGoals, sharedKpis, contributionCounts, userId, isAdmin }: Props) {
  if (companyGoals.length === 0) {
    return (
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground text-sm m-0">今の期間の会社目標はまだありません</p>
          {isAdmin && (
            <Link href="/admin/kpi/goals" className="inline-block mt-3 text-sm font-semibold text-ds-app-accent hover:underline no-underline">
              管理画面で会社目標を作成する
            </Link>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-4 sm:p-5 space-y-4">
        {companyGoals.map(g => {
          const linked = teamGoals.filter(t => t.parent_goal_id === g.id).length
          return (
            <div key={g.id}>
              <GoalItem goal={g} editable={false} />
              {linked > 0 && <p className="text-[11px] text-muted-foreground m-0 mt-1 ml-1">つながるチーム目標 {linked}件</p>}
              <GoalKpiSection
                goal={g}
                kpis={sharedKpis.filter(k => k.goal_id === g.id)}
                editable={false}
                userId={userId}
                contributionCounts={contributionCounts}
                onChanged={() => {}}
              />
            </div>
          )
        })}
        {isAdmin && (
          <div className="pt-1 text-right">
            <Link href="/admin/kpi/goals" className="text-xs text-muted-foreground hover:text-foreground no-underline">管理画面で編集する</Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
