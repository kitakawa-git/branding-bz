'use client'

// ブランドマップの唯一のビューア（3D）。カード内インライン と ⛶全画面プレゼンモード の両方をこれ1つで賄う。
// - Three.js は使わない。Canvas 2D の疑似3D（回転行列＋透視投影＋z順ソート描画）。依存追加なし。
// - inline: 明るい背景・自動回転オフ・毎回同じ初期アングル（正面斜め上）＋全体が収まる自動フィット。
//   fullscreen: 暗い背景・自動回転オン。差分はこの2つだけで、操作・描画は共通。
// - 表示専用（読み取りのみ）。データは呼び出し側の取得結果を props で受け取り、再fetchしない。
//   ただし獲得目標だけは判定/進捗API（読み取り専用）から進捗を補う（失敗・0件でも安全に動く）。
// - isActive のときだけ rAF ループを回す（false で停止・アンマウントで必ず cancel）。
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { RotateCcw, Pause, Play } from 'lucide-react'
import { type BrandMapGraph, type MapNode } from '@/lib/brand/map-data'
import { edgeStyle, nodeColor, nodeKindLabel, summarizeHover } from '@/lib/brand/map-display'
import type { DesiredEvidenceEvaluationDto } from '@/app/api/superadmin/desired-evidence/evaluations/route'

const VIEW_W = 760
const VIEW_H = 480
const FOCAL = 900 // 透視投影の焦点距離（大きいほどパースが弱い）
const CAM_Z = 520 // カメラ距離のオフセット

// 毎回同じ初期アングル（正面やや斜め上）。リセットもここへ戻す。
const INIT_ROT_X = -0.34
const INIT_ROT_Y = 0.4

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s)

type P3 = { x: number; y: number; z: number }
type Projected = { ref: string; sx: number; sy: number; scale: number; depth: number }

const PHIL_ORDER: Record<string, number> = { mission: 0, vision: 1, value: 2, action_guideline: 3 }
const byLabel = (a: MapNode, b: MapNode) => a.label.localeCompare(b.label, 'ja')

/** 同心リングの決定論レイアウト（乱数なし。同じデータなら毎回同じ図） */
function layout3D(nodes: MapNode[]): Map<string, P3> {
  const pos = new Map<string, P3>()
  const phil = nodes
    .filter((n) => n.kind === 'philosophy_element' && n.philType !== 'service')
    .sort((a, b) => (PHIL_ORDER[a.philType || ''] ?? 9) - (PHIL_ORDER[b.philType || ''] ?? 9) || byLabel(a, b))
  const services = nodes.filter((n) => n.kind === 'philosophy_element' && n.philType === 'service').sort(byLabel)
  const midOuter = nodes.filter((n) => n.kind === 'value_proposition' || n.kind === 'persona').sort(byLabel)
  const outer = nodes.filter((n) => n.kind === 'proof_point' || n.kind === 'governance_rule').sort(byLabel)
  const future = nodes.filter((n) => n.kind === 'desired_evidence').sort(byLabel)

  // 中心：ミッション（無ければ理念の先頭）
  const center = phil.find((n) => n.philType === 'mission') ?? phil[0] ?? null
  if (center) pos.set(center.ref, { x: 0, y: 0, z: 0 })

  const ring = (list: MapNode[], radius: number, ySpread: number, yBase = 0, phase = 0) => {
    const items = list.filter((n) => !pos.has(n.ref))
    items.forEach((n, i) => {
      const th = phase + (2 * Math.PI * i) / Math.max(1, items.length)
      const y = yBase + (items.length > 1 ? ySpread * Math.sin(i * 1.7) : 0)
      pos.set(n.ref, { x: radius * Math.cos(th), y, z: radius * Math.sin(th) })
    })
  }

  ring(phil, 120, 34, 0, 0)
  ring(services, 210, 26, 0, Math.PI / 7)
  ring(midOuter, 300, 30, 0, Math.PI / 5)
  ring(outer, 400, 36, 0, Math.PI / 11)
  // 未来層：上空リング（y は負が上）
  ring(future, 250, 16, -190, Math.PI / 3)

  // 念のため未配置ノードの保険（新しい kind が増えても落ちない）
  const rest = nodes.filter((n) => !pos.has(n.ref))
  ring(rest, 460, 30, 0, Math.PI / 3)
  return pos
}

/** 全要素が画面に収まる初期ズーム（ノードが少なければ寄る・多ければ引く。決定論） */
function fitZoom(positions: Map<string, P3>): number {
  let maxR = 1
  let maxY = 1
  for (const p of positions.values()) {
    maxR = Math.max(maxR, Math.hypot(p.x, p.z))
    maxY = Math.max(maxY, Math.abs(p.y))
  }
  const s0 = FOCAL / (FOCAL + CAM_Z) // 中心付近の投影スケール
  const zx = (VIEW_W * 0.40) / (maxR * s0)
  const zy = (VIEW_H * 0.38) / ((maxR * 0.5 + maxY) * s0) // 傾けた分 y 方向にも伸びる
  return Math.max(0.5, Math.min(1.2, Math.min(zx, zy)))
}

export default function BrandMap3D({
  graph,
  companyId,
  selected,
  onSelect,
  isActive,
  fullscreen = false,
}: {
  graph: BrandMapGraph
  companyId: string
  selected: string | null
  onSelect: (ref: string | null) => void
  isActive: boolean
  fullscreen?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)

  // 全画面（プレゼン）は自動回転オン、カード内は落ち着かせてオフ
  const [autoRotate, setAutoRotate] = useState(fullscreen)
  const [hover, setHover] = useState<string | null>(null)
  const [evals, setEvals] = useState<Record<string, DesiredEvidenceEvaluationDto>>({})

  const positions = useMemo(() => layout3D(graph.nodes), [graph.nodes])
  const initialZoom = useMemo(() => fitZoom(positions), [positions])

  // 毎フレーム更新する値は ref（再レンダリングを起こさない）
  const cam = useRef({ rotX: INIT_ROT_X, rotY: INIT_ROT_Y, zoom: initialZoom })
  const camTarget = useRef<{ rotX: number; rotY: number; zoom: number } | null>(null)
  const dragging = useRef<{ x: number; y: number } | null>(null)
  const pinch = useRef<number | null>(null)
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const projected = useRef<Projected[]>([])
  const hoverRef = useRef<string | null>(null)
  const selectedRef = useRef<string | null>(null)
  const autoRef = useRef(fullscreen)

  useEffect(() => { hoverRef.current = hover }, [hover])
  useEffect(() => { selectedRef.current = selected }, [selected])
  useEffect(() => { autoRef.current = autoRotate }, [autoRotate])
  // グラフが変わったら初期構図に戻す（毎回同じ見え方を担保）
  useEffect(() => {
    cam.current = { rotX: INIT_ROT_X, rotY: INIT_ROT_Y, zoom: initialZoom }
    camTarget.current = null
  }, [initialZoom])

  const nodeByRef = useMemo(() => new Map(graph.nodes.map((n) => [n.ref, n])), [graph.nodes])

  // 隣接（ホバー/選択時のハイライト用）
  const neighborsOf = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const e of graph.edges) {
      if (!m.has(e.source)) m.set(e.source, new Set())
      if (!m.has(e.target)) m.set(e.target, new Set())
      m.get(e.source)!.add(e.target)
      m.get(e.target)!.add(e.source)
    }
    return m
  }, [graph.edges])

  // 獲得目標の進捗（読み取りのみ。失敗・0件でも 3D は動く）
  useEffect(() => {
    const hasDe = graph.nodes.some((n) => n.kind === 'desired_evidence')
    if (!hasDe) return
    let cancelled = false
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return
        const res = await fetch(`/api/superadmin/desired-evidence/evaluations?companyId=${companyId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) return
        const json = await res.json()
        if (cancelled) return
        const map: Record<string, DesiredEvidenceEvaluationDto> = {}
        for (const e of (json.evaluations || []) as DesiredEvidenceEvaluationDto[]) map[e.id] = e
        setEvals(map)
      } catch {
        // 表示専用の補足情報なので握りつぶす（3D自体は動く）
      }
    })()
    return () => { cancelled = true }
  }, [companyId, graph.nodes])

  // ノードラベル（獲得目標は進捗を併記）
  const labelOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const n of graph.nodes) {
      let label = n.label
      if (n.kind === 'desired_evidence') {
        const id = n.ref.slice('desired_evidence:'.length)
        const p = evals[id]?.evaluation?.progress_fraction
        if (p != null) label = `${label}（進捗${Math.round(p * 100)}%）`
      }
      m.set(n.ref, label)
    }
    return m
  }, [graph.nodes, evals])

  // ---- 描画ループ（isActive のときだけ回す） ----
  useEffect(() => {
    if (!isActive) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let disposed = false
    // 全画面は暗め、カード内はカードに馴染む明るい配色
    const BG = fullscreen ? '#0b1020' : '#ffffff'
    const LABEL_BG = fullscreen ? 'rgba(8,12,26,0.78)' : 'rgba(255,255,255,0.86)'
    const LABEL_FG = fullscreen ? '#e5e7eb' : '#111827'
    const NODE_RING = fullscreen ? '#0b1020' : '#ffffff'

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const cssW = wrapRef.current?.clientWidth || VIEW_W
      const cssH = fullscreen
        ? Math.max(320, (wrapRef.current?.clientHeight || (cssW * VIEW_H) / VIEW_W))
        : (cssW * VIEW_H) / VIEW_W
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      canvas.style.height = `${cssH}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      return { cssW, cssH }
    }
    let size = resize()
    const ro = new ResizeObserver(() => { size = resize() })
    if (wrapRef.current) ro.observe(wrapRef.current)

    const project = (p: P3, cx: number, cy: number) => {
      const { rotX, rotY, zoom } = cam.current
      const cosY = Math.cos(rotY)
      const sinY = Math.sin(rotY)
      const x1 = p.x * cosY - p.z * sinY
      const z1 = p.x * sinY + p.z * cosY
      const cosX = Math.cos(rotX)
      const sinX = Math.sin(rotX)
      const y2 = p.y * cosX - z1 * sinX
      const z2 = p.y * sinX + z1 * cosX
      const scale = (FOCAL / (FOCAL + z2 + CAM_Z)) * zoom
      return { sx: cx + x1 * scale, sy: cy + y2 * scale, scale, depth: z2 }
    }

    const frame = () => {
      if (disposed) return
      const { cssW, cssH } = size
      const cx = cssW / 2
      const cy = cssH / 2

      // カメラ更新（注目中はイージング。自動回転はドラッグ/注目中は止める）
      if (camTarget.current) {
        const t = camTarget.current
        let dY = t.rotY - cam.current.rotY
        while (dY > Math.PI) dY -= Math.PI * 2
        while (dY < -Math.PI) dY += Math.PI * 2
        cam.current.rotY += dY * 0.09
        cam.current.rotX += (t.rotX - cam.current.rotX) * 0.09
        cam.current.zoom += (t.zoom - cam.current.zoom) * 0.09
        if (Math.abs(dY) < 0.004 && Math.abs(t.rotX - cam.current.rotX) < 0.004 && Math.abs(t.zoom - cam.current.zoom) < 0.004) {
          camTarget.current = null
        }
      } else if (autoRef.current && !dragging.current && !selectedRef.current && !hoverRef.current) {
        cam.current.rotY += 0.0025
      }

      ctx.clearRect(0, 0, cssW, cssH)
      ctx.fillStyle = BG
      ctx.fillRect(0, 0, cssW, cssH)

      // 投影
      const proj = new Map<string, Projected>()
      for (const n of graph.nodes) {
        const p = positions.get(n.ref)
        if (!p) continue
        proj.set(n.ref, { ref: n.ref, ...project(p, cx, cy) })
      }
      projected.current = Array.from(proj.values())

      const focus = hoverRef.current ?? selectedRef.current
      const near = focus ? neighborsOf.get(focus) : null
      const isLit = (ref: string) => !focus || ref === focus || !!near?.has(ref)

      // エッジ（奥から）
      const edges = graph.edges
        .map((e) => ({ e, s: proj.get(e.source), t: proj.get(e.target) }))
        .filter((x) => x.s && x.t) as { e: (typeof graph.edges)[number]; s: Projected; t: Projected }[]
      edges.sort((a, b) => (b.s.depth + b.t.depth) / 2 - (a.s.depth + a.t.depth) / 2)
      for (const { e, s, t } of edges) {
        const st = edgeStyle(e.relation_type)
        const lit = !focus || e.source === focus || e.target === focus
        const depthA = Math.max(0.15, Math.min(1, (s.scale + t.scale) / 2))
        ctx.globalAlpha = (lit ? 0.85 : 0.12) * depthA
        ctx.strokeStyle = st.stroke
        ctx.lineWidth = st.width * Math.max(0.6, (s.scale + t.scale) / 2)
        ctx.setLineDash(st.dash ? [5, 5] : [])
        // 軽いアーチ（中心側へ膨らませる）
        const mx = (s.sx + t.sx) / 2
        const my = (s.sy + t.sy) / 2
        ctx.beginPath()
        ctx.moveTo(s.sx, s.sy)
        ctx.quadraticCurveTo(mx + (cx - mx) * 0.18, my + (cy - my) * 0.18 - 10, t.sx, t.sy)
        ctx.stroke()
      }
      ctx.setLineDash([])
      ctx.globalAlpha = 1

      // ノード（奥から）
      const drawList = graph.nodes
        .map((n) => ({ n, p: proj.get(n.ref) }))
        .filter((x) => x.p) as { n: MapNode; p: Projected }[]
      drawList.sort((a, b) => b.p.depth - a.p.depth)

      for (const { n, p } of drawList) {
        const lit = isLit(n.ref)
        const focused = selectedRef.current === n.ref || hoverRef.current === n.ref
        const base = 5 + Math.min(7, n.degree * 1.1)
        const r = Math.max(1.8, base * p.scale * (focused ? 1.18 : 1))
        const color = nodeColor(n)
        // 奥ほど薄く（深度フェード）。発光は使わずフラットな円。
        ctx.globalAlpha = (lit ? 1 : 0.2) * Math.max(0.3, Math.min(1, p.scale * 1.1))

        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2)
        ctx.fill()

        ctx.strokeStyle = NODE_RING
        ctx.lineWidth = focused ? 2.5 : 1.2
        ctx.beginPath()
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2)
        ctx.stroke()
        if (focused) {
          ctx.strokeStyle = color
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(p.sx, p.sy, r + 3.5, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      }

      // ラベル（手前のものだけ・小さすぎるものは可読性優先で省く）
      for (const { n, p } of [...drawList].reverse()) {
        const focused = hoverRef.current === n.ref || selectedRef.current === n.ref
        if (!focused) {
          if (!isLit(n.ref)) continue
          if (p.scale < 0.62) continue
          if (graph.nodes.length > 34 && n.kind !== 'philosophy_element' && n.kind !== 'desired_evidence') continue
        }
        const text = focused ? labelOf.get(n.ref) || n.label : truncate(labelOf.get(n.ref) || n.label, 14)
        const fs = focused ? 12 : Math.max(9, Math.min(11, 11 * p.scale))
        ctx.font = `${focused ? 700 : 400} ${fs}px system-ui, -apple-system, sans-serif`
        const w = ctx.measureText(text).width
        const bx = p.sx - w / 2 - 4
        const by = p.sy + 10 * Math.max(0.6, p.scale)
        ctx.globalAlpha = focused ? 0.95 : 0.75
        ctx.fillStyle = LABEL_BG
        ctx.fillRect(bx, by, w + 8, fs + 6)
        ctx.globalAlpha = focused ? 1 : 0.9
        ctx.fillStyle = LABEL_FG
        ctx.textBaseline = 'top'
        ctx.fillText(text, bx + 4, by + 3)
        ctx.globalAlpha = 1
      }

      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => {
      disposed = true
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      ro.disconnect()
    }
  }, [isActive, fullscreen, graph.nodes, graph.edges, positions, neighborsOf, labelOf])

  // ---- ピッキング（投影座標で最近傍） ----
  const pickAt = (clientX: number, clientY: number): string | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    let best: { ref: string; d: number } | null = null
    for (const p of projected.current) {
      const d = Math.hypot(p.sx - x, p.sy - y)
      const hitR = Math.max(10, 14 * p.scale)
      if (d < hitR && (!best || d < best.d)) best = { ref: p.ref, d }
    }
    return best?.ref ?? null
  }

  // ---- 操作（ドラッグ回転／ホイールズーム／ピンチ） ----
  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1) dragging.current = { x: e.clientX, y: e.clientY }
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values())
      pinch.current = Math.hypot(a.x - b.x, a.y - b.y)
      dragging.current = null
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2 && pinch.current !== null) {
      const [a, b] = Array.from(pointers.current.values())
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      cam.current.zoom = Math.min(2.6, Math.max(0.5, cam.current.zoom * (d / pinch.current)))
      pinch.current = d
      camTarget.current = null
      return
    }

    if (dragging.current) {
      const dx = e.clientX - dragging.current.x
      const dy = e.clientY - dragging.current.y
      dragging.current = { x: e.clientX, y: e.clientY }
      cam.current.rotY += dx * 0.006
      cam.current.rotX = Math.max(-1.2, Math.min(1.2, cam.current.rotX + dy * 0.005))
      camTarget.current = null
      return
    }

    const ref = pickAt(e.clientX, e.clientY)
    if (ref !== hoverRef.current) setHover(ref)
  }

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) dragging.current = null
  }

  const onWheel = (e: React.WheelEvent) => {
    cam.current.zoom = Math.min(2.6, Math.max(0.5, cam.current.zoom * (e.deltaY < 0 ? 1.12 : 0.89)))
    camTarget.current = null
  }

  // クリック＝注目（カメラが回り込む）＋呼び出し側の詳細パネル連動
  const onClick = (e: React.MouseEvent) => {
    const ref = pickAt(e.clientX, e.clientY)
    if (!ref) {
      onSelect(null)
      camTarget.current = null
      return
    }
    if (ref === selected) {
      onSelect(null)
      return
    }
    onSelect(ref)
    const p = positions.get(ref)
    if (p) camTarget.current = { rotY: Math.atan2(p.x, p.z) + Math.PI, rotX: -0.22, zoom: Math.max(1.2, initialZoom * 1.3) }
  }

  const reset = () => {
    cam.current = { rotX: INIT_ROT_X, rotY: INIT_ROT_Y, zoom: initialZoom }
    camTarget.current = null
    onSelect(null)
    setHover(null)
  }

  // 左下の説明バー（ホバー中の要素のつながりを1行で）
  const hoverSummary = useMemo(() => (hover ? summarizeHover(graph, hover) : null), [graph, hover])

  return (
    <div className={fullscreen ? 'flex h-full flex-col' : undefined}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className={`text-[11px] ${fullscreen ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
          ドラッグで回転・ホイールで拡大縮小・クリックで詳細
        </span>
        <div className="grow" />
        <Button type="button" variant="outline" size="sm" className="h-7 text-[12px]" onClick={() => setAutoRotate((v) => !v)}>
          {autoRotate ? <Pause size={13} /> : <Play size={13} />}
          {autoRotate ? '自動回転を止める' : '自動回転'}
        </Button>
        <Button type="button" variant="outline" size="icon" className="size-7" onClick={reset} title="初期表示に戻す">
          <RotateCcw size={13} />
        </Button>
      </div>

      <div
        ref={wrapRef}
        className={`relative border border-border rounded-lg overflow-hidden ${fullscreen ? 'grow bg-[#0b1020]' : 'bg-white'}`}
      >
        <canvas
          ref={canvasRef}
          className="block w-full select-none"
          style={{ touchAction: 'none', cursor: hover ? 'pointer' : 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onPointerLeave={(e) => {
            endPointer(e)
            setHover(null)
          }}
          onWheel={onWheel}
          onClick={onClick}
        />

        {/* ホバー説明バー（左下） */}
        <div className="absolute bottom-2 left-2 right-2 pointer-events-none">
          {hoverSummary ? (
            <p
              className={`m-0 inline-block max-w-full rounded-md border px-2.5 py-1.5 text-[12px] shadow-sm break-words ${
                fullscreen ? 'border-white/15 bg-[#0b1020]/95 text-gray-100' : 'border-border bg-background/95 text-foreground'
              }`}
            >
              <span className="font-bold">{hoverSummary.name}</span>
              <span className="opacity-70">（{hoverSummary.kind}）</span>
              {hoverSummary.parts.length > 0 && (
                <>
                  <span className="opacity-70"> — </span>
                  {hoverSummary.parts.join('・')}
                </>
              )}
            </p>
          ) : (
            <p className={`m-0 text-[11px] ${fullscreen ? 'text-gray-400/80' : 'text-muted-foreground/70'}`}>
              要素にカーソルを合わせるとつながりを表示します
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
