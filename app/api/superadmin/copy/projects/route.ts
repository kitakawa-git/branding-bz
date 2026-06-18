// コピーAI プロジェクト作成API（superadmin限定・書込）
// POST /api/superadmin/copy/projects  { companyId, name, personaId?, brief? } → copy_projects に INSERT し row を返す
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// superadmin 認証（/api/superadmin/integrity と同型: Bearer → getUser → is_superadmin）
async function requireSuperadmin(request: NextRequest): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, res: NextResponse.json({ error: '認証が必要です。再ログインしてください。' }, { status: 401 }) }
  }
  const token = authHeader.replace('Bearer ', '')
  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
  if (authError || !user) {
    return { ok: false, res: NextResponse.json({ error: '認証エラー: セッションが無効です。' }, { status: 401 }) }
  }
  const supabaseAdmin = getSupabaseAdmin()
  const { data: adminUser } = await supabaseAdmin
    .from('admin_users')
    .select('is_superadmin')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!adminUser?.is_superadmin) {
    return { ok: false, res: NextResponse.json({ error: 'スーパー管理者権限が必要です。' }, { status: 403 }) }
  }
  return { ok: true }
}

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
