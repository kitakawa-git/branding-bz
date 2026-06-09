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

export type ElementRef = { kind: ElementKind; id: string; label: string }

// 端点種別の和訳（ピッカーの optgroup・関係表示の接頭辞）
export const KIND_LABELS: Record<ElementKind, string> = {
  philosophy_element: '理念',
  value_proposition: '提供価値',
  proof_point: '証拠・実績',
  governance_rule: '表現ルール',
  persona: 'ペルソナ',
}

// philosophy_elements.element_type の和訳
const PHIL_TYPE_LABELS: Record<string, string> = {
  mission: 'ミッション',
  vision: 'ビジョン',
  value: 'バリュー',
  action_guideline: '行動指針',
}

// relation_type の和訳（オーサリングUI・AI整形で共有）
export const RELATION_TYPES: { value: string; label: string; desc: string }[] = [
  { value: 'guides', label: '方向づける', desc: 'A が B を方向づける' },
  { value: 'evidencedBy', label: '裏づけられる', desc: 'A は B（証拠）に裏づけられる' },
  { value: 'promisedTo', label: '約束する相手', desc: 'A は B（相手）に約束される' },
  { value: 'communicatedAs', label: '表現される', desc: 'A は B として表現される' },
  { value: 'constrainedBy', label: '制約される', desc: 'A は B（禁則）に制約される' },
  { value: 'conflictsWith', label: '矛盾する', desc: 'A と B は矛盾しうる' },
]

export const relationLabel = (v: string): string =>
  RELATION_TYPES.find((r) => r.value === v)?.label ?? v

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

  const [phil, vp, pp, gov, persona] = await Promise.all([
    supabase.from('philosophy_elements').select('id, element_type, title, body, sort_order').eq('company_id', companyId).order('sort_order', { ascending: true }),
    supabase.from('value_propositions').select('id, title, sort_order').eq('company_id', companyId).order('sort_order', { ascending: true }),
    supabase.from('proof_points').select('id, title, sort_order').eq('company_id', companyId).order('sort_order', { ascending: true }),
    supabase.from('governance_rules').select('id, rule_text, sort_order').eq('company_id', companyId).order('sort_order', { ascending: true }),
    supabase.from('brand_personas').select('id, name, sort_order').eq('company_id', companyId).order('sort_order', { ascending: true }),
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

  return out
}
