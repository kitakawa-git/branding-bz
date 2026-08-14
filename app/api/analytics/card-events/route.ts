// 名刺ページアクションイベント記録API
// POST /api/analytics/card-events
// 名刺ページ上のボタンクリック等のイベントを card_events テーブルに記録
import { NextRequest, NextResponse } from 'next/server'
import { canRecordAnalytics } from '@/lib/billing/guard'
import { createClient } from '@supabase/supabase-js'

// 許可するイベントタイプ
const ALLOWED_EVENT_TYPES = [
  'vcard_download',
  'brand_page_click',
  'sns_click',
  'website_click',
  'phone_click',
  'email_click',
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { profileId, companyId, eventType, eventData, visitorId } = body

    // バリデーション
    if (!profileId) {
      return NextResponse.json({ error: 'profileId is required' }, { status: 400 })
    }
    if (!eventType) {
      return NextResponse.json({ error: 'eventType is required' }, { status: 400 })
    }
    if (!ALLOWED_EVENT_TYPES.includes(eventType)) {
      return NextResponse.json({ error: `Invalid eventType: ${eventType}` }, { status: 400 })
    }

    // プラン判定: free では記録を残さない（名刺・ブランドページ自体は見えたまま）。
    // 閲覧者にエラーは返さず、記録しなかったことだけ伝える
    if (!(await canRecordAnalytics(companyId))) {
      return NextResponse.json({ recorded: false, reason: 'plan_required' })
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

    // イベント記録をINSERT
    const { error: insertError } = await supabase
      .from('card_events')
      .insert({
        profile_id: profileId,
        company_id: companyId || null,
        event_type: eventType,
        event_data: eventData || {},
        visitor_id: visitorId || null,
        ip_address: ip,
        user_agent: userAgent,
      })

    if (insertError) {
      console.error('[CardEvents] INSERT エラー:', insertError.message)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ recorded: true })
  } catch (err) {
    console.error('[CardEvents] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
