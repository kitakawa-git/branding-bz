// §8 / §10 提供価値の状態パネル（昇格レビュー導線）
import { Button } from '@/components/ui/button'
import { ArrowUpCircle } from 'lucide-react'
import { SELECT_CLASS, VP_STATES, vpStateLabel, type VpRow } from './shared'

export default function ValuePropositionPanel({
  vps,
  vpBusyId,
  changeVpState,
}: {
  vps: VpRow[]
  vpBusyId: string | null
  changeVpState: (vp: VpRow, next: string) => void
}) {
  if (vps.length === 0) return null
  return (
    <div className="border border-border rounded-xl p-3 mb-3 bg-background">
      <p className="text-[13px] font-bold text-foreground m-0 mb-2">提供価値の状態</p>
      <p className="text-[11px] text-muted-foreground m-0 mb-2">
        「目標」は未来の約束。裏づけがそろったら「現在の約束」へ昇格します（昇格者と日時が残ります）
      </p>
      {vps.map((vp) => (
        <div key={vp.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-border pt-2 mt-2 first:border-0 first:pt-0 first:mt-0">
          <div className="min-w-0">
            <p className="text-[13px] text-foreground m-0 break-words">{vp.title || '（無題）'}</p>
            <p className="text-[11px] text-muted-foreground m-0">
              現在: {vpStateLabel(vp.lifecycle_state)}
              {vp.promoted_at && ` ／ 昇格 ${vp.promoted_at.slice(0, 10)}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select
              className={`${SELECT_CLASS} w-auto`}
              value={vp.lifecycle_state ?? 'current'}
              disabled={vpBusyId === vp.id}
              onChange={(e) => changeVpState(vp, e.target.value)}
            >
              {VP_STATES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            {(vp.lifecycle_state === 'target' || vp.lifecycle_state === 'transition_candidate') && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => changeVpState(vp, 'current')}
                disabled={vpBusyId === vp.id}
                className="text-[13px] whitespace-nowrap"
              >
                <ArrowUpCircle size={14} />
                現在へ昇格
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
