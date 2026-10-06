// ブランドページ閲覧行動記録API
// POST /api/analytics/brand-page-view
// ブランドページの閲覧行動を brand_page_views テーブルに記録
import { NextRequest, NextResponse } from 'next/server'
import { canRecordAnalytics } from '@/lib/billing/guard'
import { createClient } from '@supabase/supabase-js'

// 許可するページタイプ
const ALLOWED_PAGE_TYPES = [
  'guidelines',
  'strategy',
  'visuals',
  'verbal',
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, sourceProfileId, pageType, visitorId, sectionsViewed, scrollDepth, durationSeconds } = body

    // バリデーション
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }
    if (!pageType) {
      return NextResponse.json({ error: 'pageType is required' }, { status: 400 })
    }
    if (!ALLOWED_PAGE_TYPES.includes(pageType)) {
      return NextResponse.json({ error: `Invalid pageType: ${pageType}` }, { status: 400 })
    }

    // プラン判定:
    // - ブランド掲示（guidelines）だけは Free でも記録する。
    //   261006_料金プラン改訂案_v1（案B）のパイロット要件「担当者以外2名が閲覧」を数える
    //   ために必要。Freeの画面には分析表示は出さない（記録だけ残す）。
    // - 名刺・その他ページタイプは従来どおり cardAnalytics 判定（Standard 以上で記録）。
    // - 閲覧者にエラーは返さず、記録しなかったことだけ伝える。
    if (pageType !== 'guidelines' && !(await canRecordAnalytics(companyId))) {
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

    // scrollDepth を 0-100 にクランプ
    const clampedScrollDepth = typeof scrollDepth === 'number'
      ? Math.max(0, Math.min(100, Math.round(scrollDepth)))
      : 0

    // durationSeconds を 0以上にクランプ
    const clampedDuration = typeof durationSeconds === 'number'
      ? Math.max(0, Math.round(durationSeconds))
      : 0

    // 閲覧行動をINSERT
    const { error: insertError } = await supabase
      .from('brand_page_views')
      .insert({
        company_id: companyId,
        source_profile_id: sourceProfileId || null,
        page_type: pageType,
        visitor_id: visitorId || null,
        sections_viewed: Array.isArray(sectionsViewed) ? sectionsViewed : [],
        scroll_depth: clampedScrollDepth,
        duration_seconds: clampedDuration,
        ip_address: ip,
        user_agent: userAgent,
      })

    if (insertError) {
      console.error('[BrandPageView] INSERT エラー:', insertError.message)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ recorded: true })
  } catch (err) {
    console.error('[BrandPageView] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
