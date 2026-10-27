// わたしタブ上部の「わたしの目標 → チーム目標 → 会社目標」のつながり表示
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowUp, Link2 } from 'lucide-react'
import type { Goal, Team } from '@/lib/goals/types'
import type { GoalOption, PersonalGoal } from './kpi-utils'

type Props = {
  goal: PersonalGoal
  teamGoals: Goal[]
  companyGoals: Goal[]
  teams: Team[]
  guidelines: GoalOption[]
  canEdit: boolean
  openGoalEdit: () => void
}

export function GoalConnectionCard({ goal, teamGoals, companyGoals, teams, guidelines, canEdit, openGoalEdit }: Props) {
  const teamGoal = teamGoals.find(g => g.id === goal.parent_goal_id) ?? null
  const companyGoal = teamGoal ? companyGoals.find(g => g.id === teamGoal.parent_goal_id) ?? null : null
  const teamName = teamGoal ? teams.find(t => t.id === teamGoal.team_id)?.name : undefined
  const guideline = guidelines.find(g => g.id === goal.behavior_guideline_id) ?? null

  // つなぐ先がまだ無い会社（チーム目標が1つも無い）では出さない
  if (teamGoals.length === 0 && companyGoals.length === 0 && !guideline) return null

  return (
    <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-bold text-foreground m-0">目標のつながり</h2>
          {canEdit && !teamGoal && teamGoals.length > 0 && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={openGoalEdit}>
              <Link2 size={14} />チーム目標とつなげる
            </Button>
          )}
        </div>
        <ol className="m-0 p-0 list-none space-y-1">
          <ConnectionStep label="わたしの目標" title={goal.title} sub={guideline ? `行動指針：${guideline.title}` : null} strong />
          <StepArrow />
          <ConnectionStep label={teamName ? `チーム目標（${teamName}）` : 'チーム目標'} title={teamGoal?.title ?? null} empty="まだつながっていません" />
          <StepArrow />
          <ConnectionStep label="会社目標" title={companyGoal?.title ?? null} empty={teamGoal ? 'チーム目標が会社目標につながっていません' : '—'} />
        </ol>
      </CardContent>
    </Card>
  )
}

function ConnectionStep({ label, title, sub, empty, strong }: { label: string; title: string | null; sub?: string | null; empty?: string; strong?: boolean }) {
  return (
    <li className={`rounded-lg border px-4 py-2.5 ${strong ? 'bg-background' : 'bg-background/60'}`}>
      <p className="text-[11px] text-muted-foreground m-0">{label}</p>
      {title
        ? <p className={`m-0 mt-0.5 leading-relaxed text-foreground ${strong ? 'text-sm font-bold' : 'text-sm font-semibold'}`}>{title}</p>
        : <p className="m-0 mt-0.5 text-xs text-muted-foreground">{empty}</p>}
      {sub && <p className="m-0 mt-1 text-[11px] text-muted-foreground">{sub}</p>}
    </li>
  )
}

function StepArrow() {
  return (
    <li aria-hidden className="flex justify-center text-muted-foreground">
      <ArrowUp size={14} />
    </li>
  )
}
