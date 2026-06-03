// ブランド理解度テスト 受験用設問取得API（★正解・解説を返さない）
// GET /api/brand-score/quizzes/[id]/take
// ============================================================
// 受験者のブラウザに correct_option_id / explanation を絶対に渡さない。
// SELECT の時点でこれらの列を取得しない（提出前に devtools で正解が見えない）。
// 本人特定はセッション（members）。受験ガード（active・期間内・未受験）も実施。
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getMemberContext } from '@/lib/learning/auth'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: quizId } = await context.params

    // 本人特定（セッション → members）
    const member = await getMemberContext()
    if (!member) {
      return NextResponse.json({ error: '権限がありません' }, { status: 401 })
    }
    const { profileId, companyId } = member

    const supabase = getSupabaseAdmin()

    // クイズ取得＋テナント境界
    const { data: quiz, error: quizError } = await supabase
      .from('brand_quizzes')
      .select('id, company_id, title, description, status, starts_at, ends_at, pass_threshold, randomize_questions')
      .eq('id', quizId)
      .single()

    if (quizError) {
      console.error('[Quiz Take GET] クイズ取得エラー:', quizError.message)
      const status = quizError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json(
        { error: status === 404 ? 'テストが見つかりません' : quizError.message },
        { status }
      )
    }
    if (quiz.company_id !== companyId) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const quizMeta = {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      status: quiz.status,
      pass_threshold: quiz.pass_threshold,
      randomize_questions: quiz.randomize_questions,
    }

    // 既に受験済みなら結果画面へ誘導
    const { data: existing, error: existingError } = await supabase
      .from('brand_quiz_attempts')
      .select('id')
      .eq('quiz_id', quizId)
      .eq('profile_id', profileId)
      .maybeSingle()

    if (existingError) {
      console.error('[Quiz Take GET] attempt確認エラー:', existingError.message)
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }
    if (existing) {
      return NextResponse.json({ quiz: quizMeta, already_submitted: true, takeable: false })
    }

    // 受験ガード: active かつ 期間内（null=無制限）
    const now = Date.now()
    let takeable = true
    let reason: string | null = null
    if (quiz.status !== 'active') {
      takeable = false
      reason =
        quiz.status === 'closed'
          ? 'このテストは終了しました'
          : 'このテストは現在受験を受け付けていません'
    } else if (quiz.starts_at && new Date(quiz.starts_at).getTime() > now) {
      takeable = false
      reason = 'このテストはまだ開始していません'
    } else if (quiz.ends_at && new Date(quiz.ends_at).getTime() < now) {
      takeable = false
      reason = 'このテストの受験期間を過ぎました'
    }

    if (!takeable) {
      return NextResponse.json({ quiz: quizMeta, already_submitted: false, takeable: false, reason })
    }

    // 有効設問を取得（★correct_option_id / explanation は SELECT しない）
    const { data: questions, error: qError } = await supabase
      .from('brand_quiz_questions')
      .select('id, category, question_type, question_text, options, sort_order')
      .eq('quiz_id', quizId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (qError) {
      console.error('[Quiz Take GET] 設問取得エラー:', qError.message)
      return NextResponse.json({ error: qError.message }, { status: 500 })
    }

    return NextResponse.json({
      quiz: quizMeta,
      already_submitted: false,
      takeable: true,
      reason: null,
      questions: questions ?? [],
    })
  } catch (err) {
    console.error('[Quiz Take GET] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
