'use client'

import type { PositioningMapData, PositioningMapSize } from '@/lib/types/positioning-map'

const SIZE_RADIUS: Record<PositioningMapSize, number> = {
  sm: 5,
  md: 8,
  lg: 11, // 自社ドット。Step4 編集マップの自社点(r11)に合わせる
  custom: 8,
}

type PositioningMapProps = {
  data: PositioningMapData
  className?: string
}

export function PositioningMap({ data, className }: PositioningMapProps) {
  // 軸ラベルを全てプロット内側に置くため余白を最小化し、描画域いっぱいにプロットを拡大（旧 PAD=50→28）
  const PAD = 16
  const WIDTH = 700
  const HEIGHT = 525
  const MAP_W = WIDTH - PAD * 2
  const MAP_H = HEIGHT - PAD * 2

  const toSvgX = (x: number) => PAD + (x / 100) * MAP_W
  const toSvgY = (y: number) => PAD + ((100 - y) / 100) * MAP_H

  const centerX = PAD + MAP_W / 2
  const centerY = PAD + MAP_H / 2

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        className="rounded-lg"
        style={{ aspectRatio: '4 / 3' }}
      >
        {/* XY軸 */}
        <line
          x1={centerX} y1={PAD}
          x2={centerX} y2={PAD + MAP_H}
          stroke="#d1d5db"
          strokeWidth={1}
        />
        <line
          x1={PAD} y1={centerY}
          x2={PAD + MAP_W} y2={centerY}
          stroke="#d1d5db"
          strokeWidth={1}
        />

        {/* 目盛り */}
        {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100].map((val) => {
          const t = val % 10 === 0 ? 6 : 2
          return (
            <g key={`tick-${val}`}>
              <line x1={toSvgX(val)} y1={centerY - t} x2={toSvgX(val)} y2={centerY + t} stroke="#d1d5db" strokeWidth={1} />
              <line x1={centerX - t} y1={toSvgY(val)} x2={centerX + t} y2={toSvgY(val)} stroke="#d1d5db" strokeWidth={1} />
            </g>
          )
        })}

        {/* 軸ラベル。X軸の左右ラベルはプロット端の内側・軸線の少し上に置く
            （余白外＝viewBox境界で半分クリップされる問題の解消） */}
        {data.x_axis.left && (
          <text
            x={PAD + 4}
            y={centerY - 8}
            textAnchor="start"
            fontSize="12"
            fill="#9ca3af"
          >
            {data.x_axis.left}
          </text>
        )}
        {data.x_axis.right && (
          <text
            x={PAD + MAP_W - 4}
            y={centerY - 8}
            textAnchor="end"
            fontSize="12"
            fill="#9ca3af"
          >
            {data.x_axis.right}
          </text>
        )}
        {data.y_axis.top && (
          <text
            x={centerX + 8}
            y={PAD + 14}
            textAnchor="start"
            fontSize="12"
            fill="#9ca3af"
          >
            {data.y_axis.top}
          </text>
        )}
        {data.y_axis.bottom && (
          <text
            x={centerX + 8}
            y={PAD + MAP_H - 14}
            textAnchor="start"
            fontSize="12"
            fill="#9ca3af"
          >
            {data.y_axis.bottom}
          </text>
        )}

        {/* アイテム（ドット＋名前） */}
        {data.items.map((item, i) => {
          const cx = toSvgX(item.x)
          const cy = toSvgY(item.y)
          // 自社は size='lg'（STP連携で is_self→lg）。Step4 編集マップの自社ドットに装飾を合わせる：
          // 小さめの点(r7)＋薄い同色ハロー(r18)＋ラベルは点の右にボールド。競合は従来どおり点の下。
          const isSelf = item.size === 'lg'
          const r = item.size === 'custom' && item.customSize ? item.customSize : SIZE_RADIUS[item.size || 'md']
          return (
            <g key={i} className="cursor-pointer">
              <title>{`${item.name} (X: ${item.x}, Y: ${item.y})`}</title>
              {isSelf && (
                <circle cx={cx} cy={cy} r={r + 14} fill={item.color} opacity={0.20} />
              )}
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={item.color}
                opacity={0.85}
                stroke="white"
                strokeWidth={2}
              />
              {isSelf && r >= 9 && (
                <text x={cx} y={cy + 3} textAnchor="middle" fontSize="9" fill="#fff" fontWeight="700">
                  自社
                </text>
              )}
              {isSelf ? (
                <text
                  x={cx + 16}
                  y={cy + 5}
                  textAnchor="start"
                  fontSize="14"
                  fill="#0f172a"
                  fontWeight="700"
                >
                  {item.name}
                </text>
              ) : (
                <text
                  x={cx}
                  y={cy + r + 12}
                  textAnchor="middle"
                  fontSize="11"
                  fill={item.color}
                  fontWeight="600"
                >
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
