// §6 / §11 人間判断パネル（現行判断の表示＋記録フォーム＋自動評価へ戻す）
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { Check, X, Gavel } from 'lucide-react'
import type { AchievementRuleV1 } from '@/lib/brand/future-design/types'
import type { DesiredEvidenceEvaluationDto } from '@/app/api/superadmin/desired-evidence/evaluations/route'
import type { DesiredEvidence } from '../desired-evidence-rules'
import { JUDGMENT_STATES, SELECT_CLASS, type JudgmentDraft } from './shared'

export default function JudgmentPanel({
  row,
  ev,
  open,
  jDraft,
  setJDraft,
  jSaving,
  onOpen,
  onSave,
  onClear,
  onCancel,
}: {
  row: DesiredEvidence
  ev: DesiredEvidenceEvaluationDto | undefined
  open: boolean
  jDraft: JudgmentDraft
  setJDraft: (d: JudgmentDraft) => void
  jSaving: boolean
  onOpen: (row: DesiredEvidence) => void
  onSave: (row: DesiredEvidence) => void
  onClear: (row: DesiredEvidence) => void
  onCancel: () => void
}) {
  const r = row.achievement_rule as AchievementRuleV1 | null
  const isManualRule = !!r && typeof r === 'object' && 'type' in r && r.type === 'manual'
  const sourceLabel = isManualRule ? '手動判定（manual_review）' : '自動評価の上書き（automatic_override）'
  const expired = !!ev?.hasCurrentHumanJudgment && !ev.humanJudgmentValid

  return (
    <div className="mt-3 border-t border-border pt-3">
      {ev?.hasCurrentHumanJudgment && (
        <div className={`rounded-md p-2.5 mb-2 ${expired ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50 border border-border'}`}>
          <p className="text-[13px] text-foreground m-0 break-words">
            <span className="font-bold">人間判断</span>：
            {JUDGMENT_STATES.find((s) => s.value === ev.judgmentState)?.label ?? ev.judgmentState}
            {ev.judgmentProgress != null && ` ／ 進捗 ${Math.round(ev.judgmentProgress * 100)}%`}
            {ev.judgmentSource === 'manual_review' ? '（手動判定）' : '（自動評価の上書き）'}
          </p>
          {ev.judgmentReason && (
            <p className="text-[13px] text-muted-foreground m-0 mt-0.5 whitespace-pre-line break-words">理由: {ev.judgmentReason}</p>
          )}
          {expired && (
            <p className="text-[13px] text-amber-900 m-0 mt-1 break-words">
              ⚠ ルール／データの変更で失効中＝いまは自動評価を使用しています。内容を確認して記録し直してください。
            </p>
          )}
        </div>
      )}

      {open ? (
        <div className="border border-violet-200 bg-violet-50/40 rounded-xl p-3 space-y-3">
          <p className="text-[11px] text-muted-foreground m-0">記録の種類：{sourceLabel}（達成条件のタイプから自動で決まります）</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs font-bold text-foreground mb-1.5 block">判断する状態</label>
              <select
                className={SELECT_CLASS}
                value={jDraft.achievementState}
                onChange={(e) => setJDraft({ ...jDraft, achievementState: e.target.value as JudgmentDraft['achievementState'] })}
              >
                {JUDGMENT_STATES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-foreground mb-1.5 block">進捗率（任意・0〜1）</label>
              <Input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={jDraft.progress}
                onChange={(e) => setJDraft({ ...jDraft, progress: e.target.value })}
                placeholder="未指定でも可"
                className="h-10"
              />
              <p className="text-[11px] text-muted-foreground mt-1 m-0">達成=1／未達=0／一部達成=0より大きく1未満</p>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-foreground mb-1.5 block">
              判断の理由 <span className="text-red-500">*</span>
            </label>
            <AutoResizeTextarea
              value={jDraft.reason}
              onChange={(e) => setJDraft({ ...jDraft, reason: e.target.value })}
              placeholder="なぜそう判断したか（後から見て根拠がわかるように）"
              className="min-h-[60px]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => onSave(row)} disabled={jSaving}>
              <Check size={14} />
              {jSaving ? '記録中...' : '記録する'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => onCancel()} disabled={jSaving}>
              <X size={14} />
              キャンセル
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpen(row)} className="text-[13px]">
            <Gavel size={14} />
            {ev?.hasCurrentHumanJudgment ? (expired ? '再確認して記録し直す' : '人間判断を編集') : '人間判断を記録'}
          </Button>
          {ev?.hasCurrentHumanJudgment && (
            <Button type="button" variant="outline" size="sm" onClick={() => onClear(row)} disabled={jSaving} className="text-[13px]">
              自動評価に戻す
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
