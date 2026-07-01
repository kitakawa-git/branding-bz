// AI競合提案API（管理画面 ブランド基本情報）
// POST /api/admin/competitors/suggest — web_search で実在の競合を検索・提案（月1回上限）
// GET  /api/admin/competitors/suggest — 今月の残り回数・リセット日時を返す（UI初期表示用）
//
// 認証: cookie セッションから getAdminContext() で company_id を解決。
//       クライアントから送られた company_id は使わない。
// 共通ロジックは lib/competitors/suggest.ts に集約（STPツールと共用・クォータも共通）。

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminContext } from '@/lib/learning/auth'
import { fetchPhilosophy } from '@/lib/brand/philosophy'
import {
  generateCompetitorSuggestions,
  getCompetitorRemaining,
  type ExistingCompetitor,
} from '@/lib/competitors/suggest'

// GET: 残り回数とリセット日時を返す（消費しない）
export async function GET() {
  const ctx = await getAdminContext()
  if (!ctx) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const result = await getCompetitorRemaining(ctx.companyId)
  if ('error' in result) {
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
  return NextResponse.json(result)
}

// POST: 競合を提案
export async function POST() {
  const ctx = await getAdminContext()
  if (!ctx) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }
  const companyId = ctx.companyId
  const supabase = getSupabaseAdmin()

  // 入力データ収集（company_id 基準・取れるものだけ。最小は name ＋業種）
  const [companyResult, personaResult] = await Promise.allSettled([
    supabase
      .from('companies')
      .select('name, industry_category, industry_subcategory, website_url, competitors, target_segments')
      .eq('id', companyId)
      .maybeSingle(),
    supabase
      .from('brand_personas')
      .select('target')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const company = companyResult.status === 'fulfilled' ? companyResult.value.data : null
  const persona = personaResult.status === 'fulfilled' ? personaResult.value.data : null

  if (!company) {
    return NextResponse.json({ error: '企業データが見つかりません' }, { status: 404 })
  }

  const existingCompetitors: ExistingCompetitor[] = Array.isArray(company.competitors)
    ? (company.competitors as ExistingCompetitor[])
    : []

  // ブランド情報（あるものだけ載せる）
  const brandInfo: Record<string, unknown> = { 企業名: company.name || '未設定' }
  if (company.industry_category) brandInfo['業種（大分類）'] = company.industry_category
  if (company.industry_subcategory) brandInfo['業種（小分類）'] = company.industry_subcategory
  if (company.website_url) brandInfo['ウェブサイト'] = company.website_url

  // 事業内容・mission/vision は philosophy_elements 由来（business_content は service 行へ正規化済み）
  const phil = await fetchPhilosophy(supabase, companyId)
  const businessContent = phil.services
    .map(c => [c.title, c.description].filter(Boolean).join('：'))
    .filter(Boolean)
  if (businessContent.length > 0) brandInfo['事業内容'] = businessContent
  if (phil.mission) brandInfo['ミッション'] = phil.mission
  if (phil.vision) brandInfo['ビジョン'] = phil.vision

  const targetSegments = Array.isArray(company.target_segments)
    ? (company.target_segments as Array<{ name?: string; description?: string }>)
        .map(ts => [ts.name, ts.description].filter(Boolean).join('：'))
        .filter(Boolean)
    : []
  if (targetSegments.length > 0) brandInfo['ターゲット層'] = targetSegments
  else if (persona?.target) brandInfo['ターゲット層'] = persona.target

  const result = await generateCompetitorSuggestions({ companyId, brandInfo, existingCompetitors })

  if (result.status === 'limit') {
    return NextResponse.json({ error: 'limit_reached', resetsAt: result.resetsAt }, { status: 429 })
  }
  if (result.status === 'error') {
    return NextResponse.json({ error: '競合の提案に失敗しました' }, { status: 500 })
  }
  return NextResponse.json({
    suggestions: result.suggestions,
    remaining: result.remaining,
    resetsAt: result.resetsAt,
    unlimited: result.unlimited ?? false,
  })
}
