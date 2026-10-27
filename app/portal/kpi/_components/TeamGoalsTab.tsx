'use client'

// チームタブ: チームごとのチーム目標。自分のチームを先に並べる
// 作成・編集できるのは、そのチームのリーダーと管理者（API 側でも確かめる）
import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { GoalItem } from '@/components/goals/GoalItem'
import { GoalFormDialog, type GoalFormTarget } from '@/components/goals/GoalFormDialog'
import { GoalKpiSection } from '@/components/goals/GoalKpiSection'
import { goalsApi } from '@/lib/goals/client'
import type { Goal, Team, TeamMember } from '@/lib/goals/types'
import type { GoalKpi } from './kpi-utils'

type Props = {
  teams: Team[]
  teamMembers: TeamMember[]
  memberNames: Record<string, string>
  teamGoals: Goal[]
  companyGoals: Goal[]
  /** 会社・チーム目標の KPI */
  sharedKpis: GoalKpi[]
  contributionCounts: Record<string, number>
  userId: string
  isAdmin: boolean
  /** 目標を作成・編集・削除した後の取り直し */
  onChanged: () => void
}

export function TeamGoalsTab({ teams, teamMembers, memberNames, teamGoals, companyGoals, sharedKpis, contributionCounts, userId, isAdmin, onChanged }: Props) {
  const [formTarget, setFormTarget] = useState<GoalFormTarget | null>(null)

  if (teams.length === 0) {
    return (
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground text-sm m-0">チームはまだありません</p>
          {isAdmin && (
            <Link href="/admin/kpi/goals" className="inline-block mt-3 text-sm font-semibold text-ds-app-accent hover:underline no-underline">
              管理画面でチームを作成する
            </Link>
          )}
        </CardContent>
      </Card>
    )
  }

  const myTeamIds = new Set(teamMembers.filter(m => m.user_id === userId).map(m => m.team_id))
  const sortedTeams = [...teams].sort((a, b) => Number(myTeamIds.has(b.id)) - Number(myTeamIds.has(a.id)))
  const companyTitle = new Map(companyGoals.map(g => [g.id, g.title]))

  const handleDelete = async (goal: Goal) => {
    try {
      await goalsApi(`/api/goals/${goal.id}`, 'DELETE')
      toast.success('目標を削除しました')
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '削除に失敗しました')
    }
  }

  return (
    <div className="space-y-4">
      {sortedTeams.map(team => {
        const members = teamMembers.filter(m => m.team_id === team.id)
        const leaders = members.filter(m => m.role === 'leader')
        const canEdit = isAdmin || leaders.some(m => m.user_id === userId)
        const goals = teamGoals.filter(g => g.team_id === team.id)
        return (
          <Card key={team.id} className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-foreground m-0 flex items-center gap-2">
                    {team.name}
                    {myTeamIds.has(team.id) && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">所属</Badge>}
                  </h2>
                  <p className="text-xs text-muted-foreground m-0 mt-1">
                    リーダー：{leaders.length > 0 ? leaders.map(m => memberNames[m.user_id] ?? '不明').join('、') : '未設定'}
                    <span className="mx-1.5">・</span>メンバー {members.length}名
                  </p>
                </div>
                {canEdit && (
                  <Button variant="outline" size="sm" className="h-8 gap-1 shrink-0" onClick={() => setFormTarget({ mode: 'create', level: 'team', teamId: team.id, teamName: team.name })}>
                    <Plus size={14} />目標を追加
                  </Button>
                )}
              </div>
              {goals.length > 0 ? (
                <div className="space-y-4">
                  {goals.map(g => (
                    <div key={g.id}>
                      <GoalItem
                        goal={g}
                        parentTitle={g.parent_goal_id ? companyTitle.get(g.parent_goal_id) ?? null : null}
                        editable={canEdit}
                        onEdit={() => setFormTarget({ mode: 'edit', goal: g, teamName: team.name })}
                        onDelete={() => handleDelete(g)}
                      />
                      <GoalKpiSection
                        goal={g}
                        kpis={sharedKpis.filter(k => k.goal_id === g.id)}
                        editable={canEdit}
                        userId={userId}
                        contributionCounts={contributionCounts}
                        parentKpis={g.parent_goal_id ? sharedKpis.filter(k => k.goal_id === g.parent_goal_id) : []}
                        onChanged={onChanged}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground m-0">今の期間のチーム目標はまだありません</p>
              )}
            </CardContent>
          </Card>
        )
      })}

      <GoalFormDialog target={formTarget} onClose={() => setFormTarget(null)} companyGoals={companyGoals} onSaved={onChanged} />
    </div>
  )
}
