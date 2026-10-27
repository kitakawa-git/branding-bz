// 会社目標・チーム目標の更新・削除
// PATCH  /api/goals/[id]  { title?, description?, parent_goal_id? }
// DELETE /api/goals/[id]
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireResourceCompany, requireCallerCompany, guardCompanyFeature } from '@/lib/billing/guard'
import { GOAL_COLUMNS, type GoalLevel } from '@/lib/goals/types'
import { getGoalActor, canEditGoal, forbidden, badRequest, dbError, cleanText } from '@/lib/goals/server'

type RouteContext = { params: Promise<{ id: string }> }

/** 対象の目標を引いて、呼び出し元が編集できるかを確かめる */
async function loadEditableGoal(id: string) {
  // URL の ID から会社を引き、呼び出し元の所属を照合する（他社の ID を渡されても通さない）
  const resource = await requireResourceCompany('goals', id)
  if (resource.error) return { error: resource.error }
  const caller = await requireCallerCompany()
  if (caller.error) return { error: caller.error }

  const { data: goal } = await getSupabaseAdmin()
    .from('goals').select('id, level, team_id').eq('id', id).single()
  if (!goal) return { error: NextResponse.json({ error: '見つかりません' }, { status: 404 }) }
  if (goal.level === 'personal') return { error: badRequest('個人目標はここでは変更できません') }

  const actor = await getGoalActor(resource.companyId, caller.authId)
  if (!canEditGoal(actor, goal.level as GoalLevel, goal.team_id)) return { error: forbidden() }

  return { companyId: resource.companyId }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const target = await loadEditableGoal(id)
    if (target.error) return target.error

    const denied = await guardCompanyFeature(target.companyId, 'kpi')
    if (denied) return denied

    const body = await request.json().catch(() => null)
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body && 'title' in body) {
      const title = cleanText(body.title, 500)
      if (!title) return badRequest('目標を入力してください')
      patch.title = title
    }
    if (body && 'description' in body) patch.description = cleanText(body.description, 2000)
    if (body && 'parent_goal_id' in body) patch.parent_goal_id = cleanText(body.parent_goal_id, 64)

    const { data, error } = await getSupabaseAdmin()
      .from('goals').update(patch).eq('id', id).select(GOAL_COLUMNS).single()
    if (error) return dbError(error)

    return NextResponse.json({ goal: data })
  } catch (err) {
    console.error('[api/goals/[id]] PATCH error:', err)
    return NextResponse.json({ error: '目標の更新に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const target = await loadEditableGoal(id)
    if (target.error) return target.error

    // 影響行で消えたかを確かめる（0 件なら消えていない）
    const { data, error } = await getSupabaseAdmin()
      .from('goals').delete().eq('id', id).eq('company_id', target.companyId).select('id')
    if (error) return dbError(error)
    if (!data?.length) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/goals/[id]] DELETE error:', err)
    return NextResponse.json({ error: '目標の削除に失敗しました' }, { status: 500 })
  }
}
