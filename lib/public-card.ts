// 公開名刺ページ（/card/[slug]）のデータ取得（サーバー専用）。
//
// ログインしていない人に見せるデータの入口はここだけにする。
// anon に companies / brand_guidelines / brand_visuals / philosophy_elements を読ませる設計はやめ、
// サーバーが service_role で「必要な列・公開してよい行」だけを読んで画面に渡す。
// select('*') や companies(*) は使わない（プランや競合分析まで読まないため）。
//
// 今後「公開ブランドページ」を作るときも、anon の SELECT は戻さず、ここに必要な列だけを足す。
import 'server-only'
import { cache } from 'react'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { rowsToPhilosophy, type Philosophy } from '@/lib/brand/philosophy'

const PROFILE_COLUMNS =
  'id, company_id, name, position, department, email, phone, photo_url, cover_image_url, bio, sns_x, sns_linkedin, sns_facebook, sns_instagram'
const COMPANY_COLUMNS = 'id, name, logo_url, website_url, card_enabled'
const GUIDELINES_COLUMNS = 'slogan, brand_story, concept_visuals, concept_visual_url'
const VISUALS_COLUMNS = 'fonts, color_palette'
const PHILOSOPHY_COLUMNS = 'element_type, title, body, sort_order'

export type PublicCardProfile = {
  id: string
  company_id: string
  name: string
  position: string | null
  department: string | null
  email: string | null
  phone: string | null
  photo_url: string | null
  cover_image_url: string | null
  bio: string | null
  sns_x: string | null
  sns_linkedin: string | null
  sns_facebook: string | null
  sns_instagram: string | null
}

export type PublicCardCompany = {
  id: string
  name: string
  logo_url: string | null
  website_url: string | null
  card_enabled: boolean
}

export type PublicCardGuidelines = {
  slogan: string | null
  brand_story: string | null
  concept_visuals: string[] | null
  concept_visual_url: string | null
}

export type PublicCardVisuals = {
  fonts: unknown
  color_palette: {
    brand_colors?: { hex: string }[]
    secondary_colors?: { hex: string }[]
    accent_colors?: { hex: string }[]
  } | null
}

export type PublicCardResult =
  | { status: 'not_found' }
  // 会社が名刺をオフにしている。slug・プロフィールは残しているので「非公開」の案内だけを出す
  | { status: 'disabled' }
  | {
      status: 'ok'
      profile: PublicCardProfile
      company: PublicCardCompany
      guidelines: PublicCardGuidelines | null
      visuals: PublicCardVisuals | null
      philosophy: Philosophy
    }

// generateMetadata と本体で同じ問い合わせを2回しないよう、1リクエスト内で共有する
export const getPublicCard = cache(async (slug: string): Promise<PublicCardResult> => {
  const supabase = getSupabaseAdmin()

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('slug', slug)
    .eq('card_enabled', true)
    .maybeSingle()
  if (profileError) throw new Error(`名刺の取得に失敗しました: ${profileError.message}`)
  const profile = profileData as unknown as PublicCardProfile | null
  if (!profile?.company_id) return { status: 'not_found' }

  // 承認されていない会社の名刺は存在しない扱いにする
  const { data: companyData, error: companyError } = await supabase
    .from('companies')
    .select(COMPANY_COLUMNS)
    .eq('id', profile.company_id)
    .eq('approval_status', 'active')
    .maybeSingle()
  if (companyError) throw new Error(`会社情報の取得に失敗しました: ${companyError.message}`)
  const company = companyData as unknown as PublicCardCompany | null
  if (!company) return { status: 'not_found' }
  if (!company.card_enabled) return { status: 'disabled' }

  // 子テーブルは上で確かめた会社の ID でだけ読む
  const [guidelinesRes, visualsRes, philosophyRes] = await Promise.all([
    supabase.from('brand_guidelines').select(GUIDELINES_COLUMNS).eq('company_id', company.id).maybeSingle(),
    supabase.from('brand_visuals').select(VISUALS_COLUMNS).eq('company_id', company.id).maybeSingle(),
    supabase
      .from('philosophy_elements')
      .select(PHILOSOPHY_COLUMNS)
      .eq('company_id', company.id)
      .eq('status', 'published')
      .order('sort_order', { ascending: true }),
  ])
  for (const { error } of [guidelinesRes, visualsRes, philosophyRes]) {
    // ブランド情報が読めなくても名刺そのものは出す（以前と同じ）
    if (error) console.error('[public-card] ブランド情報の取得エラー:', error.message)
  }

  return {
    status: 'ok',
    profile,
    company,
    guidelines: guidelinesRes.data as unknown as PublicCardGuidelines | null,
    visuals: visualsRes.data as unknown as PublicCardVisuals | null,
    philosophy: rowsToPhilosophy(philosophyRes.data ?? []),
  }
})
