// マイクロフィードバック送信API
// POST /api/analytics/micro-feedback
// 名刺閲覧者が印象タグを選択して送信

import { NextRequest, NextResponse } from 'next/server'
import { canRecordAnalytics } from '@/lib/billing/guard'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// 許可する印象タグ（8個のみ）
const ALLOWED_TAGS = [
  '信頼感',
  '革新的',
  '親しみやすい',
  '専門的',
  '洗練された',
  '情熱的',
  '堅実',
  '遊び心がある',
] as const

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, sourceProfileId, tags, visitorId } = body

    // バリデーション: companyId 必須
    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId は必須です' },
        { status: 400 },
      )
    }

    // バリデーション: tags 必須、1個以上
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return NextResponse.json(
        { error: 'tags は1個以上必須です' },
        { status: 400 },
      )
    }

    // バリデーション: 許可リストに含まれるタグのみ
    const invalidTags = tags.filter((t: string) => !ALLOWED_TAGS.includes(t as typeof ALLOWED_TAGS[number]))
    if (invalidTags.length > 0) {
      return NextResponse.json(
        { error: `許可されていないタグが含まれています: ${invalidTags.join(', ')}` },
        { status: 400 },
      )
    }

    // プラン判定: free では記録を残さない（名刺・ブランドページ自体は見えたまま）。
    // 閲覧者にエラーは返さず、記録しなかったことだけ伝える
    if (!(await canRecordAnalytics(companyId))) {
      return NextResponse.json({ recorded: false, reason: 'plan_required' })
    }

    const supabase = getSupabaseAdmin()

    // IP・User-Agent をヘッダーから取得
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown'

    // 重複送信チェック: 同一 visitor_id × company_id で24時間以内
    if (visitorId) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const { data: existing, error: dupErr } = await supabase
        .from('brand_micro_feedbacks')
        .select('id')
        .eq('company_id', companyId)
        .eq('visitor_id', visitorId)
        .gte('created_at', twentyFourHoursAgo)
        .limit(1)

      if (dupErr) {
        console.error('[micro-feedback] 重複チェックエラー:', dupErr)
        return NextResponse.json(
          { error: '重複チェックに失敗しました' },
          { status: 500 },
        )
      }

      if (existing && existing.length > 0) {
        return NextResponse.json(
          { error: '24時間以内にすでにフィードバックを送信済みです' },
          { status: 429 },
        )
      }
    }

    // brand_micro_feedbacks に挿入
    const { data, error } = await supabase
      .from('brand_micro_feedbacks')
      .insert({
        company_id: companyId,
        source_profile_id: sourceProfileId || null,
        tags,
        visitor_id: visitorId || null,
        ip_address: ip,
      })
      .select('id, created_at')
      .single()

    if (error) {
      console.error('[micro-feedback] 挿入エラー:', error)
      return NextResponse.json(
        { error: 'フィードバックの保存に失敗しました' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      id: data.id,
      created_at: data.created_at,
    })
  } catch (err) {
    console.error('[micro-feedback] エラー:', err)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 },
    )
  }
}
