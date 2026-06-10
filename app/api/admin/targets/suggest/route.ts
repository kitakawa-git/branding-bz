// AIターゲット提案API（管理画面 ブランド戦略）
// POST /api/admin/targets/suggest — ブランド情報をもとにターゲット顧客像を提案（月1回上限・web_searchなし）
// GET  /api/admin/targets/suggest — 今月の残り回数・リセット日時を返す（UI初期表示用）
//
// 認証: cookie セッションから getAdminContext() で company_id を解決（クライアント送信値は不使用）。
// 共通ロジックは lib/brand/target-suggest.ts に集約（STPと共用・クォータも feature_key='target_suggest' で共通）。

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminContext } from '@/lib/learning/auth'
import { fetchPhilosophy } from '@/lib/brand/philosophy'
import {
  generateTargetSuggestions,
  getTargetRemaining,
  type ExistingTarget,
} from '@/lib/brand/target-suggest'

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
export async function POST() {
  const ctx = await getAdminContext()
  if (!ctx) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }
  const companyId = ctx.companyId
  const supabase = getSupabaseAdmin()

  // ブランド情報収集（取れるものだけ）
  const [companyResult, valuesResult, personasResult] = await Promise.allSettled([
    supabase
      .from('companies')
      .select('name, industry_category, industry_subcategory, target_segments, competitors')
      .eq('id', companyId)
      .maybeSingle(),
    supabase
      .from('value_propositions')
      .select('title, description, sort_order')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('brand_personas')
      .select('name, description, sort_order')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true }),
  ])

  const company = companyResult.status === 'fulfilled' ? companyResult.value.data : null
  const values = valuesResult.status === 'fulfilled' ? valuesResult.value.data : null
  const personas = personasResult.status === 'fulfilled' ? personasResult.value.data : null

  if (!company) {
    return NextResponse.json({ error: '企業データが見つかりません' }, { status: 404 })
  }

  // 既存ターゲット（重複除外用）
  const existingTargets: ExistingTarget[] = Array.isArray(company.target_segments)
    ? (company.target_segments as ExistingTarget[])
    : []

  // ブランド情報（あるものだけ載せる）
  const brandInfo: Record<string, unknown> = {}
  if (company.name) brandInfo['企業名'] = company.name
  if (company.industry_category) brandInfo['業種（大分類）'] = company.industry_category
  if (company.industry_subcategory) brandInfo['業種（小分類）'] = company.industry_subcategory

  // 事業内容・mission/vision は philosophy_elements 由来（business_content は service 行へ正規化済み）
  const phil = await fetchPhilosophy(supabase, companyId)
  const businessContent = phil.services
    .map(c => [c.title, c.description].filter(Boolean).join('：'))
    .filter(Boolean)
  if (businessContent.length > 0) brandInfo['事業内容'] = businessContent
  if (phil.mission) brandInfo['ミッション'] = phil.mission
  if (phil.vision) brandInfo['ビジョン'] = phil.vision

  const providedValues = Array.isArray(values)
    ? (values as Array<{ title?: string; description?: string }>)
        .map(v => [v.title, v.description].filter(Boolean).join('：'))
        .filter(Boolean)
    : []
  if (providedValues.length > 0) brandInfo['提供価値'] = providedValues

  const competitors = Array.isArray(company.competitors)
    ? (company.competitors as Array<{ name?: string }>).map(c => c.name).filter(Boolean)
    : []
  if (competitors.length > 0) brandInfo['競合'] = competitors

  const existingPersonas = Array.isArray(personas)
    ? (personas as Array<{ name?: string; description?: string }>)
        .map(p => [p.name, p.description].filter(Boolean).join('：'))
        .filter(Boolean)
    : []
  if (existingPersonas.length > 0) brandInfo['既存ペルソナ'] = existingPersonas

  const result = await generateTargetSuggestions({ companyId, brandInfo, existingTargets })

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
