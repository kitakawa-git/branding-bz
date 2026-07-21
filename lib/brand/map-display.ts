// ブランドマップの表示定義（色・ラベル・言い回し）。描画方式（3D Canvas / 詳細パネル）に依らず共有する。
// 純データ＋純関数のみ。React・DOM・DBに依存しない。
import { KIND_LABELS, relationLabel } from '@/lib/brand/elements-catalog'
import { FK_EVIDENCE_TYPE, type BrandMapGraph, type MapNode } from '@/lib/brand/map-data'

// 理念=紫 / 事業=グレー / 提供価値=ピンク / 実績=緑 / ペルソナ=青 / ルール=橙 / 獲得目標=琥珀
// ※Canvas は CSS変数を解決できないため、ペルソナも globals.css の --ds-app-accent 実値で持つ。
export const NODE_COLOR: Record<string, string> = {
  philosophy: '#7c3aed',
  service: '#6b7280',
  value_proposition: '#ec4899',
  proof_point: '#16a34a',
  persona: '#2563eb',
  governance_rule: '#ea580c',
  desired_evidence: '#d97706',
}

const nodeColorKey = (n: MapNode): string => {
  if (n.kind === 'philosophy_element') return n.philType === 'service' ? 'service' : 'philosophy'
  if (n.kind === 'value_proposition') return 'value_proposition'
  if (n.kind === 'proof_point') return 'proof_point'
  if (n.kind === 'governance_rule') return 'governance_rule'
  if (n.kind === 'desired_evidence') return 'desired_evidence'
  return 'persona'
}
export const nodeColor = (n: MapNode): string => NODE_COLOR[nodeColorKey(n)]
export const nodeKindLabel = (n: MapNode): string =>
  n.kind === 'philosophy_element' && n.philType === 'service' ? '事業' : KIND_LABELS[n.kind]

// エッジ表示。未来設計の4種は獲得目標色に合わせ、requires / toBeEvidencedBy（これから満たす約束）は点線。
export const EDGE_STYLE: Record<string, { stroke: string; dash: boolean; width: number }> = {
  guides: { stroke: '#7c3aed', dash: false, width: 1.5 },
  evidencedBy: { stroke: '#16a34a', dash: false, width: 1.5 },
  [FK_EVIDENCE_TYPE]: { stroke: '#86efac', dash: false, width: 1 },
  promisedTo: { stroke: '#2563eb', dash: false, width: 1.5 },
  communicatedAs: { stroke: '#0d9488', dash: false, width: 1.5 },
  constrainedBy: { stroke: '#ea580c', dash: true, width: 1.5 },
  conflictsWith: { stroke: '#dc2626', dash: true, width: 2.5 },
  aspiresTo: { stroke: '#d97706', dash: false, width: 1.5 },
  requires: { stroke: '#d97706', dash: true, width: 1.5 },
  toBeEvidencedBy: { stroke: '#d97706', dash: true, width: 1.5 },
  verifies: { stroke: '#16a34a', dash: false, width: 1.5 },
}
export const edgeStyle = (t: string) => EDGE_STYLE[t] ?? { stroke: '#9ca3af', dash: false, width: 1.2 }

// FK由来エッジは element_relations に無い表示専用種別のため、ラベルもここで吸収する
export const relLabel = (t: string) => (t === FK_EVIDENCE_TYPE ? '裏づけ（直接）' : relationLabel(t))

export const NODE_LEGEND: { label: string; color: string }[] = [
  { label: '理念', color: NODE_COLOR.philosophy },
  { label: '事業', color: NODE_COLOR.service },
  { label: '提供価値', color: NODE_COLOR.value_proposition },
  { label: '実績', color: NODE_COLOR.proof_point },
  { label: 'ペルソナ', color: NODE_COLOR.persona },
  { label: 'ルール', color: NODE_COLOR.governance_rule },
  { label: '獲得目標', color: NODE_COLOR.desired_evidence },
]

// 説明バー用の言い回し（出ていく関係／入ってくる関係で語尾を変える）
const OUT_PHRASE: Record<string, string> = {
  guides: 'を方向づけ',
  evidencedBy: 'が裏づけ',
  [FK_EVIDENCE_TYPE]: 'が裏づけ',
  promisedTo: 'に約束',
  communicatedAs: 'として表現',
  constrainedBy: 'に制約される',
  conflictsWith: 'と矛盾',
  aspiresTo: 'を目指す',
  requires: 'が必要',
  toBeEvidencedBy: 'で裏づけ予定',
  verifies: 'を立証',
}
const IN_PHRASE: Record<string, string> = {
  guides: 'に方向づけられる',
  evidencedBy: 'を裏づけ',
  [FK_EVIDENCE_TYPE]: 'を裏づけ',
  promisedTo: 'から約束される',
  communicatedAs: 'の表現',
  constrainedBy: 'を制約',
  conflictsWith: 'と矛盾',
  aspiresTo: 'が目指す',
  requires: 'に必要とされる',
  toBeEvidencedBy: 'の裏づけ予定',
  verifies: 'が立証',
}

export type HoverSummary = { name: string; kind: string; parts: string[] }

/** 「名前（種別） — 実績2件が裏づけ・事業2件を方向づけ」用のまとめ */
export function summarizeHover(graph: BrandMapGraph, ref: string): HoverSummary | null {
  const nodeByRef = new Map(graph.nodes.map((n) => [n.ref, n]))
  const node = nodeByRef.get(ref)
  if (!node) return null
  const buckets = new Map<string, number>()
  for (const e of graph.edges) {
    const out = e.source === ref
    const inc = e.target === ref
    if (!out && !inc) continue
    const other = nodeByRef.get(out ? e.target : e.source)
    if (!other) continue
    const phrase = (out ? OUT_PHRASE : IN_PHRASE)[e.relation_type] ?? `と${relLabel(e.relation_type)}`
    const key = `${nodeKindLabel(other)}|${phrase}`
    buckets.set(key, (buckets.get(key) || 0) + 1)
  }
  const parts = Array.from(buckets.entries()).map(([key, n]) => {
    const [kind, phrase] = key.split('|')
    return `${kind}${n}件${phrase}`
  })
  return { name: node.label, kind: nodeKindLabel(node), parts }
}
