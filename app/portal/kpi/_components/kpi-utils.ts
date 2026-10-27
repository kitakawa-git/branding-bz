// 目標・KPI管理ページの型・定数・ヘルパー
import type { Goal, Team, TeamMember } from '@/lib/goals/types'

// ============================================
// Types
// ============================================

export type GoalKpi = {
  id: string
  goal_id: string
  company_id: string
  user_id: string
  title: string
  deadline: string | null
  progress: number
  weight: number
  status: 'not_started' | 'in_progress' | 'completed'
  created_at: string
  updated_at: string
  /** 上位（チーム・会社）の KPI への寄与。任意 */
  contributes_to_kpi_id?: string | null
}

// 個人目標は goals（level='personal'）の1行
export type PersonalGoal = Goal

export type GoalPeriod = {
  type: 'quarter' | 'half' | 'year' | 'custom'
  start_date: string
  end_date: string
  show_goal_banner?: boolean
  show_review_banner?: boolean
}

export type GoalPeriodRecord = {
  id: string
  company_id: string
  type: string
  start_date: string
  end_date: string
  is_current: boolean
  status: 'active' | 'pending_approval' | 'archived'
  parent_period_id?: string | null
  created_at: string
}

export type BrandValue = { name: string; description: string }

export type KpiFormItem = {
  id: string // temp id for form
  title: string
  deadline: Date | undefined
  weight: number
}

export type KpiEditForm = {
  title: string
  deadline: Date | undefined
  progress: number
  weight: number
  status: 'not_started' | 'in_progress' | 'completed'
  /** 寄与する上位（チーム）KPI の id。つなげないときは 'none' */
  contributesTo: string
}

export type ArchivedPeriodData = {
  goal: PersonalGoal | null
  kpis: GoalKpi[]
}

// 会社・チーム目標と、個人目標のつながり先の候補（会社 / チーム タブ・設定ダイアログで使う）
export type GoalOption = { id: string; title: string }

export type PortalGoalContext = {
  /** 今の期間の会社目標 */
  companyGoals: Goal[]
  /** 今の期間のチーム目標（全チーム分。閲覧は自社全員） */
  teamGoals: Goal[]
  teams: Team[]
  teamMembers: TeamMember[]
  /** auth_id → 表示名 */
  memberNames: Record<string, string>
  /** 行動指針（philosophy_elements の action_guideline） */
  guidelines: GoalOption[]
  /** 会社・チーム目標の KPI（チームタブ・個人 KPI の寄与先に使う） */
  sharedKpis: GoalKpi[]
  /** 上位 KPI の id → それに寄与している KPI の数（見えている分だけ。リーダーはメンバーの分も見える） */
  contributionCounts: Record<string, number>
}

export const emptyGoalContext: PortalGoalContext = { companyGoals: [], teamGoals: [], teams: [], teamMembers: [], memberNames: {}, guidelines: [], sharedKpis: [], contributionCounts: {} }

export type PortalKpiCache = {
  goal: PersonalGoal | null
  kpis: GoalKpi[]
  goalPeriod: GoalPeriod | null
  currentPeriodId: string | null
  archivedPeriods: GoalPeriodRecord[]
  goalContext: PortalGoalContext
}

// ============================================
// Constants
// ============================================

export const STATUS_LABELS: Record<string, string> = { not_started: '未着手', in_progress: '進行中', completed: '達成' }
export const STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-ds-app-accent-hover',
  completed: 'bg-green-100 text-green-700',
}
export const PERIOD_TYPE_LABELS: Record<string, string> = { quarter: '四半期', half: '半期', half_year: '半期', year: '年度', custom: 'カスタム' }
export const PERIOD_DURATION_LABELS: Record<string, string> = { quarter: '3ヶ月', half: '6ヶ月', half_year: '6ヶ月', year: '1年', custom: '' }

export const emptyKpiEditForm: KpiEditForm = { title: '', deadline: undefined, progress: 0, weight: 30, status: 'not_started', contributesTo: 'none' }

// ============================================
// Helpers
// ============================================

export function isOverdue(deadline: string | null, status: string): boolean {
  if (!deadline || status === 'completed') return false
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return new Date(deadline) < today
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
}

export function calcWeightedProgress(kpis: GoalKpi[]): number {
  if (kpis.length === 0) return 0
  let totalWeight = 0, weightedSum = 0
  kpis.forEach(k => { const w = k.weight || 0; weightedSum += k.progress * w; totalWeight += w })
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0
}

export function getRemainingDays(endDate: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const end = new Date(endDate); end.setHours(0, 0, 0, 0)
  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function getPeriodTitle(period: GoalPeriod | null): string {
  if (!period) return '目標とKPIを決めましょう！'
  const label = PERIOD_TYPE_LABELS[period.type] || ''
  const dur = PERIOD_DURATION_LABELS[period.type]
  const durStr = dur ? `（${dur}）` : ''
  return `${label}${durStr}目標とKPIを決めましょう！`
}
