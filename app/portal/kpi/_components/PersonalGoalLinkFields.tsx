// 個人目標のつながり先（チーム目標か会社目標・行動指針。どちらも任意）の入力欄。設定・編集ダイアログで共用
// 会社目標へ直接つなげるのは、チームを作らない会社や、チームに入っていない人のため
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Goal, Team } from '@/lib/goals/types'
import type { GoalOption } from './kpi-utils'

export const NO_LINK = 'none'

type Props = {
  /** 自分のチームのチーム目標を先に並べ、会社目標はその後 */
  teamGoals: Goal[]
  companyGoals: Goal[]
  teams: Team[]
  myTeamIds: Set<string>
  guidelines: GoalOption[]
  parentGoalId: string
  setParentGoalId: (id: string) => void
  guidelineId: string
  setGuidelineId: (id: string) => void
}

export function PersonalGoalLinkFields({ teamGoals, companyGoals, teams, myTeamIds, guidelines, parentGoalId, setParentGoalId, guidelineId, setGuidelineId }: Props) {
  const teamName = new Map(teams.map(t => [t.id, t.name]))
  const sorted = [...teamGoals].sort((a, b) => Number(myTeamIds.has(b.team_id ?? '')) - Number(myTeamIds.has(a.team_id ?? '')))
  const hasParents = sorted.length > 0 || companyGoals.length > 0
  if (!hasParents && guidelines.length === 0) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {hasParents && (
        <div className="min-w-0">
          <Label className="text-xs font-bold mb-1.5 block">つながる目標（任意）</Label>
          <Select value={parentGoalId} onValueChange={setParentGoalId}>
            <SelectTrigger className="h-10"><SelectValue placeholder="選択してください" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_LINK}>つなげない</SelectItem>
              {sorted.map(g => (
                <SelectItem key={g.id} value={g.id}>
                  {teamName.get(g.team_id ?? '') ? `【${teamName.get(g.team_id ?? '')}】` : ''}{g.title}
                </SelectItem>
              ))}
              {companyGoals.map(g => (
                <SelectItem key={g.id} value={g.id}>【会社目標】{g.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {guidelines.length > 0 && (
        <div className="min-w-0">
          <Label className="text-xs font-bold mb-1.5 block">意識する行動指針（任意）</Label>
          <Select value={guidelineId} onValueChange={setGuidelineId}>
            <SelectTrigger className="h-10"><SelectValue placeholder="選択してください" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_LINK}>選ばない</SelectItem>
              {guidelines.map(g => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
