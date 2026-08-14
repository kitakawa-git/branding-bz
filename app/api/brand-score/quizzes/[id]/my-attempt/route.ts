// ブランド理解度テスト 本人結果API（学習画面用）
// GET /api/brand-score/quizzes/[id]/my-attempt
// ============================================================
// セッションから本人(profile_id)を解決し、その本人の attempt のみ返す。
// クエリの profileId は受け取らない（送られても無視）。正解・解説を含むのは
// 「自分の結果」だけ。比較用の company_average_score は集計値（個人を出さない）。
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getMemberContext } from '@/lib/learning/auth'
import { meanScore, K_ANONYMITY_THRESHOLD } from '@/lib/brand-score/quiz-scoring'
import { guardCompanyFeature } from '@/lib/billing/guard'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: quizId } = await context.params

    // 本人特定（セッション → members）。クエリの profileId は一切使わない。
    const member = await getMemberContext()
    if (!member) {
      return NextResponse.json({ error: '権限がありません' }, { status: 401 })
    }
    const denied = await guardCompanyFeature(member.companyId, 'brandQuiz')
    if (denied) return denied
    const { profileId, companyId } = member

    const supabase = getSupabaseAdmin()

    // クイズ取得＋テナント境界
    const { data: quiz, error: quizError } = await supabase
      .from('brand_quizzes')
      .select('id, company_id, title, pass_threshold, status')
      .eq('id', quizId)
      .single()

    if (quizError) {
      console.error('[Quiz MyAttempt GET] クイズ取得エラー:', quizError.message)
      const status = quizError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json(
        { error: status === 404 ? 'テストが見つかりません' : quizError.message },
        { status }
      )
    }
    if (quiz.company_id !== companyId) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    // 本人の attempt（記名: profile_id で自分の行だけ）
    const { data: attempt, error: attemptError } = await supabase
      .from('brand_quiz_attempts')
      .select('*')
      .eq('quiz_id', quizId)
      .eq('profile_id', profileId)
      .maybeSingle()

    if (attemptError) {
      console.error('[Quiz MyAttempt GET] attempt取得エラー:', attemptError.message)
      return NextResponse.json({ error: attemptError.message }, { status: 500 })
    }
    if (!attempt) {
      return NextResponse.json({ error: '未受験です' }, { status: 404 })
    }

    // 設問別の振り返り（自分の回答 × 正解 × 解説）
    const { data: myAnswers, error: ansError } = await supabase
      .from('brand_quiz_answers')
      .select('question_id, selected_option_id, is_correct')
      .eq('attempt_id', attempt.id)

    if (ansError) {
      console.error('[Quiz MyAttempt GET] answers取得エラー:', ansError.message)
      return NextResponse.json({ error: ansError.message }, { status: 500 })
    }

    const questionIds = (myAnswers ?? []).map((a) => a.question_id)
    let answers: unknown[] = []
    if (questionIds.length > 0) {
      const { data: questions, error: qError } = await supabase
        .from('brand_quiz_questions')
        .select('id, category, question_text, options, correct_option_id, explanation, sort_order')
        .in('id', questionIds)

      if (qError) {
        console.error('[Quiz MyAttempt GET] questions取得エラー:', qError.message)
        return NextResponse.json({ error: qError.message }, { status: 500 })
      }

      const qById = new Map((questions ?? []).map((q) => [q.id, q]))
      answers = (myAnswers ?? [])
        .filter((a) => qById.has(a.question_id))
        .sort(
          (x, y) =>
            (qById.get(x.question_id)!.sort_order as number) -
            (qById.get(y.question_id)!.sort_order as number)
        )
        .map((a) => {
          const q = qById.get(a.question_id)!
          return {
            question_id: a.question_id,
            category: q.category,
            question_text: q.question_text,
            options: q.options,
            selected_option_id: a.selected_option_id,
            correct_option_id: q.correct_option_id,
            is_correct: a.is_correct,
            explanation: q.explanation,
          }
        })
    }

    // 比較用の全社平均（集計値。個人スコアは出さない）
    const { data: allAttempts, error: allError } = await supabase
      .from('brand_quiz_attempts')
      .select('score')
      .eq('quiz_id', quizId)

    if (allError) {
      console.error('[Quiz MyAttempt GET] 全社平均取得エラー:', allError.message)
      return NextResponse.json({ error: allError.message }, { status: 500 })
    }
    // 小N漏洩対策: 全社 attempt_count < K のときは全社平均を出さない（集計中扱い）
    const totalAttempts = (allAttempts ?? []).length
    const insufficient = totalAttempts < K_ANONYMITY_THRESHOLD
    const company_average_score = insufficient
      ? null
      : meanScore((allAttempts ?? []).map((a) => a.score))

    return NextResponse.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        pass_threshold: quiz.pass_threshold,
        status: quiz.status,
      },
      attempt,
      answers,
      company_average_score,
      insufficient,
    })
  } catch (err) {
    console.error('[Quiz MyAttempt GET] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
