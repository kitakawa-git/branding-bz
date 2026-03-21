// ブランドスコア スナップショット集計ロジック
// inner-score API / outer-score API のロジックを抽出・統合
// Cron Job / 手動API の両方から呼ばれる
import { SupabaseClient } from '@supabase/supabase-js'

// ────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────

export interface SnapshotResult {
  company_id: string
  snapshot_date: string
  period_days: number
  // インナー
  inner_score: number | null
  inner_why: number | null
  inner_how: number | null
  inner_what: number | null
  inner_survey_id: string | null
  inner_response_rate: number | null
  // アウター
  outer_score: number | null
  outer_reach: number | null
  outer_interest: number | null
  outer_transition: number | null
  outer_engagement: number | null
  outer_impression: number | null
  // 総合
  total_score: number | null
  rank: string
  metadata: Record<string, unknown>
}

type CategoryType = 'why' | 'how' | 'what'

// ────────────────────────────────────────────
// ヘルパー関数（inner-score / outer-score API から抽出）
// ────────────────────────────────────────────

/** ランク判定 */
export function getRank(score: number | null): string {
  if (score === null) return '-'
  if (score >= 90) return 'S'
  if (score >= 80) return 'A+'
  if (score >= 70) return 'A'
  if (score >= 60) return 'B+'
  if (score >= 50) return 'B'
  if (score >= 40) return 'C'
  return 'D'
}

/** 0-100にクランプ */
function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)))
}

/** 線形マッピング: 0→0, mid→50, max→100 */
function linearScore(value: number, midValue: number, maxValue: number): number {
  if (value <= 0) return 0
  if (value >= maxValue) return 100
  if (value <= midValue) {
    return (value / midValue) * 50
  }
  return 50 + ((value - midValue) / (maxValue - midValue)) * 50
}

/** カテゴリ別スコア算出（1-5スケールの平均を0-100に正規化） */
function calcCategoryScore(
  responses: { question_id: string; score: number }[],
  questionIds: string[],
): number | null {
  const filtered = responses.filter(r => questionIds.includes(r.question_id))
  if (filtered.length === 0) return null
  const avg = filtered.reduce((sum, r) => sum + r.score, 0) / filtered.length
  return ((avg - 1) / 4) * 100
}

/** インナー総合スコア算出（WHY:35%, HOW:30%, WHAT:35% の加重平均） */
function calcInnerTotal(
  whyScore: number | null,
  howScore: number | null,
  whatScore: number | null,
): number | null {
  const parts: { score: number; weight: number }[] = []
  if (whyScore !== null) parts.push({ score: whyScore, weight: 0.35 })
  if (howScore !== null) parts.push({ score: howScore, weight: 0.30 })
  if (whatScore !== null) parts.push({ score: whatScore, weight: 0.35 })
  if (parts.length === 0) return null
  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0)
  return parts.reduce((sum, p) => sum + p.score * (p.weight / totalWeight), 0)
}

/** 小数第1位に丸め */
function round1(v: number | null): number | null {
  if (v === null) return null
  return Math.round(v * 10) / 10
}

// ────────────────────────────────────────────
// インナースコア算出
// ────────────────────────────────────────────

interface InnerResult {
  score: number | null
  why: number | null
  how: number | null
  what: number | null
  survey_id: string | null
  response_rate: number | null
}

async function calculateInnerScore(
  supabase: SupabaseClient,
  companyId: string,
): Promise<InnerResult> {
  const empty: InnerResult = {
    score: null, why: null, how: null, what: null,
    survey_id: null, response_rate: null,
  }

  // 1. 対象サーベイを特定（closed優先 → active）
  const { data: closedData } = await supabase
    .from('brand_surveys')
    .select('id, title, status, total_members')
    .eq('company_id', companyId)
    .eq('status', 'closed')
    .order('created_at', { ascending: false })
    .limit(1)

  let survey = closedData?.[0] ?? null

  if (!survey) {
    const { data: activeData } = await supabase
      .from('brand_surveys')
      .select('id, title, status, total_members')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)

    survey = activeData?.[0] ?? null
  }

  if (!survey) return empty

  // 2. 全回答を取得
  const { data: responses, error: rErr } = await supabase
    .from('brand_survey_responses')
    .select('question_id, score')
    .eq('survey_id', survey.id)

  if (rErr || !responses || responses.length === 0) return { ...empty, survey_id: survey.id }

  // 3. 全設問を取得（is_active = true）
  const { data: questions } = await supabase
    .from('brand_survey_questions')
    .select('id, category')
    .eq('survey_id', survey.id)
    .eq('is_active', true)

  if (!questions || questions.length === 0) return { ...empty, survey_id: survey.id }

  // 4. 回答率算出
  const { data: participants } = await supabase
    .from('survey_participants')
    .select('id, responded_at')
    .eq('survey_id', survey.id)

  const respondedCount = (participants || []).filter(p => p.responded_at !== null).length
  const totalMembers = survey.total_members || (participants || []).length
  const responseRate = totalMembers > 0
    ? Math.round((respondedCount / totalMembers) * 1000) / 10
    : 0

  // 5. カテゴリ別設問IDマップ
  const categoryQuestionIds: Record<CategoryType, string[]> = { why: [], how: [], what: [] }
  for (const q of questions) {
    const cat = q.category as CategoryType
    if (categoryQuestionIds[cat]) {
      categoryQuestionIds[cat].push(q.id)
    }
  }

  // 6. スコア算出
  const whyScore = calcCategoryScore(responses, categoryQuestionIds.why)
  const howScore = calcCategoryScore(responses, categoryQuestionIds.how)
  const whatScore = calcCategoryScore(responses, categoryQuestionIds.what)
  const totalScore = calcInnerTotal(whyScore, howScore, whatScore)

  return {
    score: round1(totalScore),
    why: round1(whyScore),
    how: round1(howScore),
    what: round1(whatScore),
    survey_id: survey.id,
    response_rate: responseRate,
  }
}

// ────────────────────────────────────────────
// アウタースコア算出
// ────────────────────────────────────────────

interface OuterResult {
  score: number | null
  reach: number | null
  interest: number | null
  transition: number | null
  engagement: number | null
  impression: number | null
}

async function calculateOuterScore(
  supabase: SupabaseClient,
  companyId: string,
  periodDays: number,
): Promise<OuterResult> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - periodDays)
  const cutoffISO = cutoff.toISOString()

  // 1. 社員数
  const { count: memberCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)

  const members = memberCount ?? 0

  // 2. 社員のprofile_id一覧（card_viewsにcompany_idがないため）
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id')
    .eq('company_id', companyId)

  const profileIds = (profileRows ?? []).map(r => r.id as string)

  // 3. card_views: PV数 & UU数
  let totalCardViews = 0
  let uniqueVisitors = 0

  if (profileIds.length > 0) {
    const { data: viewRows } = await supabase
      .from('card_views')
      .select('ip_address')
      .in('profile_id', profileIds)
      .gte('viewed_at', cutoffISO)

    const rows = viewRows ?? []
    totalCardViews = rows.length
    const uniqueIps = new Set(rows.map(r => r.ip_address).filter(Boolean))
    uniqueVisitors = uniqueIps.size
  }

  // 4. card_events: vcard_download / brand_page_click 集計
  let vcardDownloads = 0
  let brandPageClicks = 0

  {
    const { data: eventRows } = await supabase
      .from('card_events')
      .select('event_type')
      .eq('company_id', companyId)
      .gte('created_at', cutoffISO)

    for (const row of eventRows ?? []) {
      if (row.event_type === 'vcard_download') vcardDownloads++
      if (row.event_type === 'brand_page_click') brandPageClicks++
    }
  }

  // 5. brand_page_views: 平均滞在時間
  let avgDuration = 0

  {
    const { data: bpvRows } = await supabase
      .from('brand_page_views')
      .select('duration_seconds')
      .eq('company_id', companyId)
      .gte('created_at', cutoffISO)

    const durations = (bpvRows ?? []).map(r => r.duration_seconds as number).filter(d => d > 0)
    if (durations.length > 0) {
      avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length
    }
  }

  // 6. スコア算出
  const weights = {
    reach: 0.20,
    interest: 0.20,
    transition: 0.25,
    engagement: 0.20,
    impression: 0.15,
  }

  // 到達力: UU数/社員数×10 → 0-100
  const reachScore = clamp(members > 0 ? (uniqueVisitors / members) * 10 : 0)

  // 関心度: vcard_download/PV×100 → linear(10, 20)
  const interestPct = totalCardViews > 0 ? (vcardDownloads / totalCardViews) * 100 : 0
  const interestScore = clamp(linearScore(interestPct, 10, 20))

  // ブランド遷移率: brand_page_click/PV×100 → linear(5, 15)
  const transitionPct = totalCardViews > 0 ? (brandPageClicks / totalCardViews) * 100 : 0
  const transitionScore = clamp(linearScore(transitionPct, 5, 15))

  // ブランド関与度: 平均滞在秒数 → linear(30, 90)
  const engagementScore = clamp(linearScore(avgDuration, 30, 90))

  // 印象一致度: Phase C 未実装 → null
  const impressionScore = null

  // 総合: 有効指標の加重平均（nullは按分）
  const activeWeight = weights.reach + weights.interest + weights.transition + weights.engagement
  const outerTotal = clamp(
    (reachScore * weights.reach +
      interestScore * weights.interest +
      transitionScore * weights.transition +
      engagementScore * weights.engagement) / activeWeight
  )

  return {
    score: outerTotal,
    reach: reachScore,
    interest: interestScore,
    transition: transitionScore,
    engagement: engagementScore,
    impression: impressionScore,
  }
}

// ────────────────────────────────────────────
// 総合スコア算出 + SnapshotResult 組み立て
// ────────────────────────────────────────────

/**
 * 指定企業のブランドスコアスナップショットを計算する
 * @param supabase Supabaseクライアント（service_role推奨）
 * @param companyId 企業ID
 * @param periodDays アウタースコアの集計期間（デフォルト30日）
 */
export async function calculateSnapshot(
  supabase: SupabaseClient,
  companyId: string,
  periodDays: number = 30,
): Promise<SnapshotResult> {
  const snapshotDate = new Date().toISOString().split('T')[0]

  // インナー・アウターを並列算出
  const [inner, outer] = await Promise.all([
    calculateInnerScore(supabase, companyId),
    calculateOuterScore(supabase, companyId, periodDays),
  ])

  // 総合スコア: inner(50%) + outer(50%)、片方nullなら100%按分
  let totalScore: number | null = null
  if (inner.score !== null && outer.score !== null) {
    totalScore = Math.round((inner.score * 0.5 + outer.score * 0.5) * 10) / 10
  } else if (inner.score !== null) {
    totalScore = inner.score
  } else if (outer.score !== null) {
    totalScore = outer.score
  }

  const rank = getRank(totalScore)

  return {
    company_id: companyId,
    snapshot_date: snapshotDate,
    period_days: periodDays,
    inner_score: inner.score,
    inner_why: inner.why,
    inner_how: inner.how,
    inner_what: inner.what,
    inner_survey_id: inner.survey_id,
    inner_response_rate: inner.response_rate,
    outer_score: outer.score,
    outer_reach: outer.reach,
    outer_interest: outer.interest,
    outer_transition: outer.transition,
    outer_engagement: outer.engagement,
    outer_impression: outer.impression,
    total_score: totalScore,
    rank,
    metadata: {
      calculated_at: new Date().toISOString(),
      period_days: periodDays,
    },
  }
}
