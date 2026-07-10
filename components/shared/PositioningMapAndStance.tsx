// ポジショニングマップ＋自社の立ち位置（STP Step5「確認・出力」のレイアウトを共有化）
// STP Step5・社員ポータル(/portal/strategy) から共通で利用する。
import { Badge } from '@/components/ui/badge'
import { PositioningMap } from '@/components/PositioningMap'
import type { PositioningMapData } from '@/lib/types/positioning-map'
import type { BrandStanceStatement } from '@/app/tools/stp/app/[sessionId]/page'

interface PositioningMapAndStanceProps {
  positioningMapData: PositioningMapData
  brandStance: BrandStanceStatement[]
  // 指定時のみ、立ち位置0件でもメッセージを表示する（STPツール文脈用）。未指定時は0件なら立ち位置ブロックごと省略。
  emptyStanceMessage?: string
}

export function PositioningMapAndStance({ positioningMapData, brandStance, emptyStanceMessage }: PositioningMapAndStanceProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
      {/* 自社の立ち位置（ターゲット別×N） */}
      {(brandStance.length > 0 || emptyStanceMessage) && (
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-gray-900">ポジショニング</p>
          </div>
          {brandStance.length === 0 ? (
            <p className="text-xs text-muted-foreground">{emptyStanceMessage}</p>
          ) : (
            <div className="mt-3 space-y-3.5">
              {brandStance.map((s, i) => {
                const isMain = s.target_role === 'main'
                return (
                  <div
                    key={i}
                    className={`relative rounded-lg p-4 ${
                      isMain
                        ? 'border border-ds-app-accent-soft bg-blue-50/50'
                        : 'border border-blue-300 bg-blue-50/30'
                    }`}
                  >
                    {isMain ? (
                      <Badge className="absolute -top-[9px] left-[6px] rounded-full px-1.5 py-0 !text-[10px] !leading-[16px] bg-ds-app-accent text-white hover:bg-ds-app-accent-hover">メインターゲット</Badge>
                    ) : (
                      <Badge variant="outline" className="absolute -top-[9px] left-[6px] rounded-full px-1.5 py-0 !text-[10px] !leading-[16px] border-blue-300 bg-white text-blue-300">サブターゲット</Badge>
                    )}
                    <p className={`text-lg font-bold ${isMain ? 'text-gray-900' : 'text-gray-700'}`}>{s.target_name}</p>
                    <p className="mt-1 text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">{s.statement}</p>
                    {s.rationale && (
                      <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">なぜなら: {s.rationale}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <h2 className="mb-3 text-sm font-bold text-gray-900">ポジショニングマップ</h2>
      {/* マップ */}
      <div className="rounded-lg border bg-white p-3">
        <PositioningMap data={positioningMapData} />
      </div>
    </div>
  )
}
