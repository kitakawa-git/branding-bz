'use client'

// スーパー管理画面 企業詳細: 「ブランドマップ」（読み取り専用・書込みなし）
// - 1枚のマップに集約。既定は d3-force の力学配置（島割れ・偏り・ハブが形として見える）。
//   同心円の決定論配置は「整列レイアウト」（aligned prop）としてメニューから切り替える。
// - ホバー: 対象＋隣接のみ強調し他を減光。左下の説明バーに「名前 — 実績2件が裏づけ・…」を1行表示。
// - ズーム: ホイール/トラックパッド/ピンチでカーソル中心。＋/−/リセットのボタンも維持。
//   （d3-zoom は入れず自前実装。依存を増やさないため）
// - 凡例は既定で非表示（showLegend prop）。件数チップ・AIレビューはこのカードから撤去済み（ハブのメニューへ）。
// - 端点が解決できない関係は描画から除外（幽霊エッジ防御。buildBrandMapGraph 側で実施）。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationNodeDatum,
} from 'd3-force'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Minus, Plus, RotateCcw, X } from 'lucide-react'
import { fetchElementsCatalog, KIND_LABELS, relationLabel, type ElementKind } from '@/lib/brand/elements-catalog'
import { ONTOLOGY_DATA_CHANGED_EVENT } from './ontology-events'
import {
  buildBrandMapGraph,
  concentricLayout,
  FK_EVIDENCE_TYPE,
  type BrandMapGraph,
  type LayoutPos,
  type MapNode,
  type ProofFkRow,
  type RelationRow,
} from '@/lib/brand/map-data'

const W = 760
const H = 480

// ノード色: 理念=紫 / 事業=グレー / 提供価値=ピンク / 実績=緑 / ルール=橙 / ペルソナ=青 / 獲得目標=琥珀
export const nodeColor = (n: MapNode): string => {
  if (n.kind === 'philosophy_element') return n.philType === 'service' ? '#6b7280' : '#7c3aed'
  if (n.kind === 'value_proposition') return '#ec4899'
  if (n.kind === 'proof_point') return '#16a34a'
  if (n.kind === 'governance_rule') return '#ea580c'
  if (n.kind === 'desired_evidence') return '#d97706'
  return 'var(--ds-app-accent)'
}
export const nodeKindLabel = (n: MapNode): string =>
  n.kind === 'philosophy_element' && n.philType === 'service' ? '事業' : KIND_LABELS[n.kind]

export const EDGE_STYLE: Record<string, { stroke: string; dash?: string; width: number }> = {
  guides: { stroke: '#7c3aed', width: 1.5 },
  evidencedBy: { stroke: '#16a34a', width: 1.5 },
  [FK_EVIDENCE_TYPE]: { stroke: '#86efac', width: 1 }, // 実績の直接FK＝裏づけ（直接）。細い薄緑
  promisedTo: { stroke: 'var(--ds-app-accent)', width: 1.5 },
  communicatedAs: { stroke: '#0d9488', width: 1.5 },
  constrainedBy: { stroke: '#ea580c', dash: '5 4', width: 1.5 },
  conflictsWith: { stroke: '#dc2626', dash: '6 4', width: 2.5 }, // 矛盾は破線赤・太め
  aspiresTo: { stroke: '#d97706', width: 1.5 },
  requires: { stroke: '#d97706', dash: '5 4', width: 1.5 },
  toBeEvidencedBy: { stroke: '#d97706', dash: '5 4', width: 1.5 },
  verifies: { stroke: '#16a34a', width: 1.5 },
}
const edgeStyle = (t: string) => EDGE_STYLE[t] ?? { stroke: '#9ca3af', width: 1.5 }

// FK由来エッジは element_relations に無い表示専用種別のため、ラベルもここで吸収する
export const relLabel = (t: string) => (t === FK_EVIDENCE_TYPE ? '裏づけ（直接）' : relationLabel(t))

export const NODE_LEGEND: { label: string; color: string }[] = [
  { label: '理念', color: '#7c3aed' },
  { label: '事業', color: '#6b7280' },
  { label: '提供価値', color: '#ec4899' },
  { label: '実績', color: '#16a34a' },
  { label: 'ルール', color: '#ea580c' },
  { label: 'ペルソナ', color: 'var(--ds-app-accent)' },
  { label: '獲得目標', color: '#d97706' },
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

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s)

type SimNode = SimulationNodeDatum & { id: string }

export default function BrandMapSection({
  companyId,
  aligned = false,
  showLegend = false,
}: {
  companyId: string
  aligned?: boolean
  showLegend?: boolean
}) {
  const [loading, setLoading] = useState(true)
  const [graph, setGraph] = useState<BrandMapGraph | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [forcePos, setForcePos] = useState<Map<string, LayoutPos>>(new Map())
  const [tf, setTf] = useState({ k: 1, x: 0, y: 0 }) // ズーム/パン
  const [animate, setAnimate] = useState(true) // ドラッグ中はトランジションを切る

  const svgRef = useRef<SVGSVGElement>(null)
  const simRef = useRef<{ sim: Simulation<SimNode, undefined>; nodes: SimNode[] } | null>(null)
  const dragId = useRef<string | null>(null)
  const pan = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const pinch = useRef<number | null>(null)
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  // tick ごとの setState を rAF で間引く（毎tick全再描画を避ける）
  const pendingTick = useRef<number | null>(null)

  // ---- データ取得（読み取りのみ）。silent=true は再取得時（「読み込み中」を挟まず差し替え） ----
  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      const [catalog, relR, philR, ppR] = await Promise.all([
        fetchElementsCatalog(supabase, companyId),
        supabase
          .from('element_relations')
          .select('id, source_kind, source_id, target_kind, target_id, relation_type, note')
          .eq('company_id', companyId),
        supabase.from('philosophy_elements').select('id, element_type').eq('company_id', companyId),
        supabase.from('proof_points').select('id, value_proposition_id').eq('company_id', companyId),
      ])
      const philTypes: Record<string, string> = {}
      for (const p of (philR.data as { id: string; element_type: string }[] | null) || []) {
        philTypes[p.id] = p.element_type
      }
      setGraph(
        buildBrandMapGraph(
          catalog,
          (relR.data as RelationRow[] | null) || [],
          philTypes,
          (ppR.data as ProofFkRow[] | null) || [],
        ),
      )
      setLoading(false)
    },
    [companyId],
  )

  // 初回ロード＋ステップパネル内のCRUD（ONTOLOGY_DATA_CHANGED_EVENT）で再取得
  useEffect(() => {
    load()
    const handler = () => load(true)
    window.addEventListener(ONTOLOGY_DATA_CHANGED_EVENT, handler)
    return () => window.removeEventListener(ONTOLOGY_DATA_CHANGED_EVENT, handler)
  }, [load])

  // ---- d3-force シミュレーション ----
  useEffect(() => {
    if (!graph || graph.nodes.length === 0) return
    const simNodes: SimNode[] = graph.nodes.map((n, i) => ({
      id: n.ref,
      x: W / 2 + 120 * Math.cos((2 * Math.PI * i) / graph.nodes.length),
      y: H / 2 + 120 * Math.sin((2 * Math.PI * i) / graph.nodes.length),
    }))
    const links = graph.edges.map((e) => ({ source: e.source, target: e.target }))
    const sim = forceSimulation(simNodes)
      .force('link', forceLink<SimNode, { source: string | SimNode; target: string | SimNode }>(links).id((d) => d.id).distance(95).strength(0.6))
      .force('charge', forceManyBody().strength(-280))
      .force('center', forceCenter(W / 2, H / 2))
      .force('collide', forceCollide(28))
      .on('tick', () => {
        // 毎tickではなく次フレームに1回だけ反映する
        if (pendingTick.current !== null) return
        pendingTick.current = requestAnimationFrame(() => {
          pendingTick.current = null
          setForcePos(new Map(simNodes.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }])))
        })
      })
    simRef.current = { sim, nodes: simNodes }
    return () => {
      sim.stop()
      simRef.current = null
      if (pendingTick.current !== null) {
        cancelAnimationFrame(pendingTick.current)
        pendingTick.current = null
      }
    }
  }, [graph])

  const circlePos = useMemo(() => (graph ? concentricLayout(graph.nodes, W, H) : new Map<string, LayoutPos>()), [graph])
  const pos = aligned ? circlePos : forcePos

  const nodeByRef = useMemo(() => new Map((graph?.nodes || []).map((n) => [n.ref, n])), [graph])
  const focus = hover ?? selected
  const neighborRefs = useMemo(() => {
    if (!graph || !focus) return null
    const s = new Set<string>([focus])
    for (const e of graph.edges) {
      if (e.source === focus) s.add(e.target)
      if (e.target === focus) s.add(e.source)
    }
    return s
  }, [graph, focus])

  // ---- 座標変換 ----
  const toSvg = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect()
    return { x: (clientX - rect.left) * (W / rect.width), y: (clientY - rect.top) * (H / rect.height) }
  }
  const toGraph = (clientX: number, clientY: number) => {
    const s = toSvg(clientX, clientY)
    return { x: (s.x - tf.x) / tf.k, y: (s.y - tf.y) / tf.k }
  }

  // カーソル中心ズーム（ホイール／トラックパッド／ピンチ共通）
  const zoomAt = (clientX: number, clientY: number, factor: number) => {
    setTf((t) => {
      const k2 = Math.min(3, Math.max(0.4, t.k * factor))
      if (k2 === t.k) return t
      const s = toSvg(clientX, clientY)
      const gx = (s.x - t.x) / t.k
      const gy = (s.y - t.y) / t.k
      return { k: k2, x: s.x - gx * k2, y: s.y - gy * k2 }
    })
  }
  const onWheel = (e: React.WheelEvent) => {
    if (!svgRef.current) return
    zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 0.89)
  }
  // ボタンズームは中心基準
  const zoom = (f: number) =>
    setTf((t) => {
      const k2 = Math.min(3, Math.max(0.4, t.k * f))
      const gx = (W / 2 - t.x) / t.k
      const gy = (H / 2 - t.y) / t.k
      return { k: k2, x: W / 2 - gx * k2, y: H / 2 - gy * k2 }
    })

  // ---- 操作（ノードドラッグ・パン・ピンチ） ----
  const onNodePointerDown = (ref: string) => (e: React.PointerEvent) => {
    if (aligned || !simRef.current) return
    e.stopPropagation()
    dragId.current = ref
    setAnimate(false)
    simRef.current.sim.alphaTarget(0.3).restart()
  }
  const onSvgPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values())
      pinch.current = Math.hypot(a.x - b.x, a.y - b.y)
      pan.current = null
      return
    }
    pan.current = { sx: e.clientX, sy: e.clientY, ox: tf.x, oy: tf.y }
    setAnimate(false)
  }
  const onSvgPointerMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    // ピンチズーム（2本指の距離変化を中点基準で適用）
    if (pointers.current.size === 2 && pinch.current !== null) {
      const [a, b] = Array.from(pointers.current.values())
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (d > 0 && pinch.current > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch.current)
      pinch.current = d
      return
    }

    if (dragId.current && simRef.current) {
      const p = toGraph(e.clientX, e.clientY)
      const sn = simRef.current.nodes.find((n) => n.id === dragId.current)
      if (sn) {
        sn.fx = p.x
        sn.fy = p.y
      }
      return
    }
    if (pan.current) {
      setTf((t) => ({ ...t, x: pan.current!.ox + (e.clientX - pan.current!.sx) * (W / (svgRef.current?.getBoundingClientRect().width || W)), y: pan.current!.oy + (e.clientY - pan.current!.sy) * (H / (svgRef.current?.getBoundingClientRect().height || H)) }))
    }
  }
  const onSvgPointerUp = (e?: React.PointerEvent) => {
    if (e) pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (dragId.current && simRef.current) {
      const sn = simRef.current.nodes.find((n) => n.id === dragId.current)
      if (sn) {
        sn.fx = null
        sn.fy = null
      }
      simRef.current.sim.alphaTarget(0)
    }
    dragId.current = null
    pan.current = null
    setAnimate(true)
  }

  // ---- 描画ヘルパー ----
  const radius = (n: MapNode) => (aligned ? 7 : 7 + Math.min(9, n.degree * 1.5))
  const showLabel = (n: MapNode) =>
    focus === n.ref || selected === n.ref || (graph?.nodes.length ?? 0) <= 28 || n.kind === 'philosophy_element'
  const dimmed = (refOrEdge: string | { source: string; target: string }) => {
    if (!neighborRefs) return false
    if (typeof refOrEdge === 'string') return !neighborRefs.has(refOrEdge)
    return !(refOrEdge.source === focus || refOrEdge.target === focus)
  }
  const edgePath = (s: LayoutPos, t: LayoutPos) => {
    if (!aligned) return `M${s.x},${s.y} L${t.x},${t.y}`
    const mx = (s.x + t.x) / 2
    const my = (s.y + t.y) / 2
    const qx = mx + (W / 2 - mx) * 0.35
    const qy = my + (H / 2 - my) * 0.35
    return `M${s.x},${s.y} Q${qx},${qy} ${t.x},${t.y}`
  }

  const selectedNode = selected ? nodeByRef.get(selected) : null
  const selectedEdges = useMemo(() => {
    if (!graph || !selected) return []
    return graph.edges.filter((e) => e.source === selected || e.target === selected)
  }, [graph, selected])

  // ホバー説明バー：「名前 — 実績2件が裏づけ・事業2件を方向づけ」
  const hoverSummary = useMemo(() => {
    if (!graph || !hover) return null
    const node = nodeByRef.get(hover)
    if (!node) return null
    const buckets = new Map<string, number>()
    for (const e of graph.edges) {
      const out = e.source === hover
      const inc = e.target === hover
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
  }, [graph, hover, nodeByRef])

  if (loading) return <p className="text-muted-foreground text-sm m-0">読み込み中...</p>
  if (!graph) return null

  // 空状態
  if (graph.edges.length === 0) {
    return (
      <p className="text-sm text-foreground border border-border bg-muted/40 rounded-lg p-3 m-0">
        関係が登録されるとマップが表示されます。上部「オントロジー構築」のステップ5（関係性）でAIスキャンを実行するか、関係グラフカードから手動で追加してください
        {graph.unconnectedCount > 0 && `（現在、未接続の要素 ${graph.unconnectedCount}件）`}
      </p>
    )
  }

  return (
    <div>
      {/* マップ本体 */}
      <div className="relative border border-border rounded-lg bg-background overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none select-none"
          style={{ aspectRatio: `${W}/${H}`, cursor: animate ? 'grab' : 'grabbing' }}
          onPointerDown={onSvgPointerDown}
          onPointerMove={onSvgPointerMove}
          onPointerUp={onSvgPointerUp}
          onPointerCancel={onSvgPointerUp}
          onPointerLeave={() => {
            onSvgPointerUp()
            setHover(null)
          }}
          onWheel={onWheel}
          onClick={() => setSelected(null)}
        >
          <g
            transform={`translate(${tf.x},${tf.y}) scale(${tf.k})`}
            style={{ transition: animate ? 'transform 140ms ease-out' : undefined }}
          >
            {/* 整列レイアウトのガイドリング＋中心コア */}
            {aligned && (
              <>
                {[0.34, 0.62, 0.9].map((f) => (
                  <circle key={f} cx={W / 2} cy={H / 2} r={(Math.min(W, H) / 2 - 36) * f} fill="none" stroke="#9ca3af" strokeOpacity={0.25} strokeDasharray="2 4" />
                ))}
                <text x={W / 2} y={H / 2 + 4} textAnchor="middle" className="fill-foreground" fontSize={12} fontWeight={700} opacity={0.7}>
                  理念
                </text>
              </>
            )}

            {/* エッジ */}
            {graph.edges.map((e) => {
              const s = pos.get(e.source)
              const t = pos.get(e.target)
              if (!s || !t) return null
              const st = edgeStyle(e.relation_type)
              return (
                <path
                  key={e.id}
                  d={edgePath(s, t)}
                  fill="none"
                  stroke={st.stroke}
                  strokeWidth={st.width}
                  strokeDasharray={st.dash}
                  opacity={dimmed({ source: e.source, target: e.target }) ? 0.12 : 0.85}
                  style={{ transition: 'opacity 150ms ease-out' }}
                />
              )
            })}

            {/* ノード */}
            {graph.nodes.map((n) => {
              const p = pos.get(n.ref)
              if (!p) return null
              const dim = dimmed(n.ref)
              const isFocus = focus === n.ref
              return (
                <g
                  key={n.ref}
                  transform={`translate(${p.x},${p.y})`}
                  opacity={dim ? 0.22 : 1}
                  style={{ cursor: 'pointer', transition: 'opacity 150ms ease-out' }}
                  onPointerDown={onNodePointerDown(n.ref)}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelected((cur) => (cur === n.ref ? null : n.ref))
                  }}
                  onMouseEnter={() => setHover(n.ref)}
                  onMouseLeave={() => setHover(null)}
                >
                  <circle
                    r={radius(n) * (isFocus ? 1.18 : 1)}
                    fill={nodeColor(n)}
                    stroke={selected === n.ref ? 'var(--ds-app-accent-hover)' : '#ffffff'}
                    strokeWidth={selected === n.ref ? 3 : 1.5}
                    style={{ transition: 'r 150ms ease-out' }}
                  />
                  {showLabel(n) && (
                    <text
                      y={radius(n) + 12}
                      textAnchor="middle"
                      fontSize={isFocus ? 12 : 10}
                      fontWeight={isFocus || selected === n.ref ? 700 : 400}
                      className="fill-foreground"
                      style={{
                        pointerEvents: 'none',
                        paintOrder: 'stroke',
                        stroke: '#ffffff',
                        strokeWidth: 3,
                        strokeLinejoin: 'round',
                      }}
                    >
                      {isFocus ? truncate(n.label, 30) : truncate(n.label, 12)}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>

        {/* ズーム操作（マップ右上に重ねる） */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" className="size-7 bg-background/90" onClick={() => zoom(1.25)} title="拡大">
            <Plus size={13} />
          </Button>
          <Button type="button" variant="outline" size="icon" className="size-7 bg-background/90" onClick={() => zoom(0.8)} title="縮小">
            <Minus size={13} />
          </Button>
          <Button type="button" variant="outline" size="icon" className="size-7 bg-background/90" onClick={() => setTf({ k: 1, x: 0, y: 0 })} title="リセット">
            <RotateCcw size={13} />
          </Button>
        </div>

        {/* ホバー説明バー（左下） */}
        <div className="absolute bottom-2 left-2 right-2 pointer-events-none">
          {hoverSummary ? (
            <p className="m-0 inline-block max-w-full rounded-md border border-border bg-background/95 px-2.5 py-1.5 text-[12px] text-foreground shadow-sm break-words">
              <span className="font-bold">{hoverSummary.name}</span>
              <span className="text-muted-foreground">（{hoverSummary.kind}）</span>
              {hoverSummary.parts.length > 0 && (
                <>
                  <span className="text-muted-foreground"> — </span>
                  {hoverSummary.parts.join('・')}
                </>
              )}
            </p>
          ) : (
            <p className="m-0 text-[11px] text-muted-foreground/70">
              要素にカーソルを合わせるとつながりを表示・ドラッグで移動・ホイールで拡大縮小
            </p>
          )}
        </div>
      </div>

      {/* 凡例（既定は非表示。メニューから表示） */}
      {showLegend && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground">
          {NODE_LEGEND.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-full" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
          <span className="mx-1 text-border">|</span>
          {Object.entries(EDGE_STYLE).map(([k, st]) => (
            <span key={k} className="inline-flex items-center gap-1">
              <svg width="22" height="6">
                <line x1="0" y1="3" x2="22" y2="3" stroke={st.stroke} strokeWidth={st.width} strokeDasharray={st.dash} />
              </svg>
              {relLabel(k)}
            </span>
          ))}
        </div>
      )}

      {/* クリック詳細 */}
      {selectedNode && (
        <div className="border border-border rounded-lg p-3 mt-2 bg-muted/30">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="py-0.5 px-2 rounded text-[11px] font-semibold text-white" style={{ background: nodeColor(selectedNode) }}>
                {nodeKindLabel(selectedNode)}
              </span>
              <span className="text-sm font-bold text-foreground break-words">{selectedNode.label}</span>
              <span className="text-[11px] text-muted-foreground">接続 {selectedNode.degree}本</span>
            </div>
            <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0" onClick={() => setSelected(null)}>
              <X size={13} />
            </Button>
          </div>
          <div className="mt-2 space-y-1.5">
            {selectedEdges.map((e) => {
              const isSource = e.source === selected
              const other = nodeByRef.get(isSource ? e.target : e.source)
              const st = edgeStyle(e.relation_type)
              return (
                <div key={e.id} className="text-[13px] border-l-2 pl-2" style={{ borderColor: st.stroke }}>
                  <span className="font-semibold" style={{ color: st.stroke }}>
                    {isSource ? `—${relLabel(e.relation_type)}→` : `←${relLabel(e.relation_type)}—`}
                  </span>{' '}
                  <span className="text-foreground break-words">
                    {other ? `${nodeKindLabel(other)}「${other.label}」` : '（不明な要素）'}
                  </span>
                  {e.note && <p className="text-[12px] text-muted-foreground m-0 mt-0.5 break-words">{e.note}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
