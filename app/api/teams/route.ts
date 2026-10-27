// チームの作成（管理者のみ）
// POST /api/teams  { name }
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireCallerCompany, guardCompanyFeature } from '@/lib/billing/guard'
import { getGoalActor, forbidden, badRequest, dbError, cleanText } from '@/lib/goals/server'

export async function POST(request: NextRequest) {
  try {
    const scope = await requireCallerCompany()
    if (scope.error) return scope.error
    const { companyId, authId } = scope

    const denied = await guardCompanyFeature(companyId, 'kpi')
    if (denied) return denied

    const actor = await getGoalActor(companyId, authId)
    if (!actor.isAdmin) return forbidden('チームは管理者だけが作成できます')

    const body = await request.json().catch(() => null)
    const name = cleanText(body?.name, 100)
    if (!name) return badRequest('チーム名を入力してください')

    const { data, error } = await getSupabaseAdmin()
      .from('teams').insert({ company_id: companyId, name }).select('id, company_id, name, created_at').single()
    if (error) return dbError(error)

    return NextResponse.json({ team: data })
  } catch (err) {
    console.error('[api/teams] POST error:', err)
    return NextResponse.json({ error: 'チームの作成に失敗しました' }, { status: 500 })
  }
}
