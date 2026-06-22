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

const WIDTH = 700
const HEIGHT = 525
const PAD = 50
const MAP_W = WIDTH - PAD * 2
const MAP_H = HEIGHT - PAD * 2

export function InteractivePositioningMap({
  items, axes, selectedIdx, onItemMove, onItemSelect, className,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const draggingIdxRef = useRef<number | null>(null)

  const toSvgX = (x: number) => PAD + (x / 100) * MAP_W
  const toSvgY = (y: number) => PAD + ((100 - y) / 100) * MAP_H

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
        {/* 象限の薄い背景 */}
        <rect x={PAD} y={PAD} width={MAP_W} height={MAP_H} fill="#f8fafc" stroke="#e5e7eb" strokeWidth={1} rx={6} />
        {/* 中央の十字軸 */}
        <line x1={PAD + MAP_W / 2} y1={PAD} x2={PAD + MAP_W / 2} y2={PAD + MAP_H} stroke="#d1d5db" strokeWidth={1} />
        <line x1={PAD} y1={PAD + MAP_H / 2} x2={PAD + MAP_W} y2={PAD + MAP_H / 2} stroke="#d1d5db" strokeWidth={1} />

        {/* 軸ラベル */}
        <text x={PAD + MAP_W / 2} y={PAD - 20} textAnchor="middle" fontSize="12" fill="#64748b">{axes.y_axis.top}</text>
        <text x={PAD + MAP_W / 2} y={PAD + MAP_H + 32} textAnchor="middle" fontSize="12" fill="#64748b">{axes.y_axis.bottom}</text>
        <text x={PAD - 14} y={PAD + MAP_H / 2 + 4} textAnchor="end" fontSize="12" fill="#64748b">{axes.x_axis.left}</text>
        <text x={PAD + MAP_W + 14} y={PAD + MAP_H / 2 + 4} fontSize="12" fill="#64748b">{axes.x_axis.right}</text>

        {/* 要素 */}
        {items.map((item, idx) => {
          const cx = toSvgX(item.x)
          const cy = toSvgY(item.y)
          const isSelected = selectedIdx === idx
          return (
            <g key={idx}>
              {isSelected && (
                <circle cx={cx} cy={cy} r={18} fill={item.color} opacity={0.15} pointerEvents="none" />
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
              {/* 見える点 */}
              <circle cx={cx} cy={cy} r={isSelected ? 7 : 5} fill={item.color} stroke="#fff" strokeWidth={2} pointerEvents="none" />
              {/* 名前ラベル */}
              <text x={cx + 10} y={cy + 4} fontSize="12" fill="#0f172a" fontWeight={isSelected ? 700 : 400} pointerEvents="none">
                {item.name}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
