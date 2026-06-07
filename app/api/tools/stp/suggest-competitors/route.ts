// STP分析ツール AI競合提案API
// POST /api/tools/stp/suggest-competitors — web_search で実在の競合を検索・提案（月1回上限）
// GET  /api/tools/stp/suggest-competitors — 今月の残り回数・リセット日時を返す（UI初期表示用）
//
// 認証: cookie セッションから getAdminContext() で company_id を解決。
//       ブランド情報・既存競合はフォームの最新値を body から受け取る（STPツールの suggest 系と同様）。
// クォータは feature_key='competitor_suggest' で管理画面と共通（1社あたり月次）。

import { NextRequest, NextResponse } from 'next/server'
import { getAdminContext } from '@/lib/learning/auth'
import {
  generateCompetitorSuggestions,
  getCompetitorRemaining,
  type ExistingCompetitor,
} from '@/lib/competitors/suggest'

type BasicInfo = {
  company_name?: string
  industry_category?: string
  industry_subcategory?: string
  industry?: string // 旧形式
  industry_other?: string // 旧形式
  business_descriptions?: Array<{ title?: string; description?: string }>
  target_segments?: Array<{ name?: string; description?: string }>
  competitors?: Array<{ name?: string; url?: string; notes?: string }>
}

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
export async function POST(request: NextRequest) {
  const ctx = await getAdminContext()
  if (!ctx) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  let basicInfo: BasicInfo = {}
  try {
    const body = await request.json()
    basicInfo = (body?.basic_info ?? {}) as BasicInfo
  } catch {
    basicInfo = {}
  }

  // ブランド情報（あるものだけ載せる。STPフォームの最新値を使用）
  const brandInfo: Record<string, unknown> = {
    企業名: basicInfo.company_name?.trim() || '未設定',
  }
  if (basicInfo.industry_category) {
    brandInfo['業種（大分類）'] = basicInfo.industry_category
    if (basicInfo.industry_subcategory) brandInfo['業種（小分類）'] = basicInfo.industry_subcategory
  } else if (basicInfo.industry) {
    brandInfo['業種'] =
      basicInfo.industry === 'その他' && basicInfo.industry_other
        ? basicInfo.industry_other
        : basicInfo.industry
  }

  const businessContent = Array.isArray(basicInfo.business_descriptions)
    ? basicInfo.business_descriptions
        .map(b => [b.title, b.description].filter(v => v && v.trim()).join('：'))
        .filter(Boolean)
    : []
  if (businessContent.length > 0) brandInfo['事業内容'] = businessContent

  const targetSegments = Array.isArray(basicInfo.target_segments)
    ? basicInfo.target_segments
        .map(ts => [ts.name, ts.description].filter(v => v && v.trim()).join('：'))
        .filter(Boolean)
    : []
  if (targetSegments.length > 0) brandInfo['ターゲット層'] = targetSegments

  const existingCompetitors: ExistingCompetitor[] = Array.isArray(basicInfo.competitors)
    ? basicInfo.competitors
    : []

  const result = await generateCompetitorSuggestions({
    companyId: ctx.companyId,
    brandInfo,
    existingCompetitors,
  })

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
  })
}
