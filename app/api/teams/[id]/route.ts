// チームの名前変更・削除（管理者のみ）
// PATCH  /api/teams/[id]  { name }
// DELETE /api/teams/[id]   チーム目標・メンバー割り当ても一緒に消える（ON DELETE CASCADE）
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireResourceCompany, requireCallerCompany } from '@/lib/billing/guard'
import { getGoalActor, forbidden, badRequest, dbError, cleanText } from '@/lib/goals/server'

type RouteContext = { params: Promise<{ id: string }> }

async function requireTeamAdmin(id: string) {
  // URL の ID から会社を引き、呼び出し元の所属を照合する
  const resource = await requireResourceCompany('teams', id)
  if (resource.error) return { error: resource.error }
  const caller = await requireCallerCompany()
  if (caller.error) return { error: caller.error }
  const actor = await getGoalActor(resource.companyId, caller.authId)
  if (!actor.isAdmin) return { error: forbidden('チームは管理者だけが変更できます') }
  return { companyId: resource.companyId }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const target = await requireTeamAdmin(id)
    if (target.error) return target.error

    const body = await request.json().catch(() => null)
    const name = cleanText(body?.name, 100)
    if (!name) return badRequest('チーム名を入力してください')

    const { data, error } = await getSupabaseAdmin()
      .from('teams').update({ name }).eq('id', id).select('id, company_id, name, created_at').single()
    if (error) return dbError(error)

    return NextResponse.json({ team: data })
  } catch (err) {
    console.error('[api/teams/[id]] PATCH error:', err)
    return NextResponse.json({ error: 'チームの更新に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const target = await requireTeamAdmin(id)
    if (target.error) return target.error

    // 影響行で消えたかを確かめる
    const { data, error } = await getSupabaseAdmin()
      .from('teams').delete().eq('id', id).eq('company_id', target.companyId).select('id')
    if (error) return dbError(error)
    if (!data?.length) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/teams/[id]] DELETE error:', err)
    return NextResponse.json({ error: 'チームの削除に失敗しました' }, { status: 500 })
  }
}
