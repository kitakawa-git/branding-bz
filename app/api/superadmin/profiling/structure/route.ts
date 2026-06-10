// ブランドプロファイリング 回答構造化API（superadmin限定）
// POST /api/superadmin/profiling/structure  body: { question, answer }
// 自由記述回答を Claude で構造化草案に変換して返すだけ。DBへは書き込まない
// （登録はUIでの承認後、クライアント supabase INSERT。Claude を呼ぶため POST・明示実行のみ）。
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { structureAnswer, type ProfilingQuestion } from '@/lib/brand/profiling'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const question = body?.question as ProfilingQuestion | undefined
    const answer = body?.answer as string | undefined
    if (!question?.type || typeof answer !== 'string' || !answer.trim()) {
      return NextResponse.json({ error: 'question と answer は必須です' }, { status: 400 })
    }
    if (question.type !== 'unproven_promise' && question.type !== 'no_governance') {
      return NextResponse.json({ error: 'この質問種別は構造化の対象外です' }, { status: 400 })
    }

    // superadmin 認証（integrity-ai と同方針）
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

    const { draft, reason } = await structureAnswer(question, answer)
    return NextResponse.json({ draft, reason })
  } catch (err) {
    console.error('[profiling/structure] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
