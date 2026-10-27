// 会社・チーム目標とチームを書き込む API（app/api/goals・app/api/teams）の共通処理（サーバー専用）。
//
// API は service_role で書くので RLS が効かない。権限は DB の RLS と同じ条件をここで確かめる:
//   会社目標・チーム管理 → その会社の管理者
//   チーム目標           → その会社の管理者、またはそのチームのリーダー
// 会社は必ずセッションから決める（requireCallerCompany / requireResourceCompany）。body の company_id は受け取らない
import 'server-only'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { pickCurrentPeriod, type GoalLevel } from './types'

export type GoalActor = {
  isAdmin: boolean
  /** リーダーを務めているチーム（この会社のもの） */
  leaderTeamIds: Set<string>
}

export async function getGoalActor(companyId: string, authId: string): Promise<GoalActor> {
  const admin = getSupabaseAdmin()
  const [{ data: adminRow }, { data: leaderRows }] = await Promise.all([
    admin.from('admin_users').select('id').eq('auth_id', authId).eq('company_id', companyId).maybeSingle(),
    admin.from('team_members').select('team_id, teams!inner(company_id)').eq('user_id', authId).eq('role', 'leader').eq('teams.company_id', companyId),
  ])
  return {
    isAdmin: !!adminRow,
    leaderTeamIds: new Set((leaderRows || []).map((r: { team_id: string }) => r.team_id)),
  }
}

/** その層の目標を編集できるか（team は team_id が必要） */
export function canEditGoal(actor: GoalActor, level: GoalLevel, teamId: string | null): boolean {
  if (level === 'company') return actor.isAdmin
  if (level === 'team') return actor.isAdmin || (!!teamId && actor.leaderTeamIds.has(teamId))
  return false
}

/** チームがその会社のものか */
export async function teamBelongsTo(teamId: string, companyId: string): Promise<boolean> {
  const { data } = await getSupabaseAdmin().from('teams').select('id').eq('id', teamId).eq('company_id', companyId).maybeSingle()
  return !!data
}

/** 期間の指定が無いときの既定（今の期間を層に合わせて選ぶ。期間が無い会社は null） */
export async function defaultPeriodId(companyId: string, level: GoalLevel): Promise<string | null> {
  const { data } = await getSupabaseAdmin()
    .from('goal_periods')
    .select('id, type, is_current, status')
    .eq('company_id', companyId)
    .eq('is_current', true)
  return pickCurrentPeriod(data || [], level)?.id ?? null
}

export function forbidden(message = 'この操作を行う権限がありません'): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 })
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * DB のエラーを返す。整合チェックのトリガ（goals_check_relations 等）は
 * raise exception（P0001）で日本語の理由を返すので、それは 400 にしてそのまま見せる
 */
export function dbError(error: { code?: string; message: string }): NextResponse {
  if (error.code === 'P0001') return badRequest(error.message)
  if (error.code === '23505') return badRequest('同じ内容がすでに登録されています')
  if (error.code === '23503') return badRequest('指定した項目が見つかりません')
  return NextResponse.json({ error: error.message }, { status: 500 })
}

/** 文字列の入力を整える。空なら null */
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}
