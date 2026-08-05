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
    const periodParam = searchParams.get('period')
    const period = periodParam ? parseInt(periodParam, 10) : 30

    // バリデーション
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 })
    }
    if (isNaN(period) || period < 1 || period > 365) {
      return NextResponse.json({ error: 'period must be 1-365' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // スマート名刺がオフの会社は、名刺ページ自体が非公開なのでアクセスログが
    // 溜まらない。0件を低評価として扱わないよう、デジタル接点は最初から外す
    const { data: company } = await supabase
      .from('companies')
      .select('card_enabled')
      .eq('id', companyId)
      .single()
    const cardEnabled = isFeatureEnabled(company, 'card_enabled')

    // 集計期間の起点
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - period)
    const cutoffISO = cutoff.toISOString()

    // --- 1. 社員数（profiles） ---
    const { count: memberCount, error: profilesError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)

    if (profilesError) {
      console.error('[OuterScore] profiles クエリエラー:', profilesError.message)
      return NextResponse.json({ error: profilesError.message }, { status: 500 })
    }
    const members = memberCount ?? 0

    // --- 2. 社員のprofile_id一覧（card_views結合用） ---
    const { data: profileRows, error: profileListError } = await supabase
      .from('profiles')
      .select('id')
      .eq('company_id', companyId)

    if (profileListError) {
      console.error('[OuterScore] profiles一覧エラー:', profileListError.message)
      return NextResponse.json({ error: profileListError.message }, { status: 500 })
    }
    const profileIds = (profileRows ?? []).map(r => r.id as string)

    // --- 3. card_views: 名刺PV数 & UU数（ip_addressベース） ---
    let totalCardViews = 0
    let uniqueVisitors = 0

    if (profileIds.length > 0) {
      const { data: viewRows, error: viewsError } = await supabase
        .from('card_views')
        .select('ip_address')
        .in('profile_id', profileIds)
        .gte('viewed_at', cutoffISO)

      if (viewsError) {
        console.error('[OuterScore] card_views クエリエラー:', viewsError.message)
        return NextResponse.json({ error: viewsError.message }, { status: 500 })
      }

      const rows = viewRows ?? []
      totalCardViews = rows.length
      const uniqueIps = new Set(rows.map(r => r.ip_address).filter(Boolean))
      uniqueVisitors = uniqueIps.size
    }

    // --- 4. card_events: 各イベント集計 ---
    let vcardDownloads = 0
    let brandPageClicks = 0

    {
      const { data: eventRows, error: eventsError } = await supabase
        .from('card_events')
        .select('event_type')
        .eq('company_id', companyId)
        .gte('created_at', cutoffISO)

      if (eventsError) {
        console.error('[OuterScore] card_events クエリエラー:', eventsError.message)
        return NextResponse.json({ error: eventsError.message }, { status: 500 })
      }

      for (const row of eventRows ?? []) {
        if (row.event_type === 'vcard_download') vcardDownloads++
        if (row.event_type === 'brand_page_click') brandPageClicks++
      }
    }

    // --- 5. brand_page_views: 平均滞在時間 ---
    let avgDuration = 0

    {
      const { data: bpvRows, error: bpvError } = await supabase
        .from('brand_page_views')
        .select('duration_seconds')
        .eq('company_id', companyId)
        .gte('created_at', cutoffISO)

      if (bpvError) {
        console.error('[OuterScore] brand_page_views クエリエラー:', bpvError.message)
        return NextResponse.json({ error: bpvError.message }, { status: 500 })
      }

      const durations = (bpvRows ?? []).map(r => r.duration_seconds as number).filter(d => d > 0)
      if (durations.length > 0) {
        avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length
      }
    }

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

    // 市場浸透（外部調査）。取り込んで反映中の調査が無ければ null になり、
    // アウタースコアは従来どおりデジタル接点だけで決まる
    const market = await calculateMarketScore(supabase, companyId)

    // 画面に「n = 400」と出すためのサンプル数。調査が無ければ null
    let marketSampleSize: number | null = null
    // 印象一致度は取り込み時に計算して保存してある（毎回セルを読み直さない）
    let marketImpression: number | null = null
    if (market.survey_id) {
      const { data: ms } = await supabase
        .from('market_surveys')
        .select('sample_size, impression_score')
        .eq('id', market.survey_id)
        .single()
      marketSampleSize = (ms?.sample_size as number | null) ?? null
      marketImpression =
        ms?.impression_score === null || ms?.impression_score === undefined
          ? null
          : Number(ms.impression_score)
    }

    const outerScore =
      weightedAverage([
        { score: market.score, weight: OUTER_TRACK_WEIGHTS.market },
        { score: digitalScore, weight: OUTER_TRACK_WEIGHTS.digital },
      ]) ?? 0

    const rank = getRank(outerScore)
    const r2 = (v: number) => Math.round(v * 100) / 100

    return NextResponse.json({
      period_days: period,
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
      market_impression: marketImpression,
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
