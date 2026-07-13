// メインターゲットの深掘り情報（購買決定要因・自社の強み・競合分析）
// STP分析ツール Step5「確認・出力」のレイアウトを共有化。TargetSegmentCards の mainExtra に渡して使う。
import { FieldSubLabel } from '@/components/shared/FieldHeading'

interface TargetDeepDiveProps {
  buyingFactors?: string[]
  strengths?: string
  competitorsAnalysis?: Array<{ name: string; traits?: string; color?: string }>
  // false時は上の要素との区切り線を出さない（メインターゲットカードの外＝単独表示時用）
  bordered?: boolean
}

export function TargetDeepDive({ buyingFactors, strengths, competitorsAnalysis, bordered = true }: TargetDeepDiveProps) {
  const hasContent = !!buyingFactors?.length || !!strengths || !!competitorsAnalysis?.length
  if (!hasContent) return null

  return (
    <div className={`space-y-3 ${bordered ? 'mt-3 border-t border-blue-200 pt-4' : ''}`}>
      {!!buyingFactors?.length && (
        <div>
          <FieldSubLabel>購買決定要因</FieldSubLabel>
          <div className="flex flex-wrap gap-1.5">
            {buyingFactors.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-base font-medium text-ds-app-accent-hover">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}
      {!!strengths && (
        <div>
          <FieldSubLabel>自社の強み</FieldSubLabel>
          <p className="text-base leading-relaxed text-gray-700 whitespace-pre-wrap">{strengths}</p>
        </div>
      )}
      {!!competitorsAnalysis?.length && (
        <div>
          <FieldSubLabel>競合分析</FieldSubLabel>
          <div className="space-y-2">
            {competitorsAnalysis.map((c, i) => (
              <div key={i} className="rounded-md border border-gray-200 bg-white px-3 py-2.5">
                <p
                  className="flex items-center gap-1.5 text-xs font-bold"
                  style={c.color ? { color: c.color } : undefined}
                >
                  {c.color && (
                    <span
                      className="inline-block h-[18px] w-[18px] shrink-0 rounded-full border-2 border-white ring-[0.5px] ring-black/5"
                      style={{ backgroundColor: c.color, opacity: 0.85 }}
                      aria-hidden
                    />
                  )}
                  {c.name}
                </p>
                {c.traits && <p className="mt-1 text-xs text-gray-600 leading-relaxed">{c.traits}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
