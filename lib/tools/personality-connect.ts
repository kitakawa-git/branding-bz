// ブランドパーソナリティ診断の本体連携（/api/tools/personality/connect の POST）で行う書き込み。
// 以前は POST の中にすべてが入れ子で書かれていたので、書き込み先ごとの関数に分けた（中身・順番・エラー文言は同じ）。
// 呼び出し側（route）が「上書き確認 → ここの関数を順に呼ぶ」だけになるようにしている。
// 各関数は失敗時に throw する（route の catch が 500「反映エラー: …」にする）。
import type { SupabaseClient } from '@supabase/supabase-js'
import type { DiagnosisResult } from '@/app/tools/personality/lib/diagnosis'
import { AAKER_BY_DIMENSION, type AakerDimension } from '@/app/tools/personality/lib/archetypes'

// AI出力の severity（low/medium/high）→ governance_rules の既存語彙（info/warn/block）
const SEVERITY_MAP: Record<string, string> = {
  low: 'info',
  medium: 'warn',
  high: 'block',
}

type Diagnosis = DiagnosisResult & { framework_at_generation?: string }

/** brand_guidelines.traits に入れる配列（選択フレームワーク分） */
export function buildTraits(framework: 'aaker' | 'archetype', d: Diagnosis) {
  if (framework === 'archetype') {
    // アーキタイプ特性: name はAI生成の特性名（dimension key を持たないためそのまま）
    return d.archetype_traits.map((item, i) => ({
      name: item.name,
      score: item.score,
      copy: item.copy || '',
      description: item.description || '',
      added_index: i,
    }))
  }
  // Aaker 5次元: name はセッションのラベルスナップショットではなく
  // dimension key から archetypes.ts の現行ラベルに正規化（改名後の旧ラベル復活を防ぐ）
  return d.aaker_scores.map((item, i) => ({
    name: AAKER_BY_DIMENSION[item.dimension as AakerDimension]?.label ?? item.label,
    score: item.score,
    copy: item.copy || '',
    description: item.description || '',
    added_index: i,
  }))
}

/** brand_guidelines を更新（行が無ければ作成） */
export async function saveGuidelines(
  supabaseAdmin: SupabaseClient,
  companyId: string,
  existingId: string | undefined,
  updates: Record<string, unknown>,
): Promise<void> {
  if (existingId) {
    const { error } = await supabaseAdmin.from('brand_guidelines').update(updates).eq('id', existingId)
    if (error) throw new Error(`brand_guidelines 更新エラー: ${error.message}`)
  } else {
    const { error } = await supabaseAdmin.from('brand_guidelines').insert({ company_id: companyId, ...updates })
    if (error) throw new Error(`brand_guidelines 作成エラー: ${error.message}`)
  }
}

/** brand_personalities を更新（行が無ければ作成） */
export async function savePersonalities(
  supabaseAdmin: SupabaseClient,
  companyId: string,
  personalityData: Record<string, unknown>,
): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from('brand_personalities')
    .select('id')
    .eq('company_id', companyId)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await supabaseAdmin.from('brand_personalities').update(personalityData).eq('id', existing.id)
    if (error) throw new Error(`brand_personalities 更新エラー: ${error.message}`)
  } else {
    const { error } = await supabaseAdmin.from('brand_personalities').insert({ company_id: companyId, ...personalityData })
    if (error) throw new Error(`brand_personalities 作成エラー: ${error.message}`)
  }
}

/**
 * brand_personality_tag_mappings（期待タグ。行は削除せず UPSERT で is_expected を切替）
 * 計測側（brand_micro_feedbacks）の語彙行と (company_id, tag) を共有するため、行の削除は一切しない。
 * 新セット → is_expected=true で UPSERT（既存 false 行があっても衝突せず true 化）。
 * 新セットに含まれない旧期待タグ → is_expected=false に降格（行は残す）。
 */
export async function syncExpectedTags(
  supabaseAdmin: SupabaseClient,
  companyId: string,
  newTags: string[],
): Promise<void> {
  // 1. 新セットを is_expected=true で UPSERT（行が無ければ作成、あれば true 化）
  if (newTags.length > 0) {
    const { error: upsertError } = await supabaseAdmin
      .from('brand_personality_tag_mappings')
      .upsert(
        newTags.map(tag => ({ company_id: companyId, tag, is_expected: true })),
        { onConflict: 'company_id,tag' },
      )
    if (upsertError) throw new Error(`期待タグ登録エラー: ${upsertError.message}`)
  }

  // 2. 新セットに含まれない既存の期待タグを is_expected=false に降格（削除はしない）
  const { data: currentExpected } = await supabaseAdmin
    .from('brand_personality_tag_mappings')
    .select('tag')
    .eq('company_id', companyId)
    .eq('is_expected', true)
  const toDemote = (currentExpected || []).map(r => r.tag as string).filter(t => !newTags.includes(t))
  if (toDemote.length > 0) {
    const { error: demoteError } = await supabaseAdmin
      .from('brand_personality_tag_mappings')
      .update({ is_expected: false })
      .eq('company_id', companyId)
      .in('tag', toDemote)
    if (demoteError) throw new Error(`旧期待タグ降格エラー: ${demoteError.message}`)
  }
}

/** 選択された tone_rules（インデックス）を診断結果から取り出す。範囲外・整数でないものは捨てる */
export function pickToneRules(d: Diagnosis, ruleIndexes: number[]) {
  return ruleIndexes
    .filter(i => Number.isInteger(i) && i >= 0 && i < d.tone_rules.length)
    .map(i => d.tone_rules[i])
}

/**
 * governance_rules（tone_rules・選択分のみ）を置き換える。
 * 置換方式: 既存の source='personality_diagnosis' な tone_rule を全削除→新規INSERT。
 * 手動追加分（source='manual'）は保持。AI出力の rule_text が微妙に変わっても正しく置換される。
 */
export async function replaceToneRules(
  supabaseAdmin: SupabaseClient,
  companyId: string,
  selectedRules: Diagnosis['tone_rules'],
): Promise<void> {
  const { error: deleteError } = await supabaseAdmin
    .from('governance_rules')
    .delete()
    .eq('company_id', companyId)
    .eq('rule_type', 'tone_rule')
    .eq('source', 'personality_diagnosis')
  if (deleteError) throw new Error(`旧 personality tone_rule 削除エラー: ${deleteError.message}`)

  // sort_order は残った手動ルールの末尾に連番
  const { data: remainingRules } = await supabaseAdmin
    .from('governance_rules')
    .select('sort_order')
    .eq('company_id', companyId)
  const maxOrder = (remainingRules || []).reduce((m, r) => Math.max(m, (r.sort_order as number) ?? 0), 0)
  const baseOrder = maxOrder + 1

  const { error } = await supabaseAdmin.from('governance_rules').insert(
    selectedRules.map((r, i) => ({
      company_id: companyId,
      rule_type: 'tone_rule',
      scope: 'global',
      source: 'personality_diagnosis',
      rule_text: r.rule_text,
      ng_example: r.ng_example,
      ok_example: r.ok_example,
      severity: SEVERITY_MAP[r.severity] ?? 'warn',
      sort_order: baseOrder + i,
    })),
  )
  if (error) throw new Error(`governance_rules 登録エラー: ${error.message}`)
}
