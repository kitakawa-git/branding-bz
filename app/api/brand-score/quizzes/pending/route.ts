// ポータルのバナー用: 本人が未受験の active 理解度テスト一覧
// GET /api/brand-score/quizzes/pending
// ============================================================
// サーベイバナー相当の導線。ただし sensitive な attempts テーブルを
// クライアントに直接読ませず、service_role の本エンドポイントで解決する
// （本人特定はセッション。返すのは id / title のみ）。
// ※ 静的セグメント 'pending' は [id] より優先されるためルート競合なし。
// ============================================================
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getMemberContext } from '@/lib/learning/auth'
import { guardCompanyFeature } from '@/lib/billing/guard'

export async function GET() {
  try {
    const member = await getMemberContext()
    if (!member) {
      return NextResponse.json({ error: '権限がありません' }, { status: 401 })
    }
    const denied = await guardCompanyFeature(member.companyId, 'brandQuiz')
    if (denied) return denied
    const { profileId, companyId } = member

    const supabase = getSupabaseAdmin()

    // 自社の active クイズ
    const { data: quizzes, error: quizzesError } = await supabase
      .from('brand_quizzes')
      .select('id, title, starts_at, ends_at')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (quizzesError) {
      console.error('[Quiz Pending GET] クイズ取得エラー:', quizzesError.message)
      return NextResponse.json({ error: quizzesError.message }, { status: 500 })
    }
    if (!quizzes || quizzes.length === 0) {
      return NextResponse.json({ quizzes: [] })
    }

    // 本人が受験済みのクイズID
    const { data: attempts, error: attemptsError } = await supabase
      .from('brand_quiz_attempts')
      .select('quiz_id')
      .eq('profile_id', profileId)
      .in('quiz_id', quizzes.map((q) => q.id))

    if (attemptsError) {
      console.error('[Quiz Pending GET] attempt取得エラー:', attemptsError.message)
      return NextResponse.json({ error: attemptsError.message }, { status: 500 })
    }
    const attempted = new Set((attempts ?? []).map((a) => a.quiz_id))

    // 未受験 かつ 期間内（null=無制限）
    const now = Date.now()
    const pending = quizzes
      .filter((q) => {
        if (attempted.has(q.id)) return false
        if (q.starts_at && new Date(q.starts_at).getTime() > now) return false
        if (q.ends_at && new Date(q.ends_at).getTime() < now) return false
        return true
      })
      .map((q) => ({ id: q.id, title: q.title }))

    return NextResponse.json({ quizzes: pending })
  } catch (err) {
    console.error('[Quiz Pending GET] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
