// ブランド理解度テスト 受験API（記名で採点・保存）
// POST /api/brand-score/quizzes/[id]/attempt
// ============================================================
// 本人特定はサーバ側セッション（@supabase/ssr の getUser → members）から行う。
// クライアントが送る profileId 等は本人確認の根拠に使わない（受け取らない）。
// 採点は単純正答率（lib/brand-score/quiz-scoring）。service_role で保存。
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getMemberContext } from '@/lib/learning/auth'
import { gradeAttempt, type ScoringQuestion, type SubmittedAnswer } from '@/lib/brand-score/quiz-scoring'
import type { RoleCategory } from '@/lib/types/brand-quiz'

type RouteContext = { params: Promise<{ id: string }> }

const VALID_ROLES: RoleCategory[] = ['executive', 'manager', 'staff']

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: quizId } = await context.params

    // 1. 本人特定（セッション → members）。未認証/非メンバーは弾く。
    //    profile_id・company_id はここでのみ確定し、クライアント値は信用しない。
    const member = await getMemberContext()
    if (!member) {
      return NextResponse.json({ error: '権限がありません' }, { status: 401 })
    }
    const { profileId, companyId } = member

    // 2. 入力（answers のみ。role_category は任意の自己申告。started_at は任意）
    const body = await request.json().catch(() => ({}))
    const answers = body?.answers

    if (!Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json({ error: 'answers array is required' }, { status: 400 })
    }
    const submitted: SubmittedAnswer[] = []
    for (const a of answers) {
      if (!a || typeof a !== 'object' || typeof a.question_id !== 'string') {
        return NextResponse.json(
          { error: 'each answer must have a question_id' },
          { status: 400 }
        )
      }
      submitted.push({
        question_id: a.question_id,
        selected_option_id:
          typeof a.selected_option_id === 'string' ? a.selected_option_id : null,
      })
    }

    // role_category（自己申告。サーベイと同じ取得方法＝クライアント申告）。任意。
    let roleCategory: RoleCategory | null = null
    if (body?.role_category !== undefined && body.role_category !== null) {
      if (!VALID_ROLES.includes(body.role_category)) {
        return NextResponse.json(
          { error: 'role_category must be executive, manager, or staff' },
          { status: 400 }
        )
      }
      roleCategory = body.role_category
    }

    const supabase = getSupabaseAdmin()

    // 3. クイズ取得＋受付ガード
    const { data: quiz, error: quizError } = await supabase
      .from('brand_quizzes')
      .select('id, company_id, status, starts_at, ends_at, pass_threshold')
      .eq('id', quizId)
      .single()

    if (quizError) {
      console.error('[Quiz Attempt POST] クイズ取得エラー:', quizError.message)
      const status = quizError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json(
        { error: status === 404 ? 'テストが見つかりません' : quizError.message },
        { status }
      )
    }

    // テナント境界: 自社のクイズ以外は受験不可
    if (quiz.company_id !== companyId) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    // status は active のみ
    if (quiz.status !== 'active') {
      return NextResponse.json(
        { error: 'このテストは現在受験を受け付けていません' },
        { status: 409 }
      )
    }

    // 期間ガード（null は無制限）
    const now = Date.now()
    if (quiz.starts_at && new Date(quiz.starts_at).getTime() > now) {
      return NextResponse.json(
        { error: 'このテストはまだ開始していません' },
        { status: 409 }
      )
    }
    if (quiz.ends_at && new Date(quiz.ends_at).getTime() < now) {
      return NextResponse.json(
        { error: 'このテストの受験期間を過ぎています' },
        { status: 409 }
      )
    }

    // 4. 既存 attempt チェック（1人1回。再受験はMVP対象外）
    const { data: existing, error: existingError } = await supabase
      .from('brand_quiz_attempts')
      .select('id')
      .eq('quiz_id', quizId)
      .eq('profile_id', profileId)
      .maybeSingle()

    if (existingError) {
      console.error('[Quiz Attempt POST] 既存attempt確認エラー:', existingError.message)
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }
    if (existing) {
      return NextResponse.json({ error: 'すでに受験済みです' }, { status: 409 })
    }

    // 5. 有効設問を取得し、回答の question_id がすべて有効設問か検証
    const { data: activeQuestions, error: qError } = await supabase
      .from('brand_quiz_questions')
      .select('id, category, correct_option_id')
      .eq('quiz_id', quizId)
      .eq('is_active', true)

    if (qError) {
      console.error('[Quiz Attempt POST] 設問取得エラー:', qError.message)
      return NextResponse.json({ error: qError.message }, { status: 500 })
    }
    if (!activeQuestions || activeQuestions.length === 0) {
      return NextResponse.json(
        { error: 'このテストには有効な設問がありません' },
        { status: 409 }
      )
    }

    const activeIds = new Set(activeQuestions.map((q) => q.id))
    const invalidIds = submitted
      .map((s) => s.question_id)
      .filter((qid) => !activeIds.has(qid))
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `無効な設問IDが含まれています: ${invalidIds.join(', ')}` },
        { status: 400 }
      )
    }

    // 6. department は profiles から取得（自己申告ではなく台帳の値）
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('department')
      .eq('id', profileId)
      .single()

    if (profileError) {
      console.error('[Quiz Attempt POST] profile取得エラー:', profileError.message)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // 7. 採点（クイズの有効設問を母数とする単純正答率）
    const score = gradeAttempt(activeQuestions as ScoringQuestion[], submitted)
    const passed = score.score >= quiz.pass_threshold

    const submittedAt = new Date().toISOString()
    const startedAt =
      typeof body?.started_at === 'string' ? body.started_at : submittedAt

    // 8. attempt を INSERT（記名: profile_id を持つ）
    const { data: attempt, error: attemptError } = await supabase
      .from('brand_quiz_attempts')
      .insert({
        quiz_id: quizId,
        profile_id: profileId,
        company_id: companyId,
        department: profile?.department ?? null,
        role_category: roleCategory,
        score: score.score,
        why_score: score.why_score,
        how_score: score.how_score,
        what_score: score.what_score,
        total_questions: score.total_questions,
        correct_count: score.correct_count,
        passed,
        started_at: startedAt,
        submitted_at: submittedAt,
      })
      .select('id')
      .single()

    if (attemptError) {
      // unique(quiz_id, profile_id) 競合（同時押下など）も二重受験として扱う
      if (attemptError.code === '23505') {
        return NextResponse.json({ error: 'すでに受験済みです' }, { status: 409 })
      }
      console.error('[Quiz Attempt POST] attempt INSERT エラー:', attemptError.message)
      return NextResponse.json({ error: attemptError.message }, { status: 500 })
    }

    // 9. 設問別回答を INSERT（弱点・解説表示用。有効設問ぶん全件）
    const answerRows = score.graded.map((g) => ({
      attempt_id: attempt.id,
      question_id: g.question_id,
      selected_option_id: g.selected_option_id,
      is_correct: g.is_correct,
    }))

    const { error: answersError } = await supabase
      .from('brand_quiz_answers')
      .insert(answerRows)

    if (answersError) {
      // 回答保存に失敗したら attempt を巻き戻し、孤立行を残さない（簡易ロールバック）
      await supabase.from('brand_quiz_attempts').delete().eq('id', attempt.id)
      console.error('[Quiz Attempt POST] answers INSERT エラー:', answersError.message)
      return NextResponse.json({ error: answersError.message }, { status: 500 })
    }

    // 10. この時点では正解・解説は返さない（本人結果は my-attempt で取得）
    return NextResponse.json(
      {
        attempt_id: attempt.id,
        score: score.score,
        correct_count: score.correct_count,
        total_questions: score.total_questions,
        passed,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('[Quiz Attempt POST] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
