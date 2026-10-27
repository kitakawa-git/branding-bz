// 獲得目標の実証進捗パネル（全体＋ビジョン単位）と進捗バー
import type { VisionProgressDto } from '@/app/api/superadmin/desired-evidence/evaluations/route'
import { pct, type ProgressSummary } from './shared'

// 進捗バー（progress_fraction が null のときは描かない）
export function ProgressBar({ fraction }: { fraction: number | null }) {
  const p = pct(fraction)
  if (p == null) return null
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="h-1.5 flex-1 rounded-full bg-gray-200 overflow-hidden">
        <div className="h-full rounded-full bg-ds-app-accent-soft" style={{ width: `${Math.min(100, Math.max(0, p))}%` }} />
      </div>
      <span className="text-[11px] text-muted-foreground shrink-0">{p}%</span>
    </div>
  )
}

// §7 実証進捗は「判定可能率」と必ずセットで出す
function ProgressLine({ label, v }: { label: string; v: ProgressSummary }) {
  const p = pct(v.progress_fraction)
  const cov = Math.round(v.coverage_weight * 100)
  return (
    <div className="mb-2 last:mb-0">
      <p className="text-[13px] text-foreground m-0 break-words">
        <span className="font-bold">{label}</span>：実証進捗{' '}
        {p == null ? '—' : `${p}%`}
        <span className="text-muted-foreground">
          （判定可能 重み {cov}%・件数 {v.coverage_count.evaluable}/{v.coverage_count.total}）
        </span>
      </p>
      <ProgressBar fraction={v.progress_fraction} />
    </div>
  )
}

export default function ProgressPanel({
  evalError,
  overall,
  visionProgress,
  loading,
}: {
  evalError: string | null
  overall: ProgressSummary | null
  visionProgress: VisionProgressDto[]
  loading: boolean
}) {
  if (evalError) {
    return (
      <div className="border border-amber-200 bg-amber-50/60 rounded-xl p-3 mb-3">
        <p className="text-[13px] text-amber-900 m-0">判定・進捗を取得できませんでした（{evalError}）。登録・編集は通常どおり行えます。</p>
      </div>
    )
  }
  // §14.6 分母0＝獲得目標が未設定
  if (!overall || overall.coverage_count.total === 0) {
    if (loading) return null
    return (
      <div className="border border-border rounded-xl p-3 mb-3 bg-background">
        <p className="text-[13px] text-muted-foreground m-0">実証進捗：獲得目標が未設定です</p>
      </div>
    )
  }
  return (
    <div className="border border-border rounded-xl p-3 mb-3 bg-background">
      <ProgressLine label="全体" v={overall} />
      {visionProgress.map((v) => (
        <div key={v.vision_id}>
          <ProgressLine label={v.vision_label} v={v} />
        </div>
      ))}
      {visionProgress.length === 0 && (
        <p className="text-[11px] text-muted-foreground m-0 mt-1">
          ビジョンから「必要とする」を張ると、ビジョン単位の進捗も出ます
        </p>
      )}
    </div>
  )
}
