'use client'

// P - ポジショニング表示コンポーネント
import { MapPin } from 'lucide-react'
import { PositioningMap } from '@/components/PositioningMap'
import type { PositioningMapData } from '@/lib/types/positioning-map'

export interface PositioningDisplayProps {
  data: PositioningMapData
  className?: string
}

export function PositioningDisplay({ data, className }: PositioningDisplayProps) {
  if (!data || !data.items || data.items.length === 0) return null

  return (
    <div className={className}>
      <div className="mb-4 flex items-center gap-2">
        <MapPin className="h-5 w-5 text-blue-600" />
        <h3 className="text-base font-bold text-gray-900">P - ポジショニング</h3>
      </div>

      {/* マップ */}
      <div className="rounded-lg border bg-white p-3">
        <PositioningMap data={data} />
      </div>

      {/* 凡例 */}
      <div className="mt-3 flex flex-wrap gap-3">
        {data.items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-gray-700">
              {item.name}
              {item.size === 'lg' && (
                <span className="ml-1 text-blue-600">（自社）</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
