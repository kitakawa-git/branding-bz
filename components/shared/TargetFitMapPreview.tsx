// ターゲット適合マップ（サムネイル＋整合ステータス）
// STP分析ツール Step5「確認・出力」のレイアウトを共有化。
import { TargetFitMapStatic } from '@/components/TargetFitMapStatic'
import type { TargetFitMap } from '@/app/tools/stp/app/[sessionId]/page'

export function TargetFitMapPreview({ fitMap }: { fitMap: TargetFitMap }) {
  const st = fitMap.consistency_status
  const conf = st === 'green'
    ? { bar: 'bg-emerald-500', wrap: 'bg-emerald-50 text-emerald-700', text: '✓ ターゲット全員がカバー範囲内' }
    : st === 'yellow'
      ? { bar: 'bg-amber-500', wrap: 'bg-amber-50 text-amber-700', text: '⚠ 一部がカバー範囲の端' }
      : { bar: 'bg-red-500', wrap: 'bg-red-50 text-red-700', text: '✗ カバー範囲外のターゲットあり' }

  return (
    <div className="mt-8">
      <h2 className="mb-3 text-sm font-bold text-gray-900">ターゲット適合マップ</h2>
      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <TargetFitMapStatic fitMap={fitMap} />
        <div className="mt-2">
          <div className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-[11px] font-medium ${conf.wrap}`}>
            <span className={`inline-block h-2 w-2 rounded-full ${conf.bar}`} />{conf.text}
          </div>
        </div>
      </div>
    </div>
  )
}
