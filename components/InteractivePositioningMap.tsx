'use client'

// ポジショニングの散布図（ドラッグ操作型）。PC/iPad/iPhone を Pointer Events で統一。
// 表示専用の PositioningMap とは別物（こちらは Step4 の編集用）。
import { useCallback, useRef } from 'react'

interface InteractiveItem {
  name: string
  x: number // 0-100
  y: number // 0-100
  color: string
  is_self?: boolean
}

interface AxisConfig {
  x_axis: { left: string; right: string }
  y_axis: { bottom: string; top: string }
}

interface Props {
  items: InteractiveItem[]
  axes: AxisConfig
  selectedIdx: number | null
  onItemMove: (idx: number, x: number, y: number) => void // 0-100 値
  onItemSelect: (idx: number) => void
  className?: string
}

// 表示用 PositioningMap と完全に同寸（4:3・700×525・PAD）。見た目を一致させるため。
// 軸ラベルを全てプロット内側に置くため余白を最小化し、描画域いっぱいにプロットを拡大（旧 PAD=50→28）。
const WIDTH = 700
const HEIGHT = 525
const PAD = 16
const MAP_W = WIDTH - PAD * 2
const MAP_H = HEIGHT - PAD * 2
// SIZE: 自社 lg=7 / 競合 md=6（PositioningMap と一致）
const SELF_R = 7
const OTHER_R = 6

export function InteractivePositioningMap({
  items, axes, selectedIdx, onItemMove, onItemSelect, className,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const draggingIdxRef = useRef<number | null>(null)

  const toSvgX = (x: number) => PAD + (x / 100) * MAP_W
  const toSvgY = (y: number) => PAD + ((100 - y) / 100) * MAP_H
  const centerX = PAD + MAP_W / 2
  const centerY = PAD + MAP_H / 2

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGCircleElement>, idx: number) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingIdxRef.current = idx
    onItemSelect(idx)
  }, [onItemSelect])

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGCircleElement>) => {
    const idx = draggingIdxRef.current
    if (idx === null || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    // viewBox スケールを考慮して SVG 座標へ変換
    const scaleX = WIDTH / rect.width
    const scaleY = HEIGHT / rect.height
    const svgX = (e.clientX - rect.left) * scaleX
    const svgY = (e.clientY - rect.top) * scaleY
    // チャート領域内に収める
    const clampedSvgX = Math.max(PAD, Math.min(PAD + MAP_W, svgX))
    const clampedSvgY = Math.max(PAD, Math.min(PAD + MAP_H, svgY))
    const x = ((clampedSvgX - PAD) / MAP_W) * 100
    const y = 100 - ((clampedSvgY - PAD) / MAP_H) * 100
    onItemMove(idx, Math.round(x), Math.round(y))
  }, [onItemMove])

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGCircleElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    draggingIdxRef.current = null
  }, [])

  return (
    <div className={className}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        className="select-none rounded-lg"
        style={{
          aspectRatio: '4 / 3',
          touchAction: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
      >
        {/* XY軸（PositioningMap と一致） */}
        <line x1={centerX} y1={PAD} x2={centerX} y2={PAD + MAP_H} stroke="#d1d5db" strokeWidth={1} />
        <line x1={PAD} y1={centerY} x2={PAD + MAP_W} y2={centerY} stroke="#d1d5db" strokeWidth={1} />

        {/* 目盛り（PositioningMap と一致） */}
        {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100].map((val) => {
          const t = val % 10 === 0 ? 6 : 2
          return (
            <g key={`tick-${val}`}>
              <line x1={toSvgX(val)} y1={centerY - t} x2={toSvgX(val)} y2={centerY + t} stroke="#d1d5db" strokeWidth={1} />
              <line x1={centerX - t} y1={toSvgY(val)} x2={centerX + t} y2={toSvgY(val)} stroke="#d1d5db" strokeWidth={1} />
            </g>
          )
        })}

        {/* 軸ラベル（PositioningMap と同位置・同色）。X軸の左右はプロット端の内側・軸線の少し上
            （余白外＝viewBox境界で半分クリップされる問題の解消） */}
        {axes.x_axis.left && (
          <text x={PAD + 4} y={centerY - 8} textAnchor="start" fontSize="12" fill="#9ca3af">{axes.x_axis.left}</text>
        )}
        {axes.x_axis.right && (
          <text x={PAD + MAP_W - 4} y={centerY - 8} textAnchor="end" fontSize="12" fill="#9ca3af">{axes.x_axis.right}</text>
        )}
        {axes.y_axis.top && (
          <text x={centerX + 8} y={PAD + 14} textAnchor="start" fontSize="12" fill="#9ca3af">{axes.y_axis.top}</text>
        )}
        {axes.y_axis.bottom && (
          <text x={centerX + 8} y={PAD + MAP_H - 14} textAnchor="start" fontSize="12" fill="#9ca3af">{axes.y_axis.bottom}</text>
        )}

        {/* 要素（PositioningMap と同じ描画：自社=r7+ハロー+右ボールド／競合=r6+下中央）。ドラッグ操作は維持。 */}
        {items.map((item, idx) => {
          const cx = toSvgX(item.x)
          const cy = toSvgY(item.y)
          const isSelf = !!item.is_self
          const isSelected = selectedIdx === idx
          const r = isSelf ? SELF_R : OTHER_R
          return (
            <g key={idx}>
              {/* 自社は常に、編集中(選択)の要素も同色ハローで強調（PositioningMapの自社ハローと同方式） */}
              {(isSelf || isSelected) && (
                <circle cx={cx} cy={cy} r={r + 11} fill={item.color} opacity={0.15} pointerEvents="none" />
              )}
              {/* 透明ヒット領域（タップ精度確保・半径22px） */}
              <circle
                cx={cx} cy={cy} r={22}
                fill="transparent"
                style={{ cursor: 'grab', touchAction: 'none' }}
                onPointerDown={(e) => handlePointerDown(e, idx)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              />
              {/* 見える点（PositioningMap と同じ：opacity0.85・白縁2px） */}
              <circle cx={cx} cy={cy} r={r} fill={item.color} opacity={0.85} stroke="#fff" strokeWidth={2} pointerEvents="none" />
              {/* 名前ラベル：自社は点の右にボールド、競合は点の下に中央（PositioningMap と一致） */}
              {isSelf ? (
                <text x={cx + 10} y={cy + 5} textAnchor="start" fontSize="14" fill="#0f172a" fontWeight={700} pointerEvents="none">
                  {item.name}
                </text>
              ) : (
                <text x={cx} y={cy + r + 10} textAnchor="middle" fontSize="11" fill="#374151" fontWeight={500} pointerEvents="none">
                  {item.name}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
