// ブランド理解度テスト 管理者向け集計API（★k匿名の要）
// GET /api/brand-score/quizzes/[id]/results
// ============================================================
// 個人行は絶対に返さない。サーバ側で集計してから返す。
//  - 部署別 / 役職別は母数 n>=3 のグループのみ（n<3 は除外し suppressed に計上）
//  - 設問別正答率も n>=3 の設問のみ（受験者が極小のとき、participants と
//    突き合わせて個人の解答が割れるのを防ぐ＝クロス参照リーク対策）
//  - レスポンスに profile_id・個人単位スコアは一切含めない
// 全社平均(overall)は my-attempt が全社員に返す公開集計値と同じ扱いで常に返す。
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminContext } from '@/lib/learning/auth'
import { meanScore, K_ANONYMITY_THRESHOLD } from '@/lib/brand-score/quiz-scoring'

type RouteContext = { params: Promise<{ id: string }> }

// 集計用の attempt 行（profile_id は取得しない＝個人を持ち込まない）
interface AttemptAgg {
  score: number | null
  why_score: number | null
  how_score: number | null
  what_score: number | null
  department: string | null
  role_category: string | null
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: quizId } = await context.params

    // 管理者特定（セッション → admin_users）
    const admin = await getAdminContext()
    if (!admin) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const supabase = getSupabaseAdmin()

    // クイズ取得＋テナント境界
    const { data: quiz, error: quizError } = await supabase
      .from('brand_quizzes')
      .select('id, company_id, total_members')
      .eq('id', quizId)
      .single()

    if (quizError) {
      console.error('[Quiz Results GET] クイズ取得エラー:', quizError.message)
      const status = quizError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json(
        { error: status === 404 ? 'テストが見つかりません' : quizError.message },
        { status }
      )
    }
    if (quiz.company_id !== admin.companyId) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    // attempts を集計用に取得（★profile_id は select しない）
    const { data: attemptsRaw, error: attemptsError } = await supabase
      .from('brand_quiz_attempts')
      .select('score, why_score, how_score, what_score, department, role_category')
      .eq('quiz_id', quizId)

    if (attemptsError) {
      console.error('[Quiz Results GET] attempts取得エラー:', attemptsError.message)
      return NextResponse.json({ error: attemptsError.message }, { status: 500 })
    }
    const attempts = (attemptsRaw ?? []) as AttemptAgg[]
    const attemptCount = attempts.length

    // 全体平均（全社の集計値）。
    // 小N漏洩対策: attempt_count < K のときは overall を返さない（insufficient）。
    // response（回答率 X/Y）は件数でありスコア漏洩ではないので常に返す。
    const insufficient = attemptCount < K_ANONYMITY_THRESHOLD
    const overall = insufficient
      ? null
      : {
          score: meanScore(attempts.map((a) => a.score)),
          why_score: meanScore(attempts.map((a) => a.why_score)),
          how_score: meanScore(attempts.map((a) => a.how_score)),
          what_score: meanScore(attempts.map((a) => a.what_score)),
        }

    // 受験率
    const totalMembers = (quiz.total_members as number | null) ?? 0
    const response = {
      attempt_count: attemptCount,
      total_members: totalMembers,
      response_rate:
        totalMembers > 0 ? Math.round((attemptCount / totalMembers) * 100) : 0,
    }

    // 部署別（n>=3 のみ。n<3 は除外して suppressed に計上）
    const deptGroups = new Map<string, AttemptAgg[]>()
    for (const a of attempts) {
      const key = a.department ?? '__null__'
      const arr = deptGroups.get(key) ?? []
      arr.push(a)
      deptGroups.set(key, arr)
    }
    const by_department: {
      department: string | null
      n: number
      score: number | null
      why_score: number | null
      how_score: number | null
    }[] = []
    let suppressedDepartments = 0
    for (const [key, group] of deptGroups) {
      if (group.length < K_ANONYMITY_THRESHOLD) {
        suppressedDepartments++
        continue
      }
      by_department.push({
        department: key === '__null__' ? null : key,
        n: group.length,
        score: meanScore(group.map((a) => a.score)),
        why_score: meanScore(group.map((a) => a.why_score)),
        how_score: meanScore(group.map((a) => a.how_score)),
      })
    }

    // 役職別（n>=3 のみ）
    const roleGroups = new Map<string, AttemptAgg[]>()
    for (const a of attempts) {
      const key = a.role_category ?? '__null__'
      const arr = roleGroups.get(key) ?? []
      arr.push(a)
      roleGroups.set(key, arr)
    }
    const by_role: { role_category: string | null; n: number; score: number | null }[] = []
    for (const [key, group] of roleGroups) {
      if (group.length < K_ANONYMITY_THRESHOLD) continue
      by_role.push({
        role_category: key === '__null__' ? null : key,
        n: group.length,
        score: meanScore(group.map((a) => a.score)),
      })
    }

    // 設問別正答率（全社集計。n>=3 の設問のみ＝participants との突き合わせ防止）
    // このクイズの attempt_id を集めてから answers を引く（attempt.id は識別子ではない）。
    const perQuestion = new Map<string, { n: number; correct: number }>()
    const { data: attemptIdRows, error: attemptIdError } = await supabase
      .from('brand_quiz_attempts')
      .select('id')
      .eq('quiz_id', quizId)

    if (attemptIdError) {
      console.error('[Quiz Results GET] attempt id取得エラー:', attemptIdError.message)
      return NextResponse.json({ error: attemptIdError.message }, { status: 500 })
    }

    const attemptIds = (attemptIdRows ?? []).map((r) => r.id)
    if (attemptIds.length > 0) {
      const { data: answersRaw, error: answersError } = await supabase
        .from('brand_quiz_answers')
        .select('question_id, is_correct')
        .in('attempt_id', attemptIds)

      if (answersError) {
        console.error('[Quiz Results GET] answers取得エラー:', answersError.message)
        return NextResponse.json({ error: answersError.message }, { status: 500 })
      }

      for (const row of answersRaw ?? []) {
        const qid = row.question_id as string
        const agg = perQuestion.get(qid) ?? { n: 0, correct: 0 }
        agg.n++
        if (row.is_correct) agg.correct++
        perQuestion.set(qid, agg)
      }
    }

    // 設問メタ（category / question_text）を取得して結合
    const statQuestionIds = [...perQuestion.keys()]
    let question_stats: {
      question_id: string
      category: string
      question_text: string
      correct_rate: number
      n: number
    }[] = []
    if (statQuestionIds.length > 0) {
      const { data: qMeta, error: qMetaError } = await supabase
        .from('brand_quiz_questions')
        .select('id, category, question_text, sort_order')
        .in('id', statQuestionIds)

      if (qMetaError) {
        console.error('[Quiz Results GET] 設問メタ取得エラー:', qMetaError.message)
        return NextResponse.json({ error: qMetaError.message }, { status: 500 })
      }
      const metaById = new Map((qMeta ?? []).map((q) => [q.id, q]))
      question_stats = statQuestionIds
        // n>=3 かつメタが取れる設問のみ（個人の解答が割れるのを防ぐ）
        .filter((qid) => {
          const meta = metaById.get(qid)
          const agg = perQuestion.get(qid)!
          return !!meta && agg.n >= K_ANONYMITY_THRESHOLD
        })
        .sort(
          (a, b) =>
            (metaById.get(a)!.sort_order as number) -
            (metaById.get(b)!.sort_order as number)
        )
        .map((qid) => {
          const agg = perQuestion.get(qid)!
          const meta = metaById.get(qid)!
          return {
            question_id: qid,
            category: meta.category as string,
            question_text: meta.question_text as string,
            correct_rate: Math.round((agg.correct / agg.n) * 1000) / 10,
            n: agg.n,
          }
        })
    }

    const suppressedQuestionCount =
      statQuestionIds.length - question_stats.length

    return NextResponse.json({
      overall,
      insufficient,
      response,
      by_department,
      by_role,
      suppressed: {
        departments: suppressedDepartments,
        questions: suppressedQuestionCount,
        note: '3人未満のグループ・設問は匿名性確保のため非表示',
      },
      question_stats,
    })
  } catch (err) {
    console.error('[Quiz Results GET] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
