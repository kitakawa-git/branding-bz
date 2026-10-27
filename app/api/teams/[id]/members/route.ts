// チームのメンバー割り当て（管理者のみ）
// PUT /api/teams/[id]/members  { members: [{ user_id, role: 'leader' | 'member' }] }
// 渡した一覧でまるごと置き換える（一覧に無い人はチームから外れる）
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireResourceCompany, requireCallerCompany, guardCompanyFeature } from '@/lib/billing/guard'
import { getGoalActor, forbidden, badRequest, dbError } from '@/lib/goals/server'
import type { TeamRole } from '@/lib/goals/types'

type RouteContext = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    // URL の ID から会社を引き、呼び出し元の所属を照合する
    const resource = await requireResourceCompany('teams', id)
    if (resource.error) return resource.error
    const caller = await requireCallerCompany()
    if (caller.error) return caller.error
    const companyId = resource.companyId

    const denied = await guardCompanyFeature(companyId, 'kpi')
    if (denied) return denied

    const actor = await getGoalActor(companyId, caller.authId)
    if (!actor.isAdmin) return forbidden('メンバーの割り当ては管理者だけが変更できます')

    const body = await request.json().catch(() => null)
    if (!Array.isArray(body?.members)) return badRequest('members を指定してください')
    const wanted = new Map<string, TeamRole>()
    for (const m of body.members as { user_id?: unknown; role?: unknown }[]) {
      if (typeof m?.user_id !== 'string' || !m.user_id) return badRequest('user_id が不正です')
      wanted.set(m.user_id, m.role === 'leader' ? 'leader' : 'member')
    }

    const admin = getSupabaseAdmin()

    // 自社のメンバーだけ（他社のユーザーを入れさせない。DB のトリガでも止まる）
    if (wanted.size > 0) {
      const { data: rows, error } = await admin
        .from('members').select('auth_id').eq('company_id', companyId).in('auth_id', [...wanted.keys()])
      if (error) return dbError(error)
      const valid = new Set((rows || []).map((r: { auth_id: string }) => r.auth_id))
      if ([...wanted.keys()].some(uid => !valid.has(uid))) return badRequest('この会社のメンバーではない人が含まれています')
    }

    const { data: current, error: curErr } = await admin.from('team_members').select('user_id').eq('team_id', id)
    if (curErr) return dbError(curErr)
    const removed = (current || []).map((r: { user_id: string }) => r.user_id).filter(uid => !wanted.has(uid))

    if (wanted.size > 0) {
      const { error } = await admin
        .from('team_members')
        .upsert([...wanted].map(([user_id, role]) => ({ team_id: id, user_id, role })), { onConflict: 'team_id,user_id' })
      if (error) return dbError(error)
    }
    if (removed.length > 0) {
      const { error } = await admin.from('team_members').delete().eq('team_id', id).in('user_id', removed)
      if (error) return dbError(error)
    }

    const { data: members, error } = await admin.from('team_members').select('team_id, user_id, role').eq('team_id', id)
    if (error) return dbError(error)
    return NextResponse.json({ members })
  } catch (err) {
    console.error('[api/teams/[id]/members] PUT error:', err)
    return NextResponse.json({ error: 'メンバーの割り当てに失敗しました' }, { status: 500 })
  }
}
