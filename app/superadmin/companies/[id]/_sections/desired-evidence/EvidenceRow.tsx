// 獲得目標1件の表示カード（バッジ・本文・判定・並び替え/編集/削除ボタン。下部に人間判断パネルを children で受ける）
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2, Pencil, ChevronUp, ChevronDown } from 'lucide-react'
import type { DesiredEvidenceEvaluationDto } from '@/app/api/superadmin/desired-evidence/evaluations/route'
import { DesiredEvidence, ruleSummary } from '../desired-evidence-rules'
import { STATE_META, execLabel, reasonText } from './shared'
import { ProgressBar } from './ProgressPanel'

export default function EvidenceRow({
  row,
  index,
  rowCount,
  ev,
  onMove,
  onEdit,
  onRemove,
  children,
}: {
  row: DesiredEvidence
  index: number
  rowCount: number
  ev: DesiredEvidenceEvaluationDto | undefined
  onMove: (index: number, dir: -1 | 1) => void
  onEdit: (row: DesiredEvidence) => void
  onRemove: (id: string) => void
  children: ReactNode
}) {
  return (
    <div className="border border-border rounded-xl p-4 mb-3 bg-background">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="py-0.5 px-2 bg-violet-100 text-violet-800 rounded text-xs font-semibold">
              {execLabel(row.execution_state)}
            </span>
            <span className="py-0.5 px-2 bg-gray-100 text-gray-600 rounded text-xs font-semibold">
              重要度 {row.importance_weight}
            </span>
            {ev && (
              <span
                className={`py-0.5 px-2 rounded text-xs font-semibold ${
                  STATE_META[ev.evaluation.state]?.cls ?? 'bg-gray-100 text-gray-700'
                }`}
              >
                {STATE_META[ev.evaluation.state]?.label ?? ev.evaluation.state}
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-foreground break-words">{row.title}</p>
          {row.description && (
            <p className="text-[13px] text-muted-foreground mt-1 whitespace-pre-line break-words">
              {row.description}
            </p>
          )}
          <p className="text-[13px] text-muted-foreground mt-1 break-words">
            達成条件: {ruleSummary(row.achievement_rule)}
          </p>
          {ev && (
            <>
              <ProgressBar fraction={ev.evaluation.progress_fraction} />
              <p className="text-[13px] text-muted-foreground mt-1 break-words">
                {reasonText(ev.evaluation)}
                {ev.evaluation.source === 'manual' && '（人の判断）'}
              </p>
            </>
          )}
          {row.verification_method && (
            <p className="text-[13px] text-muted-foreground mt-0.5 break-words">
              立証方法: {row.verification_method}
            </p>
          )}
          {row.milestone_note && (
            <p className="text-[13px] text-muted-foreground mt-0.5 whitespace-pre-line break-words">
              {row.milestone_note}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button type="button" variant="outline" size="icon" onClick={() => onMove(index, -1)} disabled={index === 0} className="size-8">
            <ChevronUp size={14} />
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={() => onMove(index, 1)} disabled={index === rowCount - 1} className="size-8">
            <ChevronDown size={14} />
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={() => onEdit(row)} className="size-8">
            <Pencil size={14} />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onRemove(row.id)}
            className="size-8 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
      {children}
    </div>
  )
}
