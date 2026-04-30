// アウタースコア算出API
// GET /api/analytics/outer-score?company_id=xxx&period=30
// 指定企業の外部ブランド浸透度スコアを算出して返す
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// --- 線形マッピングヘルパー ---
// value=0→0, value=midValue→50, value>=maxValue→100, 間は線形補間
function linearScore(value: number, midValue: number, maxValue: number): number {
  if (value <= 0) return 0
  if (value >= maxValue) return 100
  if (value <= midValue) {
    // 0→0, midValue→50
    return (value / midValue) * 50
  }
  // midValue→50, maxValue→100
  return 50 + ((value - midValue) / (maxValue - midValue)) * 50
}

// 0-100にクランプ
function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)))
}

// ランク判定
function getRank(score: number): string {
  if (score >= 90) return 'S'
  if (score >= 80) return 'A+'
  if (score >= 70) return 'A'
  if (score >= 60) return 'B+'
  if (score >= 50) return 'B'
  if (score >= 40) return 'C'
  return 'D'
}

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

    // --- スコア算出 ---

    // ■ 到達力（重み20%）: 名刺UU数 ÷ 社員数 × 10 → 0-100クランプ
    const reachValue = members > 0 ? (uniqueVisitors / members) * 10 : 0
    const reachScore = clamp(reachValue)

    // ■ 関心度（重み20%）: vcard_download数 ÷ 名刺PV数 × 100
    // 線形マッピング: 0%→0, 10%→50, 20%以上→100
    const interestPct = totalCardViews > 0 ? (vcardDownloads / totalCardViews) * 100 : 0
    const interestScore = clamp(linearScore(interestPct, 10, 20))

    // ■ ブランド遷移率（重み25%）: brand_page_click数 ÷ 名刺PV数 × 100
    // 線形マッピング: 0%→0, 5%→50, 15%以上→100
    const transitionPct = totalCardViews > 0 ? (brandPageClicks / totalCardViews) * 100 : 0
    const transitionScore = clamp(linearScore(transitionPct, 5, 15))

    // ■ ブランド関与度（重み20%）: 平均滞在秒数
    // 線形マッピング: 0s→0, 30s→50, 90s以上→100
    const engagementValue = avgDuration
    const engagementScore = clamp(linearScore(engagementValue, 30, 90))

    // ■ 印象一致度（重み15%）: Phase Cで実装 → null
    const impressionScore = null

    // --- 総合スコア（有効指標の加重平均、nullは按分） ---
    const weights = {
      reach: 0.20,
      interest: 0.20,
      transition: 0.25,
      engagement: 0.20,
      impression: 0.15,
    }

    // 印象一致度がnullなので残り85%で按分
    const activeWeight = weights.reach + weights.interest + weights.transition + weights.engagement
    const outerScore = clamp(
      (reachScore * weights.reach +
        interestScore * weights.interest +
        transitionScore * weights.transition +
        engagementScore * weights.engagement) / activeWeight
    )

    const rank = getRank(outerScore)

    return NextResponse.json({
      period_days: period,
      total_card_views: totalCardViews,
      unique_visitors: uniqueVisitors,
      member_count: members,
      scores: {
        reach: { value: Math.round(reachValue * 100) / 100, score: reachScore, weight: weights.reach },
        interest: { value: Math.round(interestPct * 100) / 100, score: interestScore, weight: weights.interest },
        transition: { value: Math.round(transitionPct * 100) / 100, score: transitionScore, weight: weights.transition },
        engagement: { value: Math.round(engagementValue * 100) / 100, score: engagementScore, weight: weights.engagement },
        impression: null,
      },
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
