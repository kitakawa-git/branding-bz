// 理念オントロジーの要素カタログ（element_relations の端点ピッカー／ラベル表示の共通取得）
// company の全要素（5種）を {kind, id, label} で返す。superadmin の関係オーサリングUI と
// Stage3 のAI整形（lib/brand/relations.ts）が同じラベル基準で参照する。
import type { SupabaseClient } from '@supabase/supabase-js'

export type ElementKind =
  | 'philosophy_element'
  | 'value_proposition'
  | 'proof_point'
  | 'governance_rule'
  | 'persona'
  | 'desired_evidence'

export type ElementRef = { kind: ElementKind; id: string; label: string }

// 端点種別の和訳（ピッカーの optgroup・関係表示の接頭辞）
export const KIND_LABELS: Record<ElementKind, string> = {
  philosophy_element: '理念',
  value_proposition: '提供価値',
  proof_point: '実績・エピソード',
  governance_rule: '表現ルール',
  persona: 'ペルソナ',
  desired_evidence: '獲得目標',
}

// philosophy_elements.element_type の和訳
const PHIL_TYPE_LABELS: Record<string, string> = {
  mission: 'ミッション',
  vision: 'ビジョン',
  value: 'バリュー',
  action_guideline: '行動指針',
}

// relation_type の和訳（表示辞書。過去データの表示用に communicatedAs も残す）
export const RELATION_TYPES: { value: string; label: string; desc: string }[] = [
  { value: 'guides', label: '方向づける', desc: 'A が B を方向づける' },
  { value: 'evidencedBy', label: '裏づけられる', desc: 'A は B（実績）に裏づけられる' },
  { value: 'promisedTo', label: '約束する相手', desc: 'A は B（相手）に約束される' },
  // communicatedAs は廃止（新規作成不可・DBトリガでも拒否）。要素6種に「表現物」にあたる
  // 種が無くレンジを定義できないため。表示ラベルだけ過去データ用に残す。
  { value: 'communicatedAs', label: '表現される', desc: '（廃止）A は B として表現される' },
  { value: 'constrainedBy', label: '制約される', desc: 'A は B（禁則）に制約される' },
  { value: 'conflictsWith', label: '矛盾する', desc: 'A と B は矛盾しうる' },
  // 未来設計（C案・§3-1）で追加した4種。DB側の CHECK / 端点検証トリガは適用済み。
  { value: 'aspiresTo', label: '目指す', desc: 'A は B（理想）を目指す' },
  { value: 'requires', label: '必要とする', desc: '理想 A の実現には B（獲得目標）が必要' },
  { value: 'toBeEvidencedBy', label: '裏づけ予定', desc: '未来の約束 A は B（獲得目標）で裏づく予定' },
  { value: 'verifies', label: '立証する', desc: 'A（実績）は、B（獲得目標）の達成を立証する' },
]

export const relationLabel = (v: string): string =>
  RELATION_TYPES.find((r) => r.value === v)?.label ?? v

// ---- 関係の意味制約（ドメイン/レンジ） ----
// 「どの種別の要素どうしを、どの関係で結べるか」の正。
// DBトリガ validate_element_relation_semantics（20260721163054）と同内容を保つこと。
// ここに無い relation_type（communicatedAs）は新規作成不可。
export const RELATION_RULES: Record<string, { sources: ElementKind[]; targets: ElementKind[] }> = {
  guides: { sources: ['philosophy_element'], targets: ['philosophy_element', 'value_proposition'] },
  evidencedBy: { sources: ['philosophy_element', 'value_proposition'], targets: ['proof_point'] },
  promisedTo: { sources: ['philosophy_element', 'value_proposition'], targets: ['persona'] },
  constrainedBy: { sources: ['philosophy_element', 'value_proposition'], targets: ['governance_rule'] },
  conflictsWith: {
    sources: ['philosophy_element', 'value_proposition', 'governance_rule'],
    targets: ['philosophy_element', 'value_proposition', 'governance_rule'],
  },
  aspiresTo: { sources: ['value_proposition'], targets: ['philosophy_element'] },
  requires: { sources: ['philosophy_element'], targets: ['desired_evidence'] },
  toBeEvidencedBy: { sources: ['value_proposition'], targets: ['desired_evidence'] },
  verifies: { sources: ['proof_point'], targets: ['desired_evidence'] },
}

/** 作成可能な relation_type（UIのセレクト・AI候補の検証で使う） */
export const CREATABLE_RELATION_TYPES = RELATION_TYPES.filter((r) => r.value in RELATION_RULES)

/** (relation_type, source_kind, target_kind) の組がドメイン/レンジに適合するか */
export function isValidRelationShape(relationType: string, sourceKind: string, targetKind: string): boolean {
  const rule = RELATION_RULES[relationType]
  if (!rule) return false
  return rule.sources.includes(sourceKind as ElementKind) && rule.targets.includes(targetKind as ElementKind)
}

function snippet(s: string | null | undefined, n = 48): string {
  const t = (s || '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n) + '…' : t
}

// company の全要素（5種）を {kind, id, label} のフラット配列で返す（種別→sort順）。
export async function fetchElementsCatalog(
  supabase: SupabaseClient,
  companyId: string,
): Promise<ElementRef[]> {
  if (!companyId) return []

  const [phil, vp, pp, gov, persona, de] = await Promise.all([
    supabase.from('philosophy_elements').select('id, element_type, title, body, sort_order').eq('company_id', companyId).order('sort_order', { ascending: true }),
    supabase.from('value_propositions').select('id, title, sort_order').eq('company_id', companyId).order('sort_order', { ascending: true }),
    supabase.from('proof_points').select('id, title, sort_order').eq('company_id', companyId).order('sort_order', { ascending: true }),
    supabase.from('governance_rules').select('id, rule_text, sort_order').eq('company_id', companyId).order('sort_order', { ascending: true }),
    supabase.from('brand_personas').select('id, name, sort_order').eq('company_id', companyId).order('sort_order', { ascending: true }),
    // 未来設計（獲得目標）。0件なら何も増えず既存挙動は不変。
    supabase.from('desired_evidence').select('id, title, sort_order').eq('company_id', companyId).order('sort_order', { ascending: true }),
  ])

  const out: ElementRef[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (phil.data as any[] | null) || []) {
    const t = PHIL_TYPE_LABELS[r.element_type as string] || (r.element_type as string)
    out.push({ kind: 'philosophy_element', id: r.id as string, label: `${t}：${snippet(r.title || r.body)}` })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (vp.data as any[] | null) || []) out.push({ kind: 'value_proposition', id: r.id as string, label: snippet(r.title) })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (pp.data as any[] | null) || []) out.push({ kind: 'proof_point', id: r.id as string, label: snippet(r.title) })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (gov.data as any[] | null) || []) out.push({ kind: 'governance_rule', id: r.id as string, label: snippet(r.rule_text) })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (persona.data as any[] | null) || []) out.push({ kind: 'persona', id: r.id as string, label: snippet(r.name) })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (de.data as any[] | null) || []) out.push({ kind: 'desired_evidence', id: r.id as string, label: snippet(r.title) })

  return out
}
