// ブランドマップ AIレビューAPI（superadmin限定・読み取り専用）
// POST /api/superadmin/map-review  body: { companyId }
// グラフ事実は決定論計算し、Claude は講評を書くだけ（コスト発生のため POST・手動実行のみ）。
// DBへは一切書き込まない。レビューの永続化もしない（v1）。
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { generateMapReview } from '@/lib/brand/map-review'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const companyId = body?.companyId as string | undefined
    if (!companyId) {
      return NextResponse.json({ error: 'companyId は必須です' }, { status: 400 })
    }

    // superadmin 認証（relation-scan / integrity-ai と同方針）
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

    const { review, reason, droppedLines } = await generateMapReview(companyId)
    return NextResponse.json({ review, reason, droppedLines })
  } catch (err) {
    console.error('[map-review] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
