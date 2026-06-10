// ビデオラーニング: カテゴリー/テーマ割り当ての解決（サーバー専用）
// テーマ指定時はそのテーマのカテゴリーを採用（整合）。テーマ無し＝カテゴリー単独可。両方無し＝未分類。
import type { SupabaseClient } from '@supabase/supabase-js'

type Resolved =
  | { category_id: string | null; theme_id: string | null }
  | { error: string; status: number }

export async function resolveCategoryTheme(
  supabase: SupabaseClient,
  companyId: string,
  categoryIdInput: unknown,
  themeIdInput: unknown
): Promise<Resolved> {
  const reqTheme = typeof themeIdInput === 'string' && themeIdInput ? themeIdInput : null
  const reqCat = typeof categoryIdInput === 'string' && categoryIdInput ? categoryIdInput : null

  if (reqTheme) {
    const { data: th } = await supabase
      .from('learning_themes')
      .select('id, category_id, company_id')
      .eq('id', reqTheme)
      .maybeSingle()
    if (!th || th.company_id !== companyId) {
      return { error: 'テーマが見つかりません', status: 404 }
    }
    return { category_id: th.category_id, theme_id: th.id }
  }
  if (reqCat) {
    const { data: cat } = await supabase
      .from('learning_categories')
      .select('id, company_id')
      .eq('id', reqCat)
      .maybeSingle()
    if (!cat || cat.company_id !== companyId) {
      return { error: 'カテゴリーが見つかりません', status: 404 }
    }
    return { category_id: cat.id, theme_id: null }
  }
  return { category_id: null, theme_id: null }
}
