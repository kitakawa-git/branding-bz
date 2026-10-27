// 構築ツールの共通プロフィール書き戻し（/api/tools/shared-profile の PATCH）で行う書き込みのうち、
// 入れ子が深かった2つを route から切り出したもの（中身・順番・ログ文言は同じ）。
// どちらも失敗してもログに出すだけで、PATCH 全体は止めない（以前と同じ扱い）。
import type { SupabaseClient } from '@supabase/supabase-js'

export type ServiceRow = {
  company_id: string
  element_type: string
  title: string
  body: string
  sort_order: number
  status: string
}

/**
 * 事業内容（philosophy_elements の service 行）を id 保持で同期する。
 * 全削除→全INSERT だと行の id が毎回変わり、削除時トリガ cleanup_element_relations_on_delete が
 * service を端点に持つ element_relations を道連れに消してしまう（エッジ消失バグ）。クライアントは id を持たないため、
 * sort_order 順の既存行に位置で対応づけて UPDATE し、増えた分は INSERT、減った末尾分のみ DELETE する。
 * → 通常編集では既存行の id が保たれエッジが残る。実際に減らした分だけ正しくエッジ整理される。
 */
export async function syncServiceElements(
  supabaseAdmin: SupabaseClient,
  companyId: string,
  serviceRows: ServiceRow[],
): Promise<void> {
  const { data: existingSvc, error: exErr } = await supabaseAdmin
    .from('philosophy_elements')
    .select('id')
    .eq('company_id', companyId)
    .eq('element_type', 'service')
    .order('sort_order', { ascending: true })
  if (exErr) {
    console.error('[SharedProfile PATCH] service既存取得エラー:', exErr)
    return
  }

  const existingIds = (existingSvc as { id: string }[] | null)?.map((r) => r.id) ?? []
  for (let i = 0; i < serviceRows.length; i++) {
    if (i < existingIds.length) {
      const { error } = await supabaseAdmin
        .from('philosophy_elements')
        .update({ title: serviceRows[i].title, body: serviceRows[i].body, sort_order: i, status: 'published' })
        .eq('id', existingIds[i])
      if (error) console.error('[SharedProfile PATCH] service更新エラー:', error)
    } else {
      const { error } = await supabaseAdmin.from('philosophy_elements').insert(serviceRows[i])
      if (error) console.error('[SharedProfile PATCH] service挿入エラー:', error)
    }
  }
  if (existingIds.length > serviceRows.length) {
    const toDelete = existingIds.slice(serviceRows.length)
    const { error } = await supabaseAdmin.from('philosophy_elements').delete().in('id', toDelete)
    if (error) console.error('[SharedProfile PATCH] service削除エラー:', error)
  }
}

/**
 * brand_personas.target にターゲット情報（整形済みテキスト）を書く。
 * 先頭（sort_order 最小）のペルソナがあれば更新（空なら null）、無ければテキストがあるときだけ作成する。
 */
export async function saveTargetToFirstPersona(
  supabaseAdmin: SupabaseClient,
  companyId: string,
  targetText: string,
): Promise<void> {
  const { data: existingPersona } = await supabaseAdmin
    .from('brand_personas')
    .select('id')
    .eq('company_id', companyId)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (existingPersona) {
    await supabaseAdmin
      .from('brand_personas')
      .update({ target: targetText || null })
      .eq('id', existingPersona.id)
  } else if (targetText) {
    await supabaseAdmin
      .from('brand_personas')
      .insert({
        company_id: companyId,
        name: '',
        sort_order: 0,
        target: targetText,
      })
  }
}
