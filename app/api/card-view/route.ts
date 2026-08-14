// スマート名刺アクセス記録API
// POST /api/card-view
// 名刺ページ表示時にクライアントから呼び出される
// 同一IPからの連続アクセスは5分間重複排除
import { NextRequest, NextResponse } from 'next/server'
import { canRecordAnalytics, fetchCompanyIdForProfile } from '@/lib/billing/guard'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { profileId } = body

    if (!profileId) {
      return NextResponse.json({ error: 'profileId is required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // IPアドレス取得（Vercel環境 + ローカル対応）
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown'

    // User-Agent取得
    const userAgent = request.headers.get('user-agent') || ''

    // Referer取得
    const referer = request.headers.get('referer') || ''

    // Vercel Geo情報（Vercelデプロイ時のみ利用可能）
    const country = request.headers.get('x-vercel-ip-country') || null
    const city = request.headers.get('x-vercel-ip-city') || null

    // プラン判定: free では記録を残さない（名刺ページ自体は見えたままにする）。
    // 配布済みの QR を殺さないための方針。閲覧者にエラーは返さない
    if (!(await canRecordAnalytics(await fetchCompanyIdForProfile(profileId)))) {
      return NextResponse.json({ recorded: false, reason: 'plan_required' })
    }

    // 5分間重複排除: 同一IP + 同一profileIdの最新レコードを確認
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const { data: recentView } = await supabase
      .from('card_views')
      .select('id')
      .eq('profile_id', profileId)
      .eq('ip_address', ip)
      .gte('viewed_at', fiveMinAgo)
      .limit(1)
      .single()

    if (recentView) {
      // 5分以内に同一IPからのアクセスあり → スキップ
      return NextResponse.json({ recorded: false, reason: 'duplicate' })
    }

    // アクセス記録をINSERT
    const { error: insertError } = await supabase
      .from('card_views')
      .insert({
        profile_id: profileId,
        ip_address: ip,
        user_agent: userAgent,
        referer: referer,
        country: country,
        city: city,
      })

    if (insertError) {
      console.error('[CardView] INSERT エラー:', insertError.message)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ recorded: true })
  } catch (err) {
    console.error('[CardView] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
