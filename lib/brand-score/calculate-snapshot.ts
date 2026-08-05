// ブランドスコア スナップショット集計ロジック
// inner-score API / outer-score API のロジックを抽出・統合
// Cron Job / 手動API の両方から呼ばれる
import { SupabaseClient } from '@supabase/supabase-js'
import { fetchAllRows } from './fetch-all-rows'
import { resolveStage, ALL_STAGES, type FunnelStage } from './funnel-stages'
import { computeDigitalMetrics } from './outer-metrics'

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
  /** 浸透段階ごとのスコア（jsonb 列に保存）。段階未設定のサーベイでは null */
  inner_stages: Record<string, number> | null
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

// clamp / linearScore は lib/brand-score/outer-metrics.ts へ移設した
// （outer-score API と式が重複していたため）

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
  /** 浸透段階ごとのスコア。段階が解決できない構成では null */
  stages: Record<string, number> | null
  survey_id: string | null
  response_rate: number | null
}

async function calculateInnerScore(
  supabase: SupabaseClient,
  companyId: string,
): Promise<InnerResult> {
  const empty: InnerResult = {
    score: null, why: null, how: null, what: null, stages: null,
    survey_id: null, response_rate: null,
  }

  // 1. 対象サーベイを特定（closed優先 → active）
  const { data: closedData } = await supabase
    .from('brand_surveys')
    .select('id, title, status, total_members, respondent_count')
    .eq('company_id', companyId)
    .eq('status', 'closed')
    .order('created_at', { ascending: false })
    .limit(1)

  let survey = closedData?.[0] ?? null

  if (!survey) {
    const { data: activeData } = await supabase
      .from('brand_surveys')
      .select('id, title, status, total_members, respondent_count')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)

    survey = activeData?.[0] ?? null
  }

  if (!survey) return empty

  // 2. 全回答を取得（1000行上限があるためページングして全件取る）
  const { data: responses, error: rErr } = await fetchAllRows<{ question_id: string; score: number }>(
    () => supabase
      .from('brand_survey_responses')
      .select('question_id, score')
      .eq('survey_id', survey.id)
      .order('id')
  )

  if (rErr || !responses || responses.length === 0) return { ...empty, survey_id: survey.id }

  // 3. 全設問を取得（is_active = true）
  const { data: questions } = await supabase
    .from('brand_survey_questions')
    .select('id, category, sort_order, reference_data')
    .eq('survey_id', survey.id)
    .eq('is_active', true)

  if (!questions || questions.length === 0) return { ...empty, survey_id: survey.id }

  // 4. 回答率算出
  // 外部調査の取り込み（source='imported'）は survey_participants を持たないため、
  // 取り込み時に記録した respondent_count を分子として使う。
  const { data: participants } = await supabase
    .from('survey_participants')
    .select('id, responded_at')
    .eq('survey_id', survey.id)

  const respondedCount = survey.respondent_count ?? (participants || []).filter(p => p.responded_at !== null).length
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
  // WHY/HOW/WHAT は内訳として残すが、総合は全設問の単純平均に統一した
  // （評価軸を5段階へ移行したため、特定カテゴリに重みを置く根拠が無くなった）。
  // ⚠ 過去のスナップショットは旧式（WHY35%/HOW30%/WHAT35%）で記録されている。
  //   移行時点では両者が一致していたが、推移グラフは基準が混在する点に注意。
  const whyScore = calcCategoryScore(responses, categoryQuestionIds.why)
  const howScore = calcCategoryScore(responses, categoryQuestionIds.how)
  const whatScore = calcCategoryScore(responses, categoryQuestionIds.what)
  const totalScore = calcCategoryScore(responses, questions.map(q => q.id as string))

  // 7. 浸透段階ごとのスコア（段階が解決できない構成では null）
  const stageByQuestionId = new Map<string, FunnelStage>()
  for (const q of questions) {
    const stage = resolveStage(
      q.sort_order as number,
      questions.length,
      q.reference_data as Record<string, unknown> | null
    )
    if (stage) stageByQuestionId.set(q.id as string, stage)
  }

  let stages: Record<string, number> | null = null
  if (stageByQuestionId.size > 0) {
    stages = {}
    for (const stage of ALL_STAGES) {
      const ids = [...stageByQuestionId.entries()]
        .filter(([, st]) => st === stage)
        .map(([id]) => id)
      const v = calcCategoryScore(responses, ids)
      if (v !== null) stages[stage] = round1(v) as number
    }
    if (Object.keys(stages).length === 0) stages = null
  }

  return {
    score: round1(totalScore),
    why: round1(whyScore),
    how: round1(howScore),
    what: round1(whatScore),
    stages,
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

  // 6. スコア算出（式は outer-metrics.ts が持つ。outer-score API と共通）
  const { scores, digitalScore } = computeDigitalMetrics({
    members,
    uniqueVisitors,
    totalCardViews,
    vcardDownloads,
    brandPageClicks,
    avgDuration,
  })

  return {
    score: digitalScore ?? 0,
    reach: scores.reach,
    interest: scores.interest,
    transition: scores.transition,
    engagement: scores.engagement,
    // 印象一致度は未実装。weightedAverage が分母から外している
    impression: null,
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
    inner_stages: inner.stages,
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
