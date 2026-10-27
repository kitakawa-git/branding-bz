// 個人目標のつながり先（チーム目標・行動指針。どちらも任意）の入力欄。設定・編集ダイアログで共用
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Goal, Team } from '@/lib/goals/types'
import type { GoalOption } from './kpi-utils'

export const NO_LINK = 'none'

type Props = {
  /** 自分のチームのチーム目標を先に並べる */
  teamGoals: Goal[]
  teams: Team[]
  myTeamIds: Set<string>
  guidelines: GoalOption[]
  parentGoalId: string
  setParentGoalId: (id: string) => void
  guidelineId: string
  setGuidelineId: (id: string) => void
}

export function PersonalGoalLinkFields({ teamGoals, teams, myTeamIds, guidelines, parentGoalId, setParentGoalId, guidelineId, setGuidelineId }: Props) {
  const teamName = new Map(teams.map(t => [t.id, t.name]))
  const sorted = [...teamGoals].sort((a, b) => Number(myTeamIds.has(b.team_id ?? '')) - Number(myTeamIds.has(a.team_id ?? '')))
  if (sorted.length === 0 && guidelines.length === 0) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {sorted.length > 0 && (
        <div className="min-w-0">
          <Label className="text-xs font-bold mb-1.5 block">つながるチーム目標（任意）</Label>
          <Select value={parentGoalId} onValueChange={setParentGoalId}>
            <SelectTrigger className="h-10"><SelectValue placeholder="選択してください" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_LINK}>つなげない</SelectItem>
              {sorted.map(g => (
                <SelectItem key={g.id} value={g.id}>
                  {teamName.get(g.team_id ?? '') ? `【${teamName.get(g.team_id ?? '')}】` : ''}{g.title}
                </SelectItem>
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
