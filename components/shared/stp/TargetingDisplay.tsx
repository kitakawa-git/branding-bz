'use client'

// T - ターゲティング表示コンポーネント
import { Target } from 'lucide-react'

interface Evaluation {
  segment_name: string
  attractiveness: number
  competitiveness: number
  priority: string
}

export interface TargetingDisplayProps {
  mainTarget: string
  targetDescription?: string
  evaluations?: Evaluation[]
  subTargets?: string[]
  className?: string
}

function Stars({ count }: { count: number }) {
  return (
    <span className="text-xs">
      {'★'.repeat(count)}
      <span className="text-gray-300">{'★'.repeat(5 - count)}</span>
    </span>
  )
}

export function TargetingDisplay({
  mainTarget,
  targetDescription,
  evaluations = [],
  subTargets = [],
  className,
}: TargetingDisplayProps) {
  if (!mainTarget) return null

  const mainEval = evaluations.find((e) => e.segment_name === mainTarget)
  const subEvals = subTargets.map((name) => ({
    name,
    eval: evaluations.find((e) => e.segment_name === name),
  }))

  return (
    <div className={className}>
      <div className="mb-4 flex items-center gap-2">
        <Target className="h-5 w-5 text-blue-600" />
        <h3 className="text-base font-bold text-gray-900">T - ターゲティング</h3>
      </div>

      {/* メインターゲット */}
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="mb-1 text-xs font-bold text-blue-600">メインターゲット</p>
        <p className="text-sm font-bold text-gray-900">{mainTarget}</p>
        {targetDescription && (
          <p className="mt-1 text-sm text-gray-600 leading-relaxed">{targetDescription}</p>
        )}
        {mainEval && (
          <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
            <span>
              市場の魅力度: <Stars count={mainEval.attractiveness} />
            </span>
            <span>
              自社の競争力: <Stars count={mainEval.competitiveness} />
            </span>
          </div>
        )}
      </div>

      {/* サブターゲット */}
      {subEvals.length > 0 ? (
        <div className="space-y-2">
          {subEvals.map((sub, i) => (
            <div key={i} className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="mb-0.5 text-xs font-bold text-gray-500">サブターゲット {i + 1}</p>
              <p className="text-sm font-bold text-gray-700">{sub.name}</p>
              {sub.eval && (
                <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                  <span>
                    魅力度: <Stars count={sub.eval.attractiveness} />
                  </span>
                  <span>
                    競争力: <Stars count={sub.eval.competitiveness} />
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-sm text-gray-400">サブターゲット: なし</p>
        </div>
      )}
    </div>
  )
}
