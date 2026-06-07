// STP分析ツール AIターゲット提案API
// POST /api/tools/stp/suggest-targets — ブランド情報をもとにターゲット顧客像を提案（月1回上限・web_searchなし）
// GET  /api/tools/stp/suggest-targets — 今月の残り回数・リセット日時を返す（UI初期表示用）
//
// 認証: cookie セッションから getAdminContext() で company_id を解決。
//       ブランド情報・既存ターゲットはフォームの最新値を body で受け取る（STPの suggest 系と同様）。
// クォータは feature_key='target_suggest' で管理画面と共通（1社あたり月次）。

import { NextRequest, NextResponse } from 'next/server'
import { getAdminContext } from '@/lib/learning/auth'
import {
  generateTargetSuggestions,
  getTargetRemaining,
  type ExistingTarget,
} from '@/lib/brand/target-suggest'

type BasicInfo = {
  company_name?: string
  industry_category?: string
  industry_subcategory?: string
  industry?: string // 旧形式
  industry_other?: string // 旧形式
  business_descriptions?: Array<{ title?: string; description?: string }>
  target_segments?: Array<{ name?: string; description?: string }>
  competitors?: Array<{ name?: string }>
}

// GET: 残り回数とリセット日時を返す（消費しない）
export async function GET() {
  const ctx = await getAdminContext()
  if (!ctx) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const result = await getTargetRemaining(ctx.companyId)
  if ('error' in result) {
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
  return NextResponse.json(result)
}

// POST: ターゲットを提案
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

  // ブランド情報（あるものだけ。STPフォームの最新値を使用）
  const brandInfo: Record<string, unknown> = {}
  if (basicInfo.company_name?.trim()) brandInfo['企業名'] = basicInfo.company_name.trim()
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

  const competitors = Array.isArray(basicInfo.competitors)
    ? basicInfo.competitors.map(c => c.name).filter(Boolean)
    : []
  if (competitors.length > 0) brandInfo['競合'] = competitors

  const existingTargets: ExistingTarget[] = Array.isArray(basicInfo.target_segments)
    ? basicInfo.target_segments
    : []

  const result = await generateTargetSuggestions({
    companyId: ctx.companyId,
    brandInfo,
    existingTargets,
  })

  if (result.status === 'limit') {
    return NextResponse.json({ error: 'limit_reached', resetsAt: result.resetsAt }, { status: 429 })
  }
  if (result.status === 'error') {
    return NextResponse.json({ error: 'ターゲットの提案に失敗しました' }, { status: 500 })
  }
  return NextResponse.json({
    suggestions: result.suggestions,
    remaining: result.remaining,
    resetsAt: result.resetsAt,
  })
}
