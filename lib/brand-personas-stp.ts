// brand_personas テーブルの STP データ更新共通関数
// shared-profile API と stp/connect API の両方から利用
import type { SupabaseClient } from '@supabase/supabase-js'

export interface STPUpdateData {
  segmentation_data?: Record<string, unknown> | null
  positioning_map_data?: Record<string, unknown> | null
  persona_target?: string | null
  persona_name?: string | null
}

/**
 * brand_personas の最初のレコード（sort_order=0）に STP データを書き込む
 * レコードがなければ新規作成する
 */
export async function updateBrandPersonasSTP(
  supabaseAdmin: SupabaseClient,
  companyId: string,
  data: STPUpdateData
): Promise<{ success: boolean; error?: string }> {
  const updateFields: Record<string, unknown> = {}

  if (data.segmentation_data !== undefined) {
    // segmentation_data はマージ更新（既存の variables や targeting を個別に更新可能）
    const { data: existing } = await supabaseAdmin
      .from('brand_personas')
      .select('segmentation_data')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle()

    const existingSegData = (existing?.segmentation_data as Record<string, unknown>) || {}
    updateFields.segmentation_data = { ...existingSegData, ...data.segmentation_data }
  }

  if (data.positioning_map_data !== undefined) {
    updateFields.positioning_map_data = data.positioning_map_data
  }

  if (data.persona_target !== undefined) {
    updateFields.target = data.persona_target
  }

  if (data.persona_name !== undefined) {
    updateFields.name = data.persona_name
  }

  if (Object.keys(updateFields).length === 0) {
    return { success: true }
  }

  // 既存レコードを探す
  const { data: existingPersonas } = await supabaseAdmin
    .from('brand_personas')
    .select('id, sort_order')
    .eq('company_id', companyId)
    .order('sort_order', { ascending: true })

  if (existingPersonas && existingPersonas.length > 0) {
    const firstPersona = existingPersonas[0]
    const { error } = await supabaseAdmin
      .from('brand_personas')
      .update(updateFields)
      .eq('id', firstPersona.id)

    if (error) {
      console.error('[updateBrandPersonasSTP] 更新エラー:', error)
      return { success: false, error: error.message }
    }
  } else {
    // レコードがない場合は新規作成
    const { error } = await supabaseAdmin
      .from('brand_personas')
      .insert({
        company_id: companyId,
        name: data.persona_name ?? '',
        sort_order: 0,
        ...updateFields,
      })

    if (error) {
      console.error('[updateBrandPersonasSTP] 挿入エラー:', error)
      return { success: false, error: error.message }
    }
  }

  return { success: true }
}

/**
 * brand_personas の最初のレコードから STP データを読み込む
 */
export async function readBrandPersonasSTP(
  supabaseAdmin: SupabaseClient,
  companyId: string
): Promise<{
  segmentation_data: Record<string, unknown> | null
  positioning_map_data: Record<string, unknown> | null
  persona_name: string
  persona_target: string
} | null> {
  const { data: persona } = await supabaseAdmin
    .from('brand_personas')
    .select('segmentation_data, positioning_map_data, name, target')
    .eq('company_id', companyId)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!persona) return null

  return {
    segmentation_data: (persona.segmentation_data as Record<string, unknown>) || null,
    positioning_map_data: (persona.positioning_map_data as Record<string, unknown>) || null,
    persona_name: (persona.name as string) || '',
    persona_target: (persona.target as string) || '',
  }
}
