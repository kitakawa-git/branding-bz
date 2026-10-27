// 会社目標・チーム目標の作成
// POST /api/goals  { level: 'company' | 'team', team_id?, title, description?, parent_goal_id?, period_id? }
//
// 個人目標はここでは扱わない（本人が画面から直接書く。RLS で本人だけ）
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireCallerCompany, guardCompanyFeature } from '@/lib/billing/guard'
import { GOAL_COLUMNS } from '@/lib/goals/types'
import { getGoalActor, canEditGoal, teamBelongsTo, defaultPeriodId, forbidden, badRequest, dbError, cleanText } from '@/lib/goals/server'

export async function POST(request: NextRequest) {
  try {
    const scope = await requireCallerCompany()
    if (scope.error) return scope.error
    const { companyId, authId } = scope

    const denied = await guardCompanyFeature(companyId, 'kpi')
    if (denied) return denied

    const body = await request.json().catch(() => null)
    const level = body?.level
    if (level !== 'company' && level !== 'team') return badRequest('level は company か team を指定してください')

    const title = cleanText(body?.title, 500)
    if (!title) return badRequest('目標を入力してください')
    const teamId = level === 'team' ? cleanText(body?.team_id, 64) : null
    if (level === 'team' && !teamId) return badRequest('チームを指定してください')

    // 他社のチームを指定させない（存在の有無は教えない）
    if (teamId && !(await teamBelongsTo(teamId, companyId))) return forbidden()

    const actor = await getGoalActor(companyId, authId)
    if (!canEditGoal(actor, level, teamId)) {
      return forbidden(level === 'company' ? '会社目標は管理者だけが作成できます' : 'チーム目標はそのチームのリーダーか管理者だけが作成できます')
    }

    const periodId = cleanText(body?.period_id, 64) ?? (await defaultPeriodId(companyId, level))

    // 親の層・期間が同じ会社かはトリガ（goals_check_relations）が確かめる
    const { data, error } = await getSupabaseAdmin()
      .from('goals')
      .insert({
        company_id: companyId,
        level,
        team_id: teamId,
        period_id: periodId,
        parent_goal_id: cleanText(body?.parent_goal_id, 64),
        title,
        description: cleanText(body?.description, 2000),
        created_by: authId,
      })
      .select(GOAL_COLUMNS)
      .single()
    if (error) return dbError(error)

    return NextResponse.json({ goal: data })
  } catch (err) {
    console.error('[api/goals] POST error:', err)
    return NextResponse.json({ error: '目標の作成に失敗しました' }, { status: 500 })
  }
}
