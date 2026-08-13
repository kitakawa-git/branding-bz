// アウタースコア算出API
// GET /api/analytics/outer-score?company_id=xxx&period=30
// 指定企業の外部ブランド浸透度スコアを算出して返す
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getRank, calculateMarketScore } from '@/lib/brand-score/calculate-snapshot'
import {
  OUTER_WEIGHTS,
  OUTER_TRACK_WEIGHTS,
  computeDigitalMetrics,
  weightedAverage,
} from '@/lib/brand-score/outer-metrics'
import { isFeatureEnabled } from '@/lib/constants/feature-toggles'

// スコアの算出式は lib/brand-score/outer-metrics.ts に集約している。
// 以前はこのファイルと calculate-snapshot.ts に同じ式が複製されており、
// 片方だけ直すと画面とスナップショットが食い違う状態だった。

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    // period=all は期間で絞らない（取り込み以来すべて）。
    // 年単位の定点観測では30日窓だとログが溜まらず「未計測」になりやすいため、
    // 年をまたぐ長さを選べるようにしてある
    const periodParam = searchParams.get('period')
    const isAllPeriod = periodParam === 'all'
    const period = isAllPeriod ? null : periodParam ? parseInt(periodParam, 10) : 30

    // バリデーション
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 })
    }
    if (period !== null && (isNaN(period) || period < 1 || period > 3650)) {
      return NextResponse.json(
        { error: 'period must be 1-3650 or "all"' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // 集計期間の起点。全期間なら十分に古い日付を置いて実質フィルタなしにする
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - (period ?? 36500))
    const cutoffISO = cutoff.toISOString()

    // --- 1. 互いに独立した問い合わせは同時に投げる ---
    // 直列にすると Supabase への往復回数がそのまま画面の待ち時間になる。
    // card_views だけは profile_id 一覧が要るので、この後の第2段で取る
    const [
      { data: company },
      { data: profileRows, count: memberCount, error: profileListError },
      { data: eventRows, error: eventsError },
      { data: bpvRows, error: bpvError },
      market,
    ] = await Promise.all([
      // スマート名刺がオフの会社は、名刺ページ自体が非公開なのでアクセスログが
      // 溜まらない。0件を低評価として扱わないよう、デジタル接点は最初から外す
      supabase.from('companies').select('card_enabled').eq('id', companyId).single(),
      // 社員数と profile_id 一覧は同じ条件なので1回で済ませる。
      // 1000行上限に当たっても count は正確に返るため人数は狂わない
      supabase.from('profiles').select('id', { count: 'exact' }).eq('company_id', companyId),
      supabase
        .from('card_events')
        .select('event_type')
        .eq('company_id', companyId)
        .gte('created_at', cutoffISO),
      supabase
        .from('brand_page_views')
        .select('duration_seconds')
        .eq('company_id', companyId)
        .gte('created_at', cutoffISO),
      // 市場浸透（外部調査）。取り込んだ調査が無ければ null になり、
      // アウタースコアは従来どおりデジタル接点だけで決まる
      calculateMarketScore(supabase, companyId),
    ])

    const cardEnabled = isFeatureEnabled(company, 'card_enabled')

    if (profileListError) {
      console.error('[OuterScore] profiles一覧エラー:', profileListError.message)
      return NextResponse.json({ error: profileListError.message }, { status: 500 })
    }
    if (eventsError) {
      console.error('[OuterScore] card_events クエリエラー:', eventsError.message)
      return NextResponse.json({ error: eventsError.message }, { status: 500 })
    }
    if (bpvError) {
      console.error('[OuterScore] brand_page_views クエリエラー:', bpvError.message)
      return NextResponse.json({ error: bpvError.message }, { status: 500 })
    }

    const members = memberCount ?? 0
    const profileIds = (profileRows ?? []).map(r => r.id as string)

    // --- 2. card_events: 各イベント集計 ---
    let vcardDownloads = 0
    let brandPageClicks = 0
    for (const row of eventRows ?? []) {
      if (row.event_type === 'vcard_download') vcardDownloads++
      if (row.event_type === 'brand_page_click') brandPageClicks++
    }

    // --- 3. brand_page_views: 平均滞在時間 ---
    let avgDuration = 0
    {
      const durations = (bpvRows ?? []).map(r => r.duration_seconds as number).filter(d => d > 0)
      if (durations.length > 0) {
        avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length
      }
    }

    // --- 4. 第2段: 前段の結果が要るものだけ（これも互いに独立なので同時に） ---
    let totalCardViews = 0
    let uniqueVisitors = 0
    // 画面に「n = 400」と出すためのサンプル数。調査が無ければ null
    let marketSampleSize: number | null = null

    const [viewsResult, sampleResult] = await Promise.all([
      profileIds.length > 0
        ? supabase
            .from('card_views')
            .select('ip_address')
            .in('profile_id', profileIds)
            .gte('viewed_at', cutoffISO)
        : Promise.resolve({ data: [] as { ip_address: string | null }[], error: null }),
      market.survey_id
        ? supabase.from('market_surveys').select('sample_size').eq('id', market.survey_id).single()
        : Promise.resolve({ data: null, error: null }),
    ])

    if (viewsResult.error) {
      console.error('[OuterScore] card_views クエリエラー:', viewsResult.error.message)
      return NextResponse.json({ error: viewsResult.error.message }, { status: 500 })
    }
    {
      const rows = viewsResult.data ?? []
      totalCardViews = rows.length
      const uniqueIps = new Set(rows.map(r => r.ip_address).filter(Boolean))
      uniqueVisitors = uniqueIps.size
    }
    marketSampleSize = ((sampleResult.data as { sample_size: number | null } | null)?.sample_size) ?? null

    // --- スコア算出（式は outer-metrics.ts が持つ） ---
    // 印象一致度は未実装のため null。weightedAverage が分母から外すので
    // 実質は残り4指標の加重平均になる（従来の /0.85 と同値）
    const { values, scores, digitalScore, unavailable } = computeDigitalMetrics(
      {
        members,
        uniqueVisitors,
        totalCardViews,
        vcardDownloads,
        brandPageClicks,
        avgDuration,
      },
      { cardEnabled }
    )

    const outerScore =
      weightedAverage([
        { score: market.score, weight: OUTER_TRACK_WEIGHTS.market },
        { score: digitalScore, weight: OUTER_TRACK_WEIGHTS.digital },
      ]) ?? 0

    const rank = getRank(outerScore)
    const r2 = (v: number) => Math.round(v * 100) / 100

    return NextResponse.json({
      period_days: period,
      period_is_all: isAllPeriod,
      total_card_views: totalCardViews,
      unique_visitors: uniqueVisitors,
      member_count: members,
      scores: {
        reach: { value: r2(values.reach), score: scores.reach, weight: OUTER_WEIGHTS.reach },
        interest: { value: r2(values.interest), score: scores.interest, weight: OUTER_WEIGHTS.interest },
        transition: { value: r2(values.transition), score: scores.transition, weight: OUTER_WEIGHTS.transition },
        engagement: { value: r2(values.engagement), score: scores.engagement, weight: OUTER_WEIGHTS.engagement },
        impression: null,
      },
      // 2本立ての内訳
      digital_score: digitalScore,
      // null の理由。disabled=機能オフ / insufficient_data=PV不足
      digital_unavailable: unavailable,
      market_score: market.score,
      market_stages: market.stages,
      market_survey_id: market.survey_id,
      market_sample_size: marketSampleSize,
      outer_score: outerScore,
      rank,
    })
  } catch (err) {
    console.error('[OuterScore] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
