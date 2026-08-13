import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { fetchAllRows } from '@/lib/brand-score/fetch-all-rows'
import {
  resolveStage,
  calcGroupFunnels,
  PASS_THRESHOLD,
  type FunnelStage,
  type RespondentAnswer,
} from '@/lib/brand-score/funnel-stages'
import { calcBreakdown, type LensAnswer, type LensQuestion } from '@/lib/brand-score/question-lens'

// インナースコア算出API
// GET /api/brand-score/inner-score?company_id=xxx&survey_id=yyy

// ランク判定
function getRank(score: number | null): string {
  if (score === null) return '-'
  if (score >= 90) return 'S'
  if (score >= 80) return 'A+'
  if (score >= 70) return 'A'
  if (score >= 60) return 'B+'
  if (score >= 50) return 'B'
  if (score >= 40) return 'C'
  return 'D'
}

// カテゴリ別スコア算出（0-100正規化）
function calcCategoryScore(
  responses: { question_id: string; score: number }[],
  questionIds: string[],
): number | null {
  const filtered = responses.filter(r => questionIds.includes(r.question_id))
  if (filtered.length === 0) return null
  const avg = filtered.reduce((sum, r) => sum + r.score, 0) / filtered.length
  return ((avg - 1) / 4) * 100
}

// 総合スコア算出（加重平均）
function calcTotalScore(
  whyScore: number | null,
  howScore: number | null,
  whatScore: number | null,
): number | null {
  const parts: { score: number; weight: number }[] = []
  if (whyScore !== null) parts.push({ score: whyScore, weight: 0.35 })
  if (howScore !== null) parts.push({ score: howScore, weight: 0.30 })
  if (whatScore !== null) parts.push({ score: whatScore, weight: 0.35 })
  if (parts.length === 0) return null
  // 有効なカテゴリだけで加重平均（ウェイトを再正規化）
  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0)
  return parts.reduce((sum, p) => sum + p.score * (p.weight / totalWeight), 0)
}

type CategoryType = 'why' | 'how' | 'what'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    const surveyIdParam = searchParams.get('survey_id')

    if (!companyId) {
      return NextResponse.json({ error: 'company_id は必須です' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // 1. 対象サーベイを特定
    let survey: { id: string; title: string; status: string; total_members: number; respondent_count: number | null } | null = null

    if (surveyIdParam) {
      const { data, error } = await supabase
        .from('brand_surveys')
        .select('id, title, status, total_members, respondent_count')
        .eq('id', surveyIdParam)
        .eq('company_id', companyId)
        .single()
      if (error || !data) {
        return NextResponse.json({ score: null, message: 'サーベイデータがありません' })
      }
      survey = data
    } else {
      // クローズ済みサーベイを優先（回答データがある可能性が高い）
      // クローズ済みがなければアクティブを返す。
      // Supabase は1往復ぶんの遅延がそのまま画面の待ち時間になるので、
      // 「closed が無ければ active」を直列で問い合わせず、同時に投げて選ぶ
      const [{ data: closedData }, { data: activeData }] = await Promise.all([
        supabase
          .from('brand_surveys')
          .select('id, title, status, total_members, respondent_count')
          .eq('company_id', companyId)
          .eq('status', 'closed')
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('brand_surveys')
          .select('id, title, status, total_members, respondent_count')
          .eq('company_id', companyId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1),
      ])

      if (closedData && closedData.length > 0) {
        survey = closedData[0]
      } else if (activeData && activeData.length > 0) {
        survey = activeData[0]
      } else {
        return NextResponse.json({ score: null, message: 'サーベイデータがありません' })
      }
    }

    // 2〜4. 回答・設問・参加者は互いに独立しているので同時に取る。
    // 直列にすると Supabase への往復ぶんだけ画面の待ち時間が伸びる
    const [
      { data: responses, error: rErr },
      { data: questions, error: qErr },
      { data: participants, error: pErr },
    ] = await Promise.all([
      // 回答は1000行上限があるためページングして全件取る
      fetchAllRows<{
        question_id: string; score: number; department: string | null
        role_category: string | null; submitted_at: string; respondent_id: string | null
      }>(() => supabase
        .from('brand_survey_responses')
        .select('question_id, score, department, role_category, submitted_at, respondent_id')
        .eq('survey_id', survey!.id)
        .order('id')
      ),
      supabase
        .from('brand_survey_questions')
        .select('id, question_text, category, sort_order, reference_data')
        .eq('survey_id', survey.id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('survey_participants')
        .select('id, responded_at')
        .eq('survey_id', survey.id),
    ])

    if (rErr) {
      return NextResponse.json({ error: '回答データの取得に失敗しました' }, { status: 500 })
    }
    if (qErr) {
      return NextResponse.json({ error: '設問データの取得に失敗しました' }, { status: 500 })
    }
    if (pErr) {
      return NextResponse.json({ error: '参加者データの取得に失敗しました' }, { status: 500 })
    }

    // 外部調査の取り込み（source='imported'）は survey_participants を持たないため、
    // 取り込み時に記録した respondent_count を分子として使う。
    const respondedCount = survey.respondent_count ?? (participants || []).filter(p => p.responded_at !== null).length
    const totalMembers = survey.total_members || (participants || []).length
    const responseRate = totalMembers > 0
      ? Math.round((respondedCount / totalMembers) * 1000) / 10
      : 0

    // 回答0件の場合
    if (!responses || responses.length === 0) {
      return NextResponse.json({
        survey: {
          id: survey.id,
          title: survey.title,
          status: survey.status,
          total_members: totalMembers,
        },
        response_rate: responseRate,
        response_count: 0,
        scores: { total: null, why: null, how: null, what: null },
        rank: '-',
        by_department: [],
        by_role: [],
        by_question: (questions || []).map(q => ({
          question_id: q.id,
          question_text: q.question_text,
          category: q.category,
          avg_score: null,
          count: 0,
        })),
      })
    }

    // 5. カテゴリ別設問IDマップ
    const categoryQuestionIds: Record<CategoryType, string[]> = { why: [], how: [], what: [] }
    for (const q of questions || []) {
      const cat = q.category as CategoryType
      if (categoryQuestionIds[cat]) {
        categoryQuestionIds[cat].push(q.id)
      }
    }

    // 6. 全体のカテゴリ別スコア
    const whyScore = calcCategoryScore(responses, categoryQuestionIds.why)
    const howScore = calcCategoryScore(responses, categoryQuestionIds.how)
    const whatScore = calcCategoryScore(responses, categoryQuestionIds.what)
    const totalScore = calcTotalScore(whyScore, howScore, whatScore)

    // 7. 部署別スコア
    const deptMap = new Map<string, { question_id: string; score: number }[]>()
    for (const r of responses) {
      const dept = r.department || '未設定'
      if (!deptMap.has(dept)) deptMap.set(dept, [])
      deptMap.get(dept)!.push(r)
    }

    // 群ごとの回答者数を推定する。
    // サーベイ全体の設問数で割ると、職種別にフォームを分けた取り込み（例: BO版30問 /
    // SP版30問 → マージ後32問）で実数より少なく出る。その群が実際に回答した
    // 設問の種類数で割ること。
    const estimateRespondents = (rows: { question_id: string }[]): number => {
      const answeredQuestions = new Set(rows.map((r) => r.question_id)).size
      return answeredQuestions > 0 ? Math.round(rows.length / answeredQuestions) : 0
    }

    const byDepartment: {
      department: string; count: number
      why: number | null; how: number | null; what: number | null; total: number | null
    }[] = []

    for (const [dept, deptResponses] of deptMap.entries()) {
      const respondentCount = estimateRespondents(deptResponses)
      // k-匿名性: 回答者3人未満はスキップ
      if (respondentCount < 3) continue
      const dWhy = calcCategoryScore(deptResponses, categoryQuestionIds.why)
      const dHow = calcCategoryScore(deptResponses, categoryQuestionIds.how)
      const dWhat = calcCategoryScore(deptResponses, categoryQuestionIds.what)
      const dTotal = calcTotalScore(dWhy, dHow, dWhat)
      byDepartment.push({
        department: dept,
        count: respondentCount,
        why: dWhy !== null ? Math.round(dWhy * 10) / 10 : null,
        how: dHow !== null ? Math.round(dHow * 10) / 10 : null,
        what: dWhat !== null ? Math.round(dWhat * 10) / 10 : null,
        total: dTotal !== null ? Math.round(dTotal * 10) / 10 : null,
      })
    }

    // 8. 役職別スコア
    const roleMap = new Map<string, { question_id: string; score: number }[]>()
    for (const r of responses) {
      const role = r.role_category || '未設定'
      if (!roleMap.has(role)) roleMap.set(role, [])
      roleMap.get(role)!.push(r)
    }

    const byRole: {
      role_category: string; count: number
      why: number | null; how: number | null; what: number | null; total: number | null
    }[] = []

    for (const [role, roleResponses] of roleMap.entries()) {
      const respondentCount = estimateRespondents(roleResponses)
      const rWhy = calcCategoryScore(roleResponses, categoryQuestionIds.why)
      const rHow = calcCategoryScore(roleResponses, categoryQuestionIds.how)
      const rWhat = calcCategoryScore(roleResponses, categoryQuestionIds.what)
      const rTotal = calcTotalScore(rWhy, rHow, rWhat)
      byRole.push({
        role_category: role,
        count: respondentCount,
        why: rWhy !== null ? Math.round(rWhy * 10) / 10 : null,
        how: rHow !== null ? Math.round(rHow * 10) / 10 : null,
        what: rWhat !== null ? Math.round(rWhat * 10) / 10 : null,
        total: rTotal !== null ? Math.round(rTotal * 10) / 10 : null,
      })
    }

    // 9. 設問別スコア
    const questionScoreMap = new Map<string, { sum: number; count: number }>()
    for (const r of responses) {
      if (!questionScoreMap.has(r.question_id)) {
        questionScoreMap.set(r.question_id, { sum: 0, count: 0 })
      }
      const entry = questionScoreMap.get(r.question_id)!
      entry.sum += r.score
      entry.count += 1
    }

    const byQuestion = (questions || []).map(q => {
      const entry = questionScoreMap.get(q.id)
      return {
        question_id: q.id,
        question_text: q.question_text,
        category: q.category,
        // 小数4桁で返す。表示は toFixed で丸めるが、この値を再集計する側
        // （浸透ジャーニーのマトリクス）が2桁だと誤差で 0.1 ずれるため。
        avg_score: entry ? Math.round((entry.sum / entry.count) * 10000) / 10000 : null,
        count: entry ? entry.count : 0,
      }
    })

    // 10. 浸透段階の集計（段階スコア・段階×部門・個人単位の累積通過率）
    // 段階が解決できない設問構成のサーベイでは null を返し、画面側で非表示にする。
    const totalQuestionCount = (questions || []).length
    const stageByQuestionId = new Map<string, FunnelStage>()
    for (const q of questions || []) {
      const stage = resolveStage(
        q.sort_order as number,
        totalQuestionCount,
        q.reference_data as Record<string, unknown> | null
      )
      if (stage) stageByQuestionId.set(q.id as string, stage)
    }

    let funnel: ReturnType<typeof calcGroupFunnels> | null = null
    if (stageByQuestionId.size > 0) {
      // 回答者の識別キー。respondent_id を正とし、未採番の行だけ submitted_at に退避する。
      // ※ 一部の既存サーベイは全回答行の submitted_at が同一で、回答者を区別する
      //    情報がそもそも存在しない。その場合は人数が1人に潰れる（元データの制約）。
      const answers: RespondentAnswer[] = responses.map((r) => ({
        respondentKey: r.respondent_id ?? r.submitted_at,
        questionId: r.question_id,
        score: r.score,
        department: r.department,
      }))
      funnel = calcGroupFunnels(answers, stageByQuestionId)
    }

    // 11. 設問タイプ・4領域・回答分布の集計
    // 平均値だけでは「中立が多いのか、賛否が割れているのか」が見えない。
    // 施策の性質（説得か情報供給か）が変わるため内訳を出す。
    const lensQuestions: LensQuestion[] = (questions || []).map((q) => ({
      questionId: q.id as string,
      sortOrder: q.sort_order as number,
      questionText: q.question_text as string,
      referenceData: q.reference_data as Record<string, unknown> | null,
    }))
    const lensAnswers: LensAnswer[] = responses.map((r) => ({
      questionId: r.question_id,
      score: r.score,
      department: r.department,
    }))
    const breakdown = calcBreakdown(lensAnswers, lensQuestions)

    return NextResponse.json({
      breakdown,
      funnel: funnel
        ? {
            pass_threshold: PASS_THRESHOLD,
            overall: funnel.overall,
            by_department: funnel.byDepartment,
          }
        : null,
      survey: {
        id: survey.id,
        title: survey.title,
        status: survey.status,
        total_members: totalMembers,
      },
      response_rate: responseRate,
      response_count: respondedCount,
      scores: {
        total: totalScore !== null ? Math.round(totalScore * 10) / 10 : null,
        why: whyScore !== null ? Math.round(whyScore * 10) / 10 : null,
        how: howScore !== null ? Math.round(howScore * 10) / 10 : null,
        what: whatScore !== null ? Math.round(whatScore * 10) / 10 : null,
      },
      rank: getRank(totalScore !== null ? Math.round(totalScore * 10) / 10 : null),
      by_department: byDepartment,
      by_role: byRole,
      by_question: byQuestion,
    })
  } catch (err) {
    console.error('Inner score API error:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
