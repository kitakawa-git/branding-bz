// オントロジー出力テストAPI（superadmin限定・読み取り専用・DB書込なし）
// POST /api/superadmin/output-test  body: { companyId, topic }
// 同じお題で「注入あり/なし」の2回生成を行い比較結果を返す（手動実行のみ・結果は永続化しない）。
// コスト: 1テスト＝Claude 2回呼び出し（注入データ皆無の会社は1回で A=B）。
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { runOutputTest } from '@/lib/brand/output-test'
import { OUTPUT_TEST_TOPICS, type OutputTestTopic } from '@/lib/brand/output-test-types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const companyId = body?.companyId as string | undefined
    const topic = body?.topic as OutputTestTopic | undefined
    if (!companyId) {
      return NextResponse.json({ error: 'companyId は必須です' }, { status: 400 })
    }
    if (!topic || !OUTPUT_TEST_TOPICS.some((t) => t.value === topic)) {
      return NextResponse.json({ error: 'topic が不正です' }, { status: 400 })
    }

    // superadmin 認証（relation-scan / map-review と同方針）
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

    const result = await runOutputTest(companyId, topic)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[output-test] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
