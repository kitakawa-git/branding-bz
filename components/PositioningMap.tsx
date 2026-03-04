'use client'

import type { PositioningMapData, PositioningMapSize } from '@/lib/types/positioning-map'

const SIZE_RADIUS: Record<PositioningMapSize, number> = {
  sm: 4,
  md: 6,
  lg: 10,
  custom: 6,
}

type PositioningMapProps = {
  data: PositioningMapData
  className?: string
}

export function PositioningMap({ data, className }: PositioningMapProps) {
  const PAD = 50
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

        {/* 軸ラベル */}
        {data.x_axis.left && (
          <text
            x={PAD - 8}
            y={centerY}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize="12"
            fill="#6b7280"
          >
            {data.x_axis.left}
          </text>
        )}
        {data.x_axis.right && (
          <text
            x={PAD + MAP_W + 8}
            y={centerY}
            textAnchor="start"
            dominantBaseline="middle"
            fontSize="12"
            fill="#6b7280"
          >
            {data.x_axis.right}
          </text>
        )}
        {data.y_axis.top && (
          <text
            x={centerX}
            y={PAD - 14}
            textAnchor="middle"
            fontSize="12"
            fill="#6b7280"
          >
            {data.y_axis.top}
          </text>
        )}
        {data.y_axis.bottom && (
          <text
            x={centerX}
            y={PAD + MAP_H + 22}
            textAnchor="middle"
            fontSize="12"
            fill="#6b7280"
          >
            {data.y_axis.bottom}
          </text>
        )}

        {/* アイテム（ドット＋名前） */}
        {data.items.map((item, i) => {
          const cx = toSvgX(item.x)
          const cy = toSvgY(item.y)
          const r = item.size === 'custom' && item.customSize ? item.customSize : SIZE_RADIUS[item.size || 'md']
          return (
            <g key={i} className="cursor-pointer">
              <title>{`${item.name} (X: ${item.x}, Y: ${item.y})`}</title>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={item.color}
                opacity={0.85}
                stroke="white"
                strokeWidth={2}
              />
              <text
                x={cx}
                y={cy + r + 10}
                textAnchor="middle"
                fontSize="11"
                fill="#374151"
                fontWeight="500"
              >
                {item.name}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
