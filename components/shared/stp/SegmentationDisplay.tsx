'use client'

// S - セグメンテーション表示コンポーネント
import { LayoutGrid } from 'lucide-react'

interface Segment {
  name: string
  description: string
  size_hint?: string
  selected?: boolean
}

interface Variable {
  name: string
  reason?: string
  segments: Segment[]
}

export interface SegmentationDisplayProps {
  variables: Variable[]
  className?: string
}

function SegmentBadge({ name, description }: { name: string; description: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
      title={description}
    >
      {name}
    </span>
  )
}

export function SegmentationDisplay({ variables, className }: SegmentationDisplayProps) {
  if (!variables || variables.length === 0) return null

  // selected セグメントがあるか確認
  const hasSelected = variables.some((v) => v.segments.some((s) => s.selected))

  return (
    <div className={className}>
      <div className="mb-4 flex items-center gap-2">
        <LayoutGrid className="h-5 w-5 text-blue-600" />
        <h3 className="text-base font-bold text-gray-900">S - セグメンテーション</h3>
      </div>

      <div className="space-y-4">
        {variables.map((variable, vi) => {
          // selected が使われている場合は selected のみ表示、そうでなければ全表示
          const segments = hasSelected
            ? variable.segments.filter((s) => s.selected)
            : variable.segments
          if (segments.length === 0) return null
          return (
            <div key={vi}>
              <p className="mb-2 text-sm font-bold text-gray-700">{variable.name}</p>
              <div className="flex flex-wrap gap-2">
                {segments.map((seg, si) => (
                  <SegmentBadge key={si} name={seg.name} description={seg.description} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
