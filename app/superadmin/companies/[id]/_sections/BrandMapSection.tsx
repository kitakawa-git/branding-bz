'use client'

// スーパー管理画面 企業詳細: 「ブランドマップ」セクション（読み取り専用・書込みなし）
// - タブ1「現状マップ」: d3-force による力学配置。島割れ・偏り・ハブが形として見える診断ビュー。
//   ノードサイズ=接続数比例。ノードドラッグ・パン・ズーム（ボタン）可。島クラスタ数を表示。
// - タブ2「構造マップ」: 同心円の固定配置（中心=理念 → 中間=提供価値・事業 → 外周=実績・ルール、
//   ペルソナは外周の別アーク）。決定論レイアウト（同じデータなら毎回同じ図）。プレゼンビュー。
// - 表示対象は関係を1本以上持つ要素のみ（孤立要素は「未接続の要素 N件」とだけ添える）。
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
import BrandMap3D from './BrandMap3D'

const W = 760
const H = 480

// ノード色: 理念=紫 / 事業=グレー / 提供価値=ピンク / 実績=緑 / ルール=橙 / ペルソナ=青
const nodeColor = (n: MapNode): string => {
  if (n.kind === 'philosophy_element') return n.philType === 'service' ? '#6b7280' : '#7c3aed'
  if (n.kind === 'value_proposition') return '#ec4899'
  if (n.kind === 'proof_point') return '#16a34a'
  if (n.kind === 'governance_rule') return '#ea580c'
  return 'var(--ds-app-accent)'
}
const nodeKindLabel = (n: MapNode): string =>
  n.kind === 'philosophy_element' && n.philType === 'service' ? '事業' : KIND_LABELS[n.kind]

const EDGE_STYLE: Record<string, { stroke: string; dash?: string; width: number }> = {
  guides: { stroke: '#7c3aed', width: 1.5 },
  evidencedBy: { stroke: '#16a34a', width: 1.5 },
  [FK_EVIDENCE_TYPE]: { stroke: '#86efac', width: 1 }, // 実績の直接FK＝裏づけ（直接）。細い薄緑
  promisedTo: { stroke: 'var(--ds-app-accent)', width: 1.5 },
  communicatedAs: { stroke: '#0d9488', width: 1.5 },
  constrainedBy: { stroke: '#ea580c', dash: '5 4', width: 1.5 },
  conflictsWith: { stroke: '#dc2626', dash: '6 4', width: 2.5 }, // 矛盾は破線赤・太め
}
const edgeStyle = (t: string) => EDGE_STYLE[t] ?? { stroke: '#9ca3af', width: 1.5 }

// FK由来エッジは element_relations に無い表示専用種別のため、ラベルもここで吸収する
const relLabel = (t: string) => (t === FK_EVIDENCE_TYPE ? '裏づけ（直接）' : relationLabel(t))

const NODE_LEGEND: { label: string; color: string }[] = [
  { label: '理念', color: '#7c3aed' },
  { label: '事業', color: '#6b7280' },
  { label: '提供価値', color: '#ec4899' },
  { label: '実績', color: '#16a34a' },
  { label: 'ルール', color: '#ea580c' },
  { label: 'ペルソナ', color: 'var(--ds-app-accent)' },
]

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s)

type SimNode = SimulationNodeDatum & { id: string }

export default function BrandMapSection({ companyId }: { companyId: string }) {
  const [loading, setLoading] = useState(true)
  const [graph, setGraph] = useState<BrandMapGraph | null>(null)
  const [tab, setTab] = useState<'force' | 'circle' | 'space'>('force')
  const [selected, setSelected] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [forcePos, setForcePos] = useState<Map<string, LayoutPos>>(new Map())
  const [tf, setTf] = useState({ k: 1, x: 0, y: 0 }) // 現状マップのズーム/パン
  // AIレビュー・健全性バッジ（島/未接続）はサマリーハブへ一本化済み（MapReviewPanel / ハブの点検チップ）

  const svgRef = useRef<SVGSVGElement>(null)
  const simRef = useRef<{ sim: Simulation<SimNode, undefined>; nodes: SimNode[] } | null>(null)
  const dragId = useRef<string | null>(null)
  const pan = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)

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

  // ---- 現状マップ: d3-force シミュレーション ----
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
        setForcePos(new Map(simNodes.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }])))
      })
    simRef.current = { sim, nodes: simNodes }
    return () => {
      sim.stop()
      simRef.current = null
    }
  }, [graph])

  const circlePos = useMemo(() => (graph ? concentricLayout(graph.nodes, W, H) : new Map<string, LayoutPos>()), [graph])
  const pos = tab === 'force' ? forcePos : circlePos

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

  // ---- 操作（ドラッグ・パン・ズーム） ----
  const toGraph = (e: React.PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect()
    return { x: (e.clientX - rect.left - tf.x) / tf.k, y: (e.clientY - rect.top - tf.y) / tf.k }
  }
  const onNodePointerDown = (ref: string) => (e: React.PointerEvent) => {
    if (tab !== 'force' || !simRef.current) return
    e.stopPropagation()
    dragId.current = ref
    simRef.current.sim.alphaTarget(0.3).restart()
  }
  const onSvgPointerDown = (e: React.PointerEvent) => {
    if (tab !== 'force') return
    pan.current = { sx: e.clientX, sy: e.clientY, ox: tf.x, oy: tf.y }
  }
  const onSvgPointerMove = (e: React.PointerEvent) => {
    if (tab !== 'force') return
    if (dragId.current && simRef.current) {
      const p = toGraph(e)
      const sn = simRef.current.nodes.find((n) => n.id === dragId.current)
      if (sn) {
        sn.fx = p.x
        sn.fy = p.y
      }
      return
    }
    if (pan.current) {
      setTf((t) => ({ ...t, x: pan.current!.ox + (e.clientX - pan.current!.sx), y: pan.current!.oy + (e.clientY - pan.current!.sy) }))
    }
  }
  const onSvgPointerUp = () => {
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
  }
  const zoom = (f: number) => setTf((t) => ({ ...t, k: Math.min(3, Math.max(0.4, t.k * f)) }))

  // ---- 描画ヘルパー ----
  const radius = (n: MapNode) => (tab === 'force' ? 7 + Math.min(9, n.degree * 1.5) : 7)
  const showLabel = (n: MapNode) =>
    focus === n.ref || selected === n.ref || (graph?.nodes.length ?? 0) <= 28 || n.kind === 'philosophy_element'
  const dimmed = (refOrEdge: string | { source: string; target: string }) => {
    if (!neighborRefs) return false
    if (typeof refOrEdge === 'string') return !neighborRefs.has(refOrEdge)
    return !(
      (refOrEdge.source === focus || refOrEdge.target === focus)
    )
  }
  const edgePath = (s: LayoutPos, t: LayoutPos) => {
    if (tab === 'force') return `M${s.x},${s.y} L${t.x},${t.y}`
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

  if (loading) return <p className="text-muted-foreground text-sm m-0">読み込み中...</p>
  if (!graph) return null

  // 空状態
  if (graph.edges.length === 0) {
    return (
      <p className="text-sm text-foreground border border-border bg-muted/40 rounded-lg p-3 m-0">
        関係が登録されるとマップが表示されます。上部「オントロジー構築」のステップ4（関係性）でAIスキャンを実行するか、関係グラフカードから手動で追加してください
        {graph.unconnectedCount > 0 && `（現在、未接続の要素 ${graph.unconnectedCount}件）`}
      </p>
    )
  }

  return (
    <div>
      {/* タブ＋ステータス */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setTab('force')}
            className={`px-3 py-1.5 text-[13px] font-semibold border-0 cursor-pointer ${tab === 'force' ? 'bg-ds-app-accent text-white' : 'bg-background text-muted-foreground hover:text-foreground'}`}
          >
            現状マップ
          </button>
          <button
            type="button"
            onClick={() => setTab('circle')}
            className={`px-3 py-1.5 text-[13px] font-semibold border-0 cursor-pointer ${tab === 'circle' ? 'bg-ds-app-accent text-white' : 'bg-background text-muted-foreground hover:text-foreground'}`}
          >
            構造マップ
          </button>
          <button
            type="button"
            onClick={() => setTab('space')}
            className={`px-3 py-1.5 text-[13px] font-semibold border-0 cursor-pointer ${tab === 'space' ? 'bg-ds-app-accent text-white' : 'bg-background text-muted-foreground hover:text-foreground'}`}
          >
            3Dビュー
          </button>
        </div>
        <div className="grow" />
        {tab === 'force' && (
          <span className="inline-flex items-center gap-1">
            <Button type="button" variant="outline" size="icon" className="size-7" onClick={() => zoom(1.25)} title="拡大">
              <Plus size={13} />
            </Button>
            <Button type="button" variant="outline" size="icon" className="size-7" onClick={() => zoom(0.8)} title="縮小">
              <Minus size={13} />
            </Button>
            <Button type="button" variant="outline" size="icon" className="size-7" onClick={() => setTf({ k: 1, x: 0, y: 0 })} title="リセット">
              <RotateCcw size={13} />
            </Button>
          </span>
        )}
      </div>

      {/* 3Dビュー（俯瞰・提案用。日常編集は2Dタブのまま） */}
      {tab === 'space' && (
        <BrandMap3D graph={graph} companyId={companyId} selected={selected} onSelect={setSelected} isActive />
      )}

      {/* マップ本体（2D） */}
      <div className={`border border-border rounded-lg bg-background overflow-hidden${tab === 'space' ? ' hidden' : ''}`}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none select-none"
          style={{ aspectRatio: `${W}/${H}`, cursor: tab === 'force' ? 'grab' : 'default' }}
          onPointerDown={onSvgPointerDown}
          onPointerMove={onSvgPointerMove}
          onPointerUp={onSvgPointerUp}
          onPointerLeave={onSvgPointerUp}
          onClick={() => setSelected(null)}
        >
          <g transform={tab === 'force' ? `translate(${tf.x},${tf.y}) scale(${tf.k})` : undefined}>
            {/* 構造マップのガイドリング＋中心コア */}
            {tab === 'circle' && (
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
                  opacity={dimmed({ source: e.source, target: e.target }) ? 0.15 : 0.85}
                />
              )
            })}

            {/* ノード */}
            {graph.nodes.map((n) => {
              const p = pos.get(n.ref)
              if (!p) return null
              const dim = dimmed(n.ref)
              return (
                <g
                  key={n.ref}
                  transform={`translate(${p.x},${p.y})`}
                  opacity={dim ? 0.3 : 1}
                  style={{ cursor: 'pointer' }}
                  onPointerDown={onNodePointerDown(n.ref)}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelected((cur) => (cur === n.ref ? null : n.ref))
                  }}
                  onMouseEnter={() => setHover(n.ref)}
                  onMouseLeave={() => setHover(null)}
                >
                  <circle r={radius(n)} fill={nodeColor(n)} stroke={selected === n.ref ? 'var(--ds-app-accent-hover)' : '#ffffff'} strokeWidth={selected === n.ref ? 3 : 1.5} />
                  {showLabel(n) && (
                    <text
                      y={radius(n) + 12}
                      textAnchor="middle"
                      fontSize={focus === n.ref ? 12 : 10}
                      fontWeight={focus === n.ref || selected === n.ref ? 700 : 400}
                      className="fill-foreground"
                      style={{ pointerEvents: 'none' }}
                    >
                      {focus === n.ref ? truncate(n.label, 30) : truncate(n.label, 12)}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      {/* 凡例（2Dのみ。3Dは自前の凡例を持つ） */}
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground${tab === 'space' ? ' hidden' : ''}`}>
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
