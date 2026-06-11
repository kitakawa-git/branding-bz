// ブランドマップのグラフデータ整形（純関数・決定論。DBアクセス・AIなし）
// - 端点が解決できない関係は描画から除外（幽霊エッジ防御）
// - 表示対象は関係を1本以上持つ要素のみ（孤立要素は件数だけ返す）
// - 連結成分（島）の数も決定論で計算（integrity.ts の連結性チェックと同思想）
import type { ElementKind, ElementRef } from '@/lib/brand/elements-catalog'

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
