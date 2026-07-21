// AI関係スキャンAPI（superadmin限定・読み取り専用）
// POST /api/superadmin/relation-scan  body: { companyId }
// Claude を呼ぶ（コスト発生）ため GET でなく POST・明示実行のみ。
// 候補を返すだけでDBへは書き込まない。登録はUIでの承認後（クライアント supabase INSERT）。
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { scanRelationCandidates } from '@/lib/brand/relation-scan'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const companyId = body?.companyId as string | undefined
    if (!companyId) {
      return NextResponse.json({ error: 'companyId は必須です' }, { status: 400 })
    }

    // superadmin 認証（superadmin API 共通の方針）
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証が必要です。再ログインしてください。' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '')
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '認証エラー: セッションが無効です。' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: adminUser } = await supabaseAdmin
      .from('admin_users')
      .select('is_superadmin')
      .eq('auth_id', user.id)
      .maybeSingle()
    if (!adminUser?.is_superadmin) {
      return NextResponse.json({ error: 'スーパー管理者権限が必要です。' }, { status: 403 })
    }

    const candidates = await scanRelationCandidates(companyId)
    return NextResponse.json({ candidates })
  } catch (err) {
    console.error('[relation-scan] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
