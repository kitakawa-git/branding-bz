// ブランドマップ AIレビューAPI（superadmin限定）
// POST /api/superadmin/map-review  body: { companyId, regenerate? }
// - 保存済みレビュー（brand_map_reviews）があればそれを返す（AI呼び出しなし・鮮度判定つき）
// - 無ければ生成して保存（初回の一度きり）。regenerate: true はボタン押下時のみ・上書き保存
// - 関係0件の会社は生成も保存もしない（案内 reason を返す）
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getOrGenerateMapReview } from '@/lib/brand/map-review'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const companyId = body?.companyId as string | undefined
    if (!companyId) {
      return NextResponse.json({ error: 'companyId は必須です' }, { status: 400 })
    }

    // superadmin 認証（relation-scan と同方針）
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

    const regenerate = body?.regenerate === true
    const result = await getOrGenerateMapReview(companyId, { regenerate })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[map-review] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
