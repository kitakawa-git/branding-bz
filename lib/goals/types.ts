// 目標（会社 → チーム → 個人 の3層）の型と、画面・API で共有する小さなヘルパー。
// テーブルは goals 1本（level で層を分ける）。旧 personal_goals は退避済み（20261027 のマイグレーション）
//
// 権限の正本は DB の RLS（goals_* / goal_kpis_* ポリシー）。
//   会社目標: 閲覧=自社全員 / 編集=管理者
//   チーム目標: 閲覧=自社全員 / 編集=そのチームのリーダー＋管理者
//   個人目標: 閲覧=本人＋同じチームのリーダー＋管理者 / 編集=本人
// 会社・チーム目標とチームの書き込みは API（app/api/goals・app/api/teams）経由。個人目標は画面から直接書く

export type GoalLevel = 'company' | 'team' | 'personal'

export type Goal = {
  id: string
  company_id: string
  period_id: string | null
  level: GoalLevel
  team_id: string | null
  owner_user_id: string | null
  parent_goal_id: string | null
  title: string
  description: string | null
  behavior_guideline_id: string | null
  created_at: string
  updated_at: string
}

export const GOAL_COLUMNS =
  'id, company_id, period_id, level, team_id, owner_user_id, parent_goal_id, title, description, behavior_guideline_id, created_at, updated_at'

export type Team = {
  id: string
  company_id: string
  name: string
  created_at: string
}

export type TeamRole = 'leader' | 'member'

export type TeamMember = {
  team_id: string
  user_id: string
  role: TeamRole
}

export const GOAL_LEVEL_LABELS: Record<GoalLevel, string> = {
  company: '会社目標',
  team: 'チーム目標',
  personal: 'わたしの目標',
}

type PeriodLike = { id: string; type: string; is_current: boolean | null; status: string | null }

/**
 * 「今の期間」を層に合わせて1つ選ぶ。
 * 今の期間は種類ごとに1つまで（DB の一意制約）なので、会社の「年度」と
 * チーム・個人の「半期」が同時に今の期間になりうる。
 *   会社目標 → 年度を優先
 *   チーム・個人 → 年度以外を優先（無ければ年度）
 * 期間が1つしかない会社（今はすべてこれ）は、どの層でも同じ期間になる
 */
export function pickCurrentPeriod<T extends PeriodLike>(periods: T[], level: GoalLevel): T | null {
  const current = periods.filter(p => p.is_current && p.status === 'active')
  if (current.length <= 1) return current[0] ?? null
  const year = current.find(p => p.type === 'year') ?? null
  const other = current.find(p => p.type !== 'year') ?? null
  return level === 'company' ? (year ?? other) : (other ?? year)
}

/** 今の期間の id 一覧（会社・チーム目標の一覧で、年度と半期の両方を拾うため） */
export function currentPeriodIds(periods: PeriodLike[]): string[] {
  return periods.filter(p => p.is_current && p.status === 'active').map(p => p.id)
}
