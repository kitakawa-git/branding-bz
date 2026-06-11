// 「裏づけ対象（実績で裏づけるべき約束）」の解決ロジック（純関数・全機能で共有）。
//
// 方針（提供価値を選定していない会社への対応）:
//   - 提供価値（value_propositions）が1件以上ある会社 → 従来どおり提供価値が裏づけ対象（規律を緩めない）
//   - 提供価値が0件の会社 → バリュー（philosophy_elements.element_type='value'）を裏づけ対象にする
//
// 「裏づけ済み」の判定:
//   - 提供価値: 直接FK（proof_points.value_proposition_id）または evidencedBy 関係
//   - バリュー: evidencedBy 関係（proof_points には philosophy への FK が無いため関係のみ）
//   いずれも evidencedBy は向きを両許容（要素→実績 / 実績→要素）。

export type BackingKind = 'value_proposition' | 'philosophy_element'
export type BackingMode = 'value_proposition' | 'value' // 'value' = バリューを代替アンカーにしている
export type BackingTarget = { kind: BackingKind; id: string; label: string }

type EdgeLike = {
  source_kind: string
  source_id: string
  target_kind: string
  target_id: string
  relation_type: string
}

// 提供価値があればVP、無ければバリューを裏づけ対象として返す。
export function resolveBackingTargets(
  vps: { id: string; title: string | null }[],
  valuePhils: { id: string; title: string | null; body: string | null }[],
): { targets: BackingTarget[]; mode: BackingMode } {
  if (vps.length > 0) {
    return {
      targets: vps.map((v) => ({ kind: 'value_proposition' as const, id: v.id, label: v.title || '(無題)' })),
      mode: 'value_proposition',
    }
  }
  return {
    targets: valuePhils.map((p) => ({
      kind: 'philosophy_element' as const,
      id: p.id,
      label: (p.title || p.body || '(無題)').slice(0, 40),
    })),
    mode: 'value',
  }
}

// 裏づけ対象の呼称（メッセージ・質問文・チップ用）
export const backingNoun = (mode: BackingMode): string => (mode === 'value' ? 'バリュー' : '提供価値')

// 対象（提供価値 or バリュー）が実績で裏づけられているか
export function isTargetBacked(
  t: BackingTarget,
  ers: EdgeLike[],
  vpIdsWithDirectProof: Set<string>,
): boolean {
  if (t.kind === 'value_proposition' && vpIdsWithDirectProof.has(t.id)) return true
  return ers.some(
    (r) =>
      r.relation_type === 'evidencedBy' &&
      ((r.source_kind === t.kind && r.source_id === t.id && r.target_kind === 'proof_point') ||
        (r.target_kind === t.kind && r.target_id === t.id && r.source_kind === 'proof_point')),
  )
}

// 実績が、いずれかの対象に結びついているか（直接FK or evidencedBy・向き両許容）
export function isProofLinked(pp: { id: string; value_proposition_id: string | null }, ers: EdgeLike[]): boolean {
  if (pp.value_proposition_id) return true
  return ers.some(
    (r) =>
      r.relation_type === 'evidencedBy' &&
      ((r.target_kind === 'proof_point' && r.target_id === pp.id) ||
        (r.source_kind === 'proof_point' && r.source_id === pp.id)),
  )
}
