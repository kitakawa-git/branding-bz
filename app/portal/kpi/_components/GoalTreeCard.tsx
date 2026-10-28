// わたしタブ上部: 会社目標 → チーム目標 → わたしの目標 を縦の線でつなぐツリー（目標名はここで1回だけ出す）
// 個人目標が会社目標に直接つながっているとき（チームを作らない会社など）は 会社目標 → わたしの目標 の2段
// 左に幅12pxのレール（点と線）、右に中身。会社・チーム目標を押すとそのタブの該当目標へ移る
import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Pencil, CalendarDays, Link2 } from 'lucide-react'
import type { Goal, Team } from '@/lib/goals/types'
import {
  PERIOD_TYPE_LABELS,
  STATUS_COLORS,
  formatDateShort,
  getRemainingDays,
  type GoalOption,
  type GoalPeriod,
  type PersonalGoal,
} from './kpi-utils'

type Props = {
  goal: PersonalGoal
  goalPeriod: GoalPeriod | null
  teamGoals: Goal[]
  companyGoals: Goal[]
  teams: Team[]
  guidelines: GoalOption[]
  /** 期間 id → 表示名（「2026年度」など） */
  periodLabels: Record<string, string>
  canEdit: boolean
  /** 目標の編集ダイアログ（つながるチーム目標・行動指針も選べる） */
  openGoalEdit: () => void
  /** 会社・チーム目標を押したとき（そのタブの該当目標へ移る） */
  onJump: (tab: 'company' | 'team', goalId: string) => void
}

export function GoalTreeCard({ goal, goalPeriod, teamGoals, companyGoals, teams, guidelines, periodLabels, canEdit, openGoalEdit, onJump }: Props) {
  const teamGoal = teamGoals.find(g => g.id === goal.parent_goal_id) ?? null
  // 会社目標: チーム目標の親、または個人目標が直接つながっている会社目標
  const directCompanyGoal = teamGoal ? null : companyGoals.find(g => g.id === goal.parent_goal_id) ?? null
  const companyGoal = teamGoal ? companyGoals.find(g => g.id === teamGoal.parent_goal_id) ?? null : directCompanyGoal
  const linked = !!teamGoal || !!directCompanyGoal
  // つなげる先の候補（チーム目標があればそちらを案内。無ければ会社目標）
  const linkTarget = teamGoals.length > 0 ? 'チーム目標' : companyGoals.length > 0 ? '会社目標' : null
  const teamName = teamGoal ? teams.find(t => t.id === teamGoal.team_id)?.name : undefined
  const companyPeriodLabel = companyGoal?.period_id ? periodLabels[companyGoal.period_id] : undefined
  const guideline = guidelines.find(g => g.id === goal.behavior_guideline_id) ?? null

  return (
    <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-4 sm:p-5">
        {linked ? (
          <>
            {/* 1. 会社目標 */}
            <TreeRow rail={<RailDot />}>
              {companyGoal ? (
                <>
                  <span className="text-xs text-muted-foreground">会社目標{companyPeriodLabel ? `・${companyPeriodLabel}` : ''}</span>
                  <GoalLink title={companyGoal.title} onClick={() => onJump('company', companyGoal.id)} />
                </>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground">会社目標</span>
                  <span className="text-sm text-muted-foreground">チーム目標がまだ会社目標につながっていません</span>
                </>
              )}
            </TreeRow>
            {/* 2. チーム目標（会社目標に直接つながっているときは無し） */}
            {teamGoal && (
              <TreeRow rail={<RailDot />}>
                <span className="text-xs text-muted-foreground">チーム目標{teamName ? `・${teamName}` : ''}</span>
                <GoalLink title={teamGoal.title} onClick={() => onJump('team', teamGoal.id)} />
              </TreeRow>
            )}
          </>
        ) : (
          // どこにもつながっていない: 1・2行目の代わりに点線の箱
          <TreeRow rail={<RailDot dashed />}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-dashed border-muted-foreground/40 bg-background px-3.5 py-2.5">
              <span className="text-sm text-muted-foreground">
                {linkTarget === 'チーム目標'
                  ? 'チーム目標とつなげると、会社目標までの道すじが見えます'
                  : linkTarget === '会社目標'
                    ? '会社目標とつなげると、会社の目標とのつながりが見えます'
                    : '会社目標やチーム目標ができると、つなげて道すじが見られます'}
              </span>
              {canEdit && linkTarget && (
                <Button size="sm" className="h-9 gap-1.5 shrink-0 self-start sm:self-auto" onClick={openGoalEdit}>
                  <Link2 size={14} />{linkTarget}とつなげる
                </Button>
              )}
            </div>
          </TreeRow>
        )}

        {/* 3. わたしの目標（主役） */}
        <div className="flex gap-4">
          <div className="w-3 shrink-0 flex flex-col items-center pt-3" aria-hidden>
            <div className="size-3 rounded-full bg-foreground" />
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex flex-col gap-0.5">
                <span className="text-xs font-bold text-foreground">わたしの目標</span>
                <h2 className="text-[26px] font-bold text-foreground m-0 leading-snug break-words">{goal.title}</h2>
                {guideline && <span className="text-xs text-muted-foreground mt-0.5">行動指針：{guideline.title}</span>}
              </div>
              {canEdit && (
                <Button variant="ghost" size="icon" className="size-11 shrink-0 -mr-2" aria-label="目標を編集" onClick={openGoalEdit}>
                  <Pencil size={18} />
                </Button>
              )}
            </div>
            {goalPeriod && (
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted-foreground">
                <CalendarDays size={16} className="shrink-0" />
                <span>{PERIOD_TYPE_LABELS[goalPeriod.type]}（{formatDateShort(goalPeriod.start_date)}〜{formatDateShort(goalPeriod.end_date)}）</span>
                <PeriodBadge goalPeriod={goalPeriod} />
                {canEdit && linked && (
                  <button type="button" onClick={openGoalEdit} className="ml-auto text-[13px] text-ds-app-accent hover:underline bg-transparent border-0 p-0 cursor-pointer">
                    つながりを変える
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function TreeRow({ rail, children }: { rail: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-4">
      {rail}
      <div className="flex-1 min-w-0 pb-3.5 flex flex-col gap-0.5">{children}</div>
    </div>
  )
}

// 上の2行のレール: 点＋下へ伸びる線（つながっていないときは点線）
function RailDot({ dashed = false }: { dashed?: boolean }) {
  return (
    <div className={`w-3 shrink-0 flex flex-col items-center ${dashed ? 'pt-2.5' : 'pt-1.5'}`} aria-hidden>
      {dashed ? (
        <>
          <div className="size-2.5 rounded-full border-2 border-dashed border-muted-foreground/50" />
          <div className="flex-1 border-l-2 border-dashed border-border" />
        </>
      ) : (
        <>
          <div className="size-2.5 rounded-full bg-muted-foreground/40" />
          <div className="flex-1 w-0.5 bg-border" />
        </>
      )}
    </div>
  )
}

function GoalLink({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left text-[15px] text-foreground/80 hover:text-foreground hover:underline bg-transparent border-0 p-0 cursor-pointer break-words"
    >
      {title}
    </button>
  )
}

function PeriodBadge({ goalPeriod }: { goalPeriod: GoalPeriod }) {
  const remaining = getRemainingDays(goalPeriod.end_date)
  const untilStart = getRemainingDays(goalPeriod.start_date)
  if (remaining < 0) return <Badge variant="secondary" className="text-[11px] px-1.5 py-0 bg-red-100 text-red-700">期間終了</Badge>
  if (untilStart > 0) return <Badge variant="secondary" className="text-[11px] px-1.5 py-0 bg-amber-100 text-amber-700">開始まで{untilStart}日</Badge>
  return <Badge variant="secondary" className={`text-[11px] px-1.5 py-0 ${STATUS_COLORS.in_progress}`}>進行中</Badge>
}
