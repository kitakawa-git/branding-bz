// AI草案生成API（superadmin限定・読み取り専用）
// POST /api/superadmin/draft-extraction  body: { companyId, kind: 'proof' | 'rule' }
// 登録済みデータから証拠・実績／表現ルールの草案を抽出して返すだけ。DBへは書き込まない
// （登録はUIでの承認後、クライアント supabase INSERT。Claude を呼ぶため POST・明示実行のみ）。
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { extractProofDrafts, extractRuleDrafts } from '@/lib/brand/draft-extraction'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const companyId = body?.companyId as string | undefined
    const kind = body?.kind as string | undefined
    if (!companyId) {
      return NextResponse.json({ error: 'companyId は必須です' }, { status: 400 })
    }
    if (kind !== 'proof' && kind !== 'rule') {
      return NextResponse.json({ error: "kind は 'proof' または 'rule' を指定してください" }, { status: 400 })
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

    const drafts = kind === 'proof' ? await extractProofDrafts(companyId) : await extractRuleDrafts(companyId)
    return NextResponse.json({ drafts })
  } catch (err) {
    console.error('[draft-extraction] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
