'use client'

// 会社目標・チーム・チーム目標の管理（管理画面）
// 読み取りは RLS（管理者は自社のすべてが見える）、書き込みは API（app/api/goals・app/api/teams）
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../../components/AdminDataProvider'
import { isFeatureEnabled } from '@/lib/constants/feature-toggles'
import { can } from '@/lib/billing/entitlements'
import { PlanUpsell } from '@/components/billing/plan-gate'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Plus, Pencil, Trash2, Users, Building2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { GoalItem } from '@/components/goals/GoalItem'
import { GoalFormDialog, type GoalFormTarget } from '@/components/goals/GoalFormDialog'
import { goalsApi } from '@/lib/goals/client'
import { GOAL_COLUMNS, currentPeriodIds, type Goal, type Team, type TeamMember } from '@/lib/goals/types'
import { TeamMembersDialog, type CompanyMember } from './TeamMembersDialog'

export default function AdminGoalsPage() {
  const { companyId, company } = useAuth()
  const kpiEnabled = isFeatureEnabled(company, 'kpi_enabled')

  const [loading, setLoading] = useState(true)
  const [companyGoals, setCompanyGoals] = useState<Goal[]>([])
  const [teamGoals, setTeamGoals] = useState<Goal[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [members, setMembers] = useState<CompanyMember[]>([])

  const [goalForm, setGoalForm] = useState<GoalFormTarget | null>(null)
  const [membersTeam, setMembersTeam] = useState<Team | null>(null)
  const [newTeamName, setNewTeamName] = useState('')
  const [creatingTeam, setCreatingTeam] = useState(false)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)

  // useCallback にしない（React Compiler がメモ化する）
  const fetchData = async () => {
    if (!companyId) return
    try {
      const [periodsRes, goalsRes, teamsRes, teamMembersRes, membersRes] = await Promise.all([
        supabase.from('goal_periods').select('id, type, is_current, status').eq('company_id', companyId),
        supabase.from('goals').select(GOAL_COLUMNS).eq('company_id', companyId).in('level', ['company', 'team']).order('created_at', { ascending: true }),
        supabase.from('teams').select('id, company_id, name, created_at').eq('company_id', companyId).order('created_at', { ascending: true }),
        supabase.from('team_members').select('team_id, user_id, role'),
        supabase.from('members').select('auth_id, display_name, profile:profiles(name, department)').eq('company_id', companyId).eq('is_active', true),
      ])

      // 今の期間の目標（年度と半期の両方が今の期間になりうる。期間が無い会社は期間なし）
      const nowIds = currentPeriodIds(periodsRes.data || [])
      const goals = ((goalsRes.data || []) as Goal[])
        .filter(g => (nowIds.length > 0 ? nowIds.includes(g.period_id ?? '') : g.period_id === null))
      const teamRows = (teamsRes.data || []) as Team[]
      const teamIds = new Set(teamRows.map(t => t.id))

      setCompanyGoals(goals.filter(g => g.level === 'company'))
      setTeamGoals(goals.filter(g => g.level === 'team'))
      setTeams(teamRows)
      setTeamMembers(((teamMembersRes.data || []) as TeamMember[]).filter(m => teamIds.has(m.team_id)))
      setMembers(
        (membersRes.data || [])
          .map((m: { auth_id: string; display_name: string; profile: { name: string; department: string | null } | { name: string; department: string | null }[] | null }) => {
            const p = Array.isArray(m.profile) ? m.profile[0] : m.profile
            return { authId: m.auth_id, name: p?.name || m.display_name || '不明', department: p?.department?.trim() || null }
          })
          .sort((a, b) => (a.department ?? '').localeCompare(b.department ?? '', 'ja') || a.name.localeCompare(b.name, 'ja')),
      )
    } catch (err) {
      console.error('[AdminGoals] Error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (companyId) fetchData()
    // 会社が変わったときだけ取り直す（fetchData は描画ごとに作り直される）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const memberName = new Map(members.map(m => [m.authId, m.name]))
  const companyTitle = new Map(companyGoals.map(g => [g.id, g.title]))
  // チーム名の候補（部署名のうち、まだチームが無いもの）。押すと入力欄に入るだけで作成はしない
  const departmentSuggestions = [...new Set(members.map(m => m.department).filter((d): d is string => !!d))]
    .filter(d => !teams.some(t => t.name === d))
    .sort()

  const deleteGoal = async (goal: Goal) => {
    try {
      await goalsApi(`/api/goals/${goal.id}`, 'DELETE')
      toast.success('目標を削除しました')
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '削除に失敗しました')
    }
  }

  const createTeam = async () => {
    if (!newTeamName.trim()) return
    setCreatingTeam(true)
    try {
      await goalsApi('/api/teams', 'POST', { name: newTeamName.trim() })
      toast.success('チームを作成しました')
      setNewTeamName('')
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '作成に失敗しました')
    } finally {
      setCreatingTeam(false)
    }
  }

  const saveRename = async () => {
    if (!renaming || !renaming.name.trim()) return
    try {
      await goalsApi(`/api/teams/${renaming.id}`, 'PATCH', { name: renaming.name.trim() })
      toast.success('チーム名を変更しました')
      setRenaming(null)
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '変更に失敗しました')
    }
  }

  const deleteTeam = async (team: Team) => {
    try {
      await goalsApi(`/api/teams/${team.id}`, 'DELETE')
      toast.success('チームを削除しました')
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '削除に失敗しました')
    }
  }

  if (!can(company, 'kpi')) {
    return <PlanUpsell company={company} feature="kpi" title="目標・KPI管理を使うには" benefits={['会社 → チーム → 個人 の目標をつなげて管理', 'チームごとにリーダーが目標を設定']} />
  }
  if (!kpiEnabled) {
    return (
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="py-16 text-center">
          <p className="text-muted-foreground text-[15px] m-0 mb-4">この機能は現在オフになっています。設定ページから再度オンにできます。</p>
          <Link href="/admin/settings" className="text-sm font-semibold text-ds-app-accent hover:underline no-underline">設定ページを開く</Link>
        </CardContent>
      </Card>
    )
  }
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <Card key={i} className="bg-[hsl(0_0%_97%)] border shadow-none"><CardContent className="p-5 space-y-3"><Skeleton className="h-4 w-32" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></CardContent></Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Link href="/admin/kpi" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground no-underline">
        <ArrowLeft size={14} />目標・KPI管理へ戻る
      </Link>

      {/* ===== 会社目標 ===== */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-muted-foreground" />
              <h2 className="text-xs font-bold m-0">会社目標（今の期間）</h2>
            </div>
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setGoalForm({ mode: 'create', level: 'company' })}>
              <Plus size={14} />会社目標を追加
            </Button>
          </div>
          {companyGoals.length > 0 ? (
            <div className="space-y-2">
              {companyGoals.map(g => (
                <GoalItem key={g.id} goal={g} editable onEdit={() => setGoalForm({ mode: 'edit', goal: g })} onDelete={() => deleteGoal(g)} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground m-0">まだありません。チーム目標・個人目標がつながる、会社全体の目標を立てましょう。</p>
          )}
        </CardContent>
      </Card>

      {/* ===== チーム ===== */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-muted-foreground" />
            <h2 className="text-xs font-bold m-0">チームとチーム目標</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Input
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) createTeam() }}
              placeholder="新しいチーム名"
              className="h-9 w-60 text-sm"
            />
            <Button size="sm" className="h-9" onClick={createTeam} disabled={creatingTeam || !newTeamName.trim()}>
              {creatingTeam ? '作成中...' : 'チームを作成'}
            </Button>
          </div>
          {departmentSuggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-4">
              <span className="text-[11px] text-muted-foreground mr-1">部署名から入力：</span>
              {departmentSuggestions.map(d => (
                <button key={d} type="button" onClick={() => setNewTeamName(d)} className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                  {d}
                </button>
              ))}
            </div>
          )}

          {teams.length === 0 ? (
            <p className="text-xs text-muted-foreground m-0 mt-4">チームはまだありません。</p>
          ) : (
            <div className="space-y-3 mt-4">
              {teams.map(team => {
                const tm = teamMembers.filter(m => m.team_id === team.id)
                const leaders = tm.filter(m => m.role === 'leader')
                const goals = teamGoals.filter(g => g.team_id === team.id)
                return (
                  <div key={team.id} className="rounded-lg border bg-background p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        {renaming?.id === team.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={renaming.name}
                              onChange={e => setRenaming({ id: team.id, name: e.target.value })}
                              onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) saveRename() }}
                              className="h-8 w-52 text-sm"
                              autoFocus
                            />
                            <Button size="sm" className="h-8" onClick={saveRename} disabled={!renaming.name.trim()}>保存</Button>
                            <Button size="sm" variant="ghost" className="h-8" onClick={() => setRenaming(null)}>やめる</Button>
                          </div>
                        ) : (
                          <h3 className="text-sm font-bold text-foreground m-0">{team.name}</h3>
                        )}
                        <p className="text-xs text-muted-foreground m-0 mt-1">
                          リーダー：{leaders.length > 0 ? leaders.map(m => memberName.get(m.user_id) ?? '不明').join('、') : <span className="text-red-600">未設定</span>}
                          <span className="mx-1.5">・</span>メンバー {tm.length}名
                        </p>
                      </div>
                      <div className="flex items-center shrink-0 -mr-2">
                        <Button size="sm" variant="outline" className="h-8 gap-1 mr-1" onClick={() => setMembersTeam(team)}>
                          <Users size={14} />メンバー
                        </Button>
                        <Button variant="ghost" size="icon" className="size-9" aria-label="チーム名を変更" onClick={() => setRenaming({ id: team.id, name: team.name })}>
                          <Pencil size={15} />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-9 text-destructive hover:text-destructive" aria-label="チームを削除">
                              <Trash2 size={15} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>チームを削除しますか？</AlertDialogTitle>
                              <AlertDialogDescription>
                                「{team.name}」と、このチームのチーム目標（{goals.length}件）・メンバーの割り当てを削除します。個人目標は残ります（チーム目標とのつながりは外れます）。この操作は取り消せません。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>キャンセル</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteTeam(team)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除する</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] font-bold text-muted-foreground">チーム目標 <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">{goals.length}</Badge></span>
                      <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setGoalForm({ mode: 'create', level: 'team', teamId: team.id, teamName: team.name })}>
                        <Plus size={13} />追加
                      </Button>
                    </div>
                    {goals.length > 0 ? (
                      <div className="space-y-2">
                        {goals.map(g => (
                          <GoalItem
                            key={g.id}
                            goal={g}
                            parentTitle={g.parent_goal_id ? companyTitle.get(g.parent_goal_id) ?? null : null}
                            editable
                            onEdit={() => setGoalForm({ mode: 'edit', goal: g, teamName: team.name })}
                            onDelete={() => deleteGoal(g)}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground m-0">まだありません（リーダーもポータルの「目標・KPI」→「チーム」から作成できます）</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <GoalFormDialog target={goalForm} onClose={() => setGoalForm(null)} companyGoals={companyGoals} onSaved={fetchData} />
      <TeamMembersDialog team={membersTeam} onClose={() => setMembersTeam(null)} members={members} teamMembers={teamMembers} onSaved={fetchData} />
    </div>
  )
}
