// ペルソナビルダーの本体連携（/api/tools/persona/connect）で行う brand_personas の同期。
// 以前は route の中に入れ子で書かれていたものを切り出した（中身・順番・ログ文言は同じ）。
// 失敗時は throw せず、route が以前と同じ文言の 500 を返せるよう error に文言を入れて返す。
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 既存レコード（sort_order順）に位置で対応づけて update、足りない分を insert、余剰（sort_order >= N）を delete（冪等）。
 * rows が空のときは何もしない（空セッションで既存を全消ししないためのガード）。
 */
export async function syncPersonaRows(
  supabaseAdmin: SupabaseClient,
  companyId: string,
  rows: Record<string, unknown>[],
): Promise<{ error?: string }> {
  const { data: existingPersonas } = await supabaseAdmin
    .from('brand_personas')
    .select('id, sort_order')
    .eq('company_id', companyId)
    .order('sort_order', { ascending: true })
  const existing = existingPersonas || []
  const N = rows.length

  // 空セッションで既存を全消ししないようガード（書くものが無ければ触らない）。
  if (N === 0) return {}

  for (let i = 0; i < N; i++) {
    const values = rows[i]
    if (existing[i]) {
      const { error: upErr } = await supabaseAdmin.from('brand_personas').update(values).eq('id', existing[i].id)
      if (upErr) {
        console.error('[Persona Connect] 更新エラー:', upErr)
        return { error: 'ペルソナの更新に失敗しました' }
      }
    } else {
      const { error: insErr } = await supabaseAdmin.from('brand_personas').insert({ company_id: companyId, ...values })
      if (insErr) {
        console.error('[Persona Connect] 挿入エラー:', insErr)
        return { error: 'ペルソナの作成に失敗しました' }
      }
    }
  }
  // 余剰（sort_order >= N）を削除
  if (existing.length > N) {
    const surplusIds = existing.slice(N).map((r) => r.id)
    const { error: delErr } = await supabaseAdmin.from('brand_personas').delete().in('id', surplusIds)
    if (delErr) {
      console.error('[Persona Connect] 余剰削除エラー:', delErr)
      return { error: 'ペルソナの整理に失敗しました' }
    }
  }
  return {}
}
