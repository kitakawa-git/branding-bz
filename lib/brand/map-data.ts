// ブランドマップのグラフデータ整形（純関数・決定論。DBアクセス・AIなし）
// - 端点が解決できない関係は描画から除外（幽霊エッジ防御）
// - 実績の直接FK（proof_points.value_proposition_id）も「裏づけ（直接）」エッジとして含める。
//   連結性チェック（integrity.ts）がFKを辺に数えるのと描画・島数を一致させるため。
//   同じペアに明示的な evidencedBy 関係がある場合はFK線を重ねない（二重線回避）。
// - 表示対象は関係を1本以上持つ要素のみ（孤立要素は件数だけ返す）
// - 連結成分（島）の数も決定論で計算（integrity.ts の連結性チェックと同基準）
import type { ElementKind, ElementRef } from '@/lib/brand/elements-catalog'

// 実績の直接FK由来エッジの擬似 relation_type（element_relations には存在しない表示専用の種別）
export const FK_EVIDENCE_TYPE = 'fk_evidence'

export type ProofFkRow = { id: string; value_proposition_id: string | null }

export type RelationRow = {
  id: string
  source_kind: ElementKind
  source_id: string
  target_kind: ElementKind
  target_id: string
  relation_type: string
  note: string | null
}

export type MapNode = {
  ref: string // `${kind}:${id}`
  kind: ElementKind
  // philosophy_element のときの element_type（mission/vision/value/action_guideline/service。service=事業）
  philType: string | null
  label: string
  degree: number
}

export type MapEdge = {
  id: string
  source: string // ref
  target: string // ref
  relation_type: string
  note: string | null
}

export type BrandMapGraph = {
  nodes: MapNode[] // 関係を1本以上持つ要素のみ
  edges: MapEdge[] // 両端が解決できる関係のみ
  unconnectedCount: number // カタログ中、関係を持たない要素数
  islandCount: number // 表示ノード内の連結成分数（島）
  droppedEdgeCount: number // 端点解決不能で除外した関係数（通常0）
}

export function buildBrandMapGraph(
  catalog: ElementRef[],
  relations: RelationRow[],
  philTypes: Record<string, string>, // philosophy_elements の id → element_type
  proofFks: ProofFkRow[] = [], // 実績の直接FK（裏づけ（直接）エッジとして描画・島数に算入）
): BrandMapGraph {
  const refs = new Set(catalog.map((e) => `${e.kind}:${e.id}`))

  const edges: MapEdge[] = []
  let droppedEdgeCount = 0
  for (const r of relations) {
    const s = `${r.source_kind}:${r.source_id}`
    const t = `${r.target_kind}:${r.target_id}`
    if (!refs.has(s) || !refs.has(t)) {
      droppedEdgeCount++
      continue
    }
    edges.push({ id: r.id, source: s, target: t, relation_type: r.relation_type, note: r.note })
  }

  // 実績の直接FK → 裏づけ（直接）エッジ。同ペアに明示的 evidencedBy があればスキップ（二重線回避）
  const evidencedPairs = new Set(
    edges.filter((e) => e.relation_type === 'evidencedBy').map((e) => `${e.source}|${e.target}`),
  )
  for (const p of proofFks) {
    if (!p.value_proposition_id) continue
    const vpRef = `value_proposition:${p.value_proposition_id}`
    const ppRef = `proof_point:${p.id}`
    if (!refs.has(vpRef) || !refs.has(ppRef)) continue
    if (evidencedPairs.has(`${vpRef}|${ppRef}`) || evidencedPairs.has(`${ppRef}|${vpRef}`)) continue
    edges.push({ id: `fk:${p.id}`, source: vpRef, target: ppRef, relation_type: FK_EVIDENCE_TYPE, note: null })
  }

  const degree = new Map<string, number>()
  for (const e of edges) {
    degree.set(e.source, (degree.get(e.source) || 0) + 1)
    degree.set(e.target, (degree.get(e.target) || 0) + 1)
  }

  const nodes: MapNode[] = catalog
    .filter((e) => degree.has(`${e.kind}:${e.id}`))
    .map((e) => ({
      ref: `${e.kind}:${e.id}`,
      kind: e.kind,
      philType: e.kind === 'philosophy_element' ? (philTypes[e.id] ?? null) : null,
      label: e.label,
      degree: degree.get(`${e.kind}:${e.id}`)!,
    }))

  // 連結成分（無向）
  const adj = new Map<string, string[]>()
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, [])
    if (!adj.has(e.target)) adj.set(e.target, [])
    adj.get(e.source)!.push(e.target)
    adj.get(e.target)!.push(e.source)
  }
  const seen = new Set<string>()
  let islandCount = 0
  for (const n of nodes) {
    if (seen.has(n.ref)) continue
    islandCount++
    const queue = [n.ref]
    seen.add(n.ref)
    for (let i = 0; i < queue.length; i++) {
      for (const nb of adj.get(queue[i]) || []) {
        if (!seen.has(nb)) {
          seen.add(nb)
          queue.push(nb)
        }
      }
    }
  }

  return {
    nodes,
    edges,
    unconnectedCount: catalog.length - nodes.length,
    islandCount,
    droppedEdgeCount,
  }
}

// ---- 構造マップ（同心円）レイアウト ----
// 配置は決定論（同じデータなら毎回同じ図）。
// 中心=「理念」コア → 内周=理念（mission/vision/value/action_guideline）
// → 中間=提供価値＋事業（philosophy の service 行） → 外周=実績＋表現ルール。
// ペルソナは外周の別アーク（右上）に置く。

export type LayoutPos = { x: number; y: number }

const PHIL_ORDER: Record<string, number> = { mission: 0, vision: 1, value: 2, action_guideline: 3 }

function placeOnArc(
  out: Map<string, LayoutPos>,
  nodes: MapNode[],
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
) {
  const span = endDeg - startDeg
  nodes.forEach((n, i) => {
    const deg = startDeg + ((i + 0.5) * span) / nodes.length
    const rad = ((deg - 90) * Math.PI) / 180 // -90: 12時起点
    out.set(n.ref, { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) })
  })
}

export function concentricLayout(nodes: MapNode[], width: number, height: number): Map<string, LayoutPos> {
  const cx = width / 2
  const cy = height / 2
  const R = Math.min(width, height) / 2 - 36
  const byLabel = (a: MapNode, b: MapNode) => a.label.localeCompare(b.label, 'ja')

  const inner = nodes
    .filter((n) => n.kind === 'philosophy_element' && n.philType !== 'service')
    .sort((a, b) => (PHIL_ORDER[a.philType || ''] ?? 9) - (PHIL_ORDER[b.philType || ''] ?? 9) || byLabel(a, b))
  const middle = nodes
    .filter((n) => n.kind === 'value_proposition' || (n.kind === 'philosophy_element' && n.philType === 'service'))
    .sort(byLabel)
  const outer = nodes.filter((n) => n.kind === 'proof_point' || n.kind === 'governance_rule').sort(byLabel)
  const personas = nodes.filter((n) => n.kind === 'persona').sort(byLabel)

  const pos = new Map<string, LayoutPos>()
  placeOnArc(pos, inner, cx, cy, R * 0.34, 0, 360)
  placeOnArc(pos, middle, cx, cy, R * 0.62, 0, 360)
  if (personas.length > 0) {
    // 外周はペルソナ用アーク（右上 24°〜72°）を空けて配置
    placeOnArc(pos, outer, cx, cy, R * 0.9, 80, 376)
    placeOnArc(pos, personas, cx, cy, R * 0.9, 24, 72)
  } else {
    placeOnArc(pos, outer, cx, cy, R * 0.9, 0, 360)
  }
  return pos
}

// ---- 理念からの到達可能性（「理念に届かない要素」＝島） ----
// スーパー管理のチップと構築度スコアで同じ数字を出すための共有純関数（唯一の実装）。
//
// 判定ルール:
// - 根＝ミッション・ビジョン・バリューの全件（M/V/V は常に根）。
//   ※ 旧仕様は mission→vision→value の優先順位フォールバックで、ミッションがある会社では
//     ビジョンやバリューが「理念に届かない」側に落ちる直感に反する挙動だった（2026-07-21修正）。
// - 辺＝関係（向きは無視・無向）＋実績の直接FK（proof_points.value_proposition_id）。
// - 検出対象＝理念（根自身を除く）/提供価値/実績/表現ルール。
//   ペルソナは対象外（理念由来でなくてよい）だが、経路としては通過できる。
// - 根が1つも無い会社（M/V/V 全て未登録）は判定しない＝空配列（全要素が島になり煩雑なため）。

/** 到達可能性の計算に使う辺。kind は string で受ける（未来設計の desired_evidence を含むため） */
export type ReachabilityEdge = {
  source_kind: string
  source_id: string
  target_kind: string
  target_id: string
}

export function findUnreachableFromPhilosophy(
  catalog: ElementRef[],
  edges: ReachabilityEdge[],
  philTypes: Record<string, string>, // philosophy_elements の id → element_type
  proofFks: ProofFkRow[] = [],
): ElementRef[] {
  // M/V/V は常に根（優先順位フォールバックはしない）
  const roots = catalog.filter(
    (e) => e.kind === 'philosophy_element' && ['mission', 'vision', 'value'].includes(philTypes[e.id]),
  )
  if (roots.length === 0) return []

  const adj = new Map<string, string[]>()
  const addEdge = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, [])
    if (!adj.has(b)) adj.set(b, [])
    adj.get(a)!.push(b)
    adj.get(b)!.push(a)
  }
  for (const r of edges) addEdge(`${r.source_kind}:${r.source_id}`, `${r.target_kind}:${r.target_id}`)
  for (const p of proofFks) {
    if (p.value_proposition_id) addEdge(`value_proposition:${p.value_proposition_id}`, `proof_point:${p.id}`)
  }

  const reachable = new Set<string>(roots.map((e) => `philosophy_element:${e.id}`))
  const queue = [...reachable]
  for (let i = 0; i < queue.length; i++) {
    for (const nb of adj.get(queue[i]) || []) {
      if (!reachable.has(nb)) {
        reachable.add(nb)
        queue.push(nb)
      }
    }
  }

  const rootIds = new Set(roots.map((e) => e.id))
  return catalog.filter(
    (e) =>
      e.kind !== 'persona' &&
      !(e.kind === 'philosophy_element' && rootIds.has(e.id)) &&
      !reachable.has(`${e.kind}:${e.id}`),
  )
}
