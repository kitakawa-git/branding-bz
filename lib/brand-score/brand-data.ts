// ブランドデータ取得（AI設問生成の参照元）
// ============================================================
// 既存 /api/brand-score/surveys/[id]/generate-questions に
// インライン実装されていたブランドデータ取得ロジックを、そのまま
// 共通関数として切り出したもの。サーベイ／クイズ双方の
// generate-questions がこの関数を参照する（参照元の二重管理を防ぐ）。
//
// ※ 既存サーベイ側のロジックは変更しない（このファイルは新規追加）。
// ※ 2026-04-06 の参照元移行（companies からの分離。brand_visuals /
//   brand_personas / brand_personalities / brand_terms への移管）を
//   反映済み。フィールド選択は既存サーベイ generate-questions と一致。
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchPhilosophy } from '@/lib/brand/philosophy'

// ブランドデータ収集結果
export interface BrandData {
  company?: {
    name?: string
    slogan?: string
  }
  guidelines?: {
    business_content?: unknown
    mission?: string
    vision?: string
    values?: unknown
    traits?: unknown
    brand_story?: string
  }
  personas?: {
    target?: string
    segmentation_data?: unknown
    positioning_map_data?: unknown
    name?: string
    description?: string
  }[]
  personality?: {
    communication_style?: string
  }
  visuals?: {
    color_palette?: unknown
  }
  terms?: {
    preferred_term?: string
    avoided_term?: string
    context?: string
    category?: string
  }[]
}

// 企業のブランドデータを並列取得（テーブル不在・未登録でもエラーにしない）
export async function fetchBrandData(
  supabase: SupabaseClient,
  companyId: string
): Promise<BrandData> {
  const brandData: BrandData = {}

  const [
    companyResult,
    guidelinesResult,
    personasResult,
    personalityResult,
    visualsResult,
    termsResult,
  ] = await Promise.allSettled([
    // companies
    supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single(),
    // brand_guidelines（slogan の参照元。mission/vision/values/business_content は philosophy_elements へ正規化済み）
    supabase
      .from('brand_guidelines')
      .select('slogan, traits, brand_story')
      .eq('company_id', companyId)
      .single(),
    // brand_personas（複数行の可能性）
    supabase
      .from('brand_personas')
      .select('name, target, description, segmentation_data, positioning_map_data')
      .eq('company_id', companyId),
    // brand_personalities
    supabase
      .from('brand_personalities')
      .select('communication_style')
      .eq('company_id', companyId)
      .single(),
    // brand_visuals
    supabase
      .from('brand_visuals')
      .select('color_palette')
      .eq('company_id', companyId)
      .single(),
    // brand_terms（複数行）
    supabase
      .from('brand_terms')
      .select('preferred_term, avoided_term, context, category')
      .eq('company_id', companyId),
  ])

  // 各結果を安全に取得（テーブルが存在しない場合もエラーにしない）
  if (companyResult.status === 'fulfilled' && !companyResult.value.error) {
    // slogan は brand_guidelines 側を正とする（companies.slogan は廃止）
    const gData = guidelinesResult.status === 'fulfilled' && !guidelinesResult.value.error
      ? (guidelinesResult.value.data as { slogan?: string } | null)
      : null
    brandData.company = { ...(companyResult.value.data ?? {}), slogan: gData?.slogan ?? undefined }
  }
  if (guidelinesResult.status === 'fulfilled' && !guidelinesResult.value.error) {
    brandData.guidelines = guidelinesResult.value.data ?? undefined
  }
  // mission/vision/values/business_content は philosophy_elements 由来（brand_guidelines から正規化済み）
  const phil = await fetchPhilosophy(supabase, companyId)
  brandData.guidelines = {
    ...(brandData.guidelines ?? {}),
    mission: phil.mission ?? undefined,
    vision: phil.vision ?? undefined,
    values: phil.values,
    business_content: phil.services,
  }
  if (personasResult.status === 'fulfilled' && !personasResult.value.error) {
    brandData.personas = personasResult.value.data ?? []
  }
  if (personalityResult.status === 'fulfilled' && !personalityResult.value.error) {
    brandData.personality = personalityResult.value.data ?? undefined
  }
  if (visualsResult.status === 'fulfilled' && !visualsResult.value.error) {
    brandData.visuals = visualsResult.value.data ?? undefined
  }
  if (termsResult.status === 'fulfilled' && !termsResult.value.error) {
    brandData.terms = termsResult.value.data ?? []
  }

  return brandData
}

// ブランドデータが十分にあるか判定（既存サーベイ generate-questions と同一基準）
export function hasSufficientData(data: BrandData): boolean {
  const checks = [
    data.company?.name,
    data.company?.slogan,
    data.guidelines?.brand_story,
    data.guidelines?.mission,
    data.guidelines?.vision,
    data.guidelines?.business_content,
    data.personas && data.personas.length > 0,
    data.personality?.communication_style,
  ]
  // 少なくとも2つ以上のデータがあればOK
  const filledCount = checks.filter(Boolean).length
  return filledCount >= 2
}
