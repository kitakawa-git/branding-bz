// 公開LP用デザイントークン（CSS変数）の取得
// 正本は Supabase の design_tokens テーブル（/admin/design-system で編集）。
import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

export const DESIGN_TOKENS_CACHE_TAG = 'design-tokens'

// unstable_cache 内では cookies() が使えないため、セッション非依存の anon クライアントで読む
// （design_tokens の SELECT は RLS で公開済み）
function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * design_tokens テーブルから全変数を取得し、`:root { ... }` 形式の CSS テキストとして返す。
 *
 * - app/layout.tsx から呼ばれて <style id="design-tokens"> として注入される
 * - unstable_cache で 60秒キャッシュ
 * - 管理画面で保存したら POST /api/revalidate → revalidateTag で即時反映
 * - 失敗時は空文字を返す（globals.css の :root 静的フォールバックで動作）
 */
export const getDesignTokensCss = unstable_cache(
  async (): Promise<string> => {
    const { data: tokens, error } = await createAnonClient()
      .from('design_tokens')
      .select('token_name, value')
      .order('category')
      .order('sort_order')

    if (error || !tokens || tokens.length === 0) {
      return ''
    }

    const lines = tokens.map((t) => `  ${t.token_name}: ${t.value};`).join('\n')
    return `:root {\n${lines}\n}`
  },
  ['design-tokens-css'],
  {
    revalidate: 60,
    tags: [DESIGN_TOKENS_CACHE_TAG],
  }
)
