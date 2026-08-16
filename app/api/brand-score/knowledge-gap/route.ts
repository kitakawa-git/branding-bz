// 共感（サーベイ）×知識（理解度テスト）のギャップ分析API（管理者向け）
// GET /api/brand-score/knowledge-gap
// ============================================================
// 3計測器のうち「共感（サーベイ WHY/HOW）」と「知識（テスト WHY/HOW）」を
// 同一 0-100 スケールで対比し、WHY/HOW ごとにギャップと打ち手を返す。
// - 知識: brand_quiz_attempts のカテゴリ正答率を平均（quiz-scoring 再利用）。
//   全社 attempt_count < K は insufficient（小N漏洩対策。Batch 4/5 と整合）。
// - 共感: 既存 inner-score と同じ算出（リッカート avg を (avg-1)/4*100 で正規化）。
// - WHAT はテスト側に無いのでギャップ対象外（サーベイのみ既存ダッシュボードで担保）。
// ============================================================
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { fetchAllRows } from '@/lib/brand-score/fetch-all-rows'
import { getAdminContext } from '@/lib/learning/auth'
import { meanScore, K_ANONYMITY_THRESHOLD } from '@/lib/brand-score/quiz-scoring'
import { guardCompanyFeature } from '@/lib/billing/guard'

// ギャップ判定のしきい値（定数化）
const GAP_THRESHOLD = 15 // 共感と知識の差がこれ以上で「先行」と判定
const HIGH = 70 // 拮抗時に「浸透/未浸透」を分ける高低ライン

type GapDirection =
  | 'empathy_leads'
  | 'knowledge_leads'
  | 'balanced_high'
  | 'balanced_low'
  | 'balanced'

interface GapItem {
  empathy: number
  knowledge: number
  gap: number // 共感 − 知識
  direction: GapDirection
  interpretation: string
  action: string
}

// 共感(0-100) と 知識(0-100) からギャップ1件を判定
function analyzeGap(empathy: number, knowledge: number): GapItem {
  const gap = Math.round((empathy - knowledge) * 10) / 10
  if (empathy - knowledge >= GAP_THRESHOLD) {
    return {
      empathy,
      knowledge,
      gap,
      direction: 'empathy_leads',
      interpretation: '共感先行（好きだが中身は曖昧）',
      action: '周知・教育で「中身」を伝える',
    }
  }
  if (knowledge - empathy >= GAP_THRESHOLD) {
    return {
      empathy,
      knowledge,
      gap,
      direction: 'knowledge_leads',
      interpretation: '知識先行（知っているが腹落ちが弱い）',
      action: '共感醸成で「なぜ」を伝える',
    }
  }
  // 拮抗
  if (empathy >= HIGH && knowledge >= HIGH) {
    return {
      empathy,
      knowledge,
      gap,
      direction: 'balanced_high',
      interpretation: '浸透している（共感・知識ともに高い）',
      action: '現状維持・好事例の横展開',
    }
  }
  if (empathy < HIGH && knowledge < HIGH) {
    return {
      empathy,
      knowledge,
      gap,
      direction: 'balanced_low',
      interpretation: '未浸透（両面に着手）',
      action: '共感と知識の両輪で底上げ',
    }
  }
  return {
    empathy,
    knowledge,
    gap,
    direction: 'balanced',
    interpretation: '拮抗（差は小さい）',
    action: '高い方を維持しつつ低い方を補強',
  }
}

// リッカート avg(1-5) を 0-100 に正規化（inner-score と同一）
function empathyCategoryScore(
  responses: { question_id: string; score: number }[],
  questionIds: Set<string>
): number | null {
  const filtered = responses.filter((r) => questionIds.has(r.question_id))
  if (filtered.length === 0) return null
  const avg = filtered.reduce((s, r) => s + r.score, 0) / filtered.length
  return Math.round(((avg - 1) / 4) * 100 * 10) / 10
}

export async function GET() {
  try {
    const admin = await getAdminContext()
    if (!admin) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }
    const companyId = admin.companyId

    const denied = await guardCompanyFeature(companyId, 'brandScoreInner')
    if (denied) return denied

    const supabase = getSupabaseAdmin()

    // ── 1. 最新クイズ（active/closed の最新）→ 知識スコア ──
    let quizBlock: {
      id: string
      title: string
      status: string
      overall: number | null
      why: number | null
      how: number | null
      attempt_count: number
      total_members: number
      response_rate: number
      insufficient: boolean
    } | null = null

    const { data: quizzes } = await supabase
      .from('brand_quizzes')
      .select('id, title, status, total_members, created_at')
      .eq('company_id', companyId)
      .in('status', ['active', 'closed'])
      .order('created_at', { ascending: false })
      .limit(1)

    const latestQuiz = quizzes && quizzes.length > 0 ? quizzes[0] : null
    if (latestQuiz) {
      const { data: attempts } = await supabase
        .from('brand_quiz_attempts')
        .select('score, why_score, how_score')
        .eq('quiz_id', latestQuiz.id)
      const list = attempts ?? []
      const attemptCount = list.length
      const insufficient = attemptCount < K_ANONYMITY_THRESHOLD
      const totalMembers = (latestQuiz.total_members as number | null) ?? 0
      quizBlock = {
        id: latestQuiz.id,
        title: latestQuiz.title,
        status: latestQuiz.status,
        overall: insufficient ? null : meanScore(list.map((a) => a.score)),
        why: insufficient ? null : meanScore(list.map((a) => a.why_score)),
        how: insufficient ? null : meanScore(list.map((a) => a.how_score)),
        attempt_count: attemptCount,
        total_members: totalMembers,
        response_rate: totalMembers > 0 ? Math.round((attemptCount / totalMembers) * 100) : 0,
        insufficient,
      }
    }

    // ── 2. 最新サーベイ（closed優先・なければactive）→ 共感スコア ──
    let surveyBlock: {
      id: string
      title: string
      status: string
      why: number | null
      how: number | null
    } | null = null

    let survey: { id: string; title: string; status: string } | null = null
    const { data: closedSurveys } = await supabase
      .from('brand_surveys')
      .select('id, title, status, created_at')
      .eq('company_id', companyId)
      .eq('status', 'closed')
      .order('created_at', { ascending: false })
      .limit(1)
    if (closedSurveys && closedSurveys.length > 0) {
      survey = closedSurveys[0]
    } else {
      const { data: activeSurveys } = await supabase
        .from('brand_surveys')
        .select('id, title, status, created_at')
        .eq('company_id', companyId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
      if (activeSurveys && activeSurveys.length > 0) survey = activeSurveys[0]
    }

    if (survey) {
      const [{ data: responses }, { data: sQuestions }] = await Promise.all([
        // 1000行上限があるためページングして全件取る
        fetchAllRows<{ question_id: string; score: number }>(() =>
          supabase.from('brand_survey_responses').select('question_id, score').eq('survey_id', survey.id).order('id')
        ),
        supabase.from('brand_survey_questions').select('id, category').eq('survey_id', survey.id),
      ])
      const whyIds = new Set<string>()
      const howIds = new Set<string>()
      for (const q of sQuestions ?? []) {
        if (q.category === 'why') whyIds.add(q.id)
        else if (q.category === 'how') howIds.add(q.id)
      }
      const resp = (responses ?? []) as { question_id: string; score: number }[]
      surveyBlock = {
        id: survey.id,
        title: survey.title,
        status: survey.status,
        why: empathyCategoryScore(resp, whyIds),
        how: empathyCategoryScore(resp, howIds),
      }
    }

    // ── 3. ギャップ分析（双方データあり かつ クイズが小Nでない時のみ）──
    let gap: { why: GapItem | null; how: GapItem | null } | null = null
    let reason: 'no_quiz' | 'no_survey' | 'insufficient' | null = null

    if (!quizBlock) {
      reason = 'no_quiz'
    } else if (quizBlock.insufficient) {
      reason = 'insufficient'
    } else if (!surveyBlock) {
      reason = 'no_survey'
    } else {
      const whyGap =
        surveyBlock.why !== null && quizBlock.why !== null
          ? analyzeGap(surveyBlock.why, quizBlock.why)
          : null
      const howGap =
        surveyBlock.how !== null && quizBlock.how !== null
          ? analyzeGap(surveyBlock.how, quizBlock.how)
          : null
      gap = { why: whyGap, how: howGap }
    }

    return NextResponse.json({ quiz: quizBlock, survey: surveyBlock, gap, reason })
  } catch (err) {
    console.error('[KnowledgeGap GET] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
