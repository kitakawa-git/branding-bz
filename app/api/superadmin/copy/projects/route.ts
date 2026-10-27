// コピーAI プロジェクト作成API（superadmin限定・書込）
// POST /api/superadmin/copy/projects  { companyId, name, personaId?, brief? } → copy_projects に INSERT し row を返す
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireSuperadmin } from '@/lib/copy/api-auth'

export async function POST(request: NextRequest) {
  try {
    const guard = await requireSuperadmin(request)
    if (!guard.ok) return guard.res

    const body = await request.json().catch(() => ({}))
    const companyId = typeof body.companyId === 'string' ? body.companyId.trim() : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const personaId = typeof body.personaId === 'string' && body.personaId.trim() ? body.personaId.trim() : null
    const brief = typeof body.brief === 'string' && body.brief.trim() ? body.brief.trim() : null

    if (!companyId) return NextResponse.json({ error: 'companyId は必須です' }, { status: 400 })
    if (!name) return NextResponse.json({ error: 'name は必須です' }, { status: 400 })

    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('copy_projects')
      .insert({ company_id: companyId, name, persona_id: personaId, brief })
      .select('*')
      .single()
    if (error) {
      console.error('[copy/projects] INSERT エラー:', error)
      return NextResponse.json({ error: 'プロジェクトの作成に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ project: data })
  } catch (err) {
    console.error('[copy/projects] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
