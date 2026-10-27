// 獲得目標の追加・編集フォーム（タイトル〜メモ＋達成条件エディタ＋保存/キャンセル）
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { Check, X } from 'lucide-react'
import { ExecutionState, Draft } from '../desired-evidence-rules'
import { EXECUTION_STATES, SELECT_CLASS } from './shared'
import RuleEditor from './RuleEditor'

export default function EvidenceForm({
  companyId,
  draft,
  setDraft,
  saving,
  onSave,
  onCancel,
}: {
  companyId: string
  draft: Draft
  setDraft: (d: Draft) => void
  saving: boolean
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 mb-3 space-y-4">
      <div>
        <label className="text-xs font-bold text-foreground mb-1.5 block">
          タイトル <span className="text-red-500">*</span>
        </label>
        <Input
          type="text"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="例: 導入事例を3件そろえる／認知率50%に到達する"
          className="h-10"
        />
      </div>

      <div>
        <label className="text-xs font-bold text-foreground mb-1.5 block">説明</label>
        <AutoResizeTextarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          placeholder="なぜこの証拠が必要か・どんな状態を目指すか"
          className="min-h-[70px]"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="text-xs font-bold text-foreground mb-1.5 block">
            重要度（重み） <span className="text-red-500">*</span>
          </label>
          <Input
            type="number"
            step="0.25"
            min="0.25"
            value={draft.importance_weight}
            onChange={(e) => setDraft({ ...draft, importance_weight: e.target.value })}
            className="h-10"
          />
          <p className="text-[11px] text-muted-foreground mt-1 m-0">進捗の重み付けに使います（0より大きい数値）</p>
        </div>
        <div className="flex-1">
          <label className="text-xs font-bold text-foreground mb-1.5 block">進行状態</label>
          <select
            className={SELECT_CLASS}
            value={draft.execution_state}
            onChange={(e) => setDraft({ ...draft, execution_state: e.target.value as ExecutionState })}
          >
            {EXECUTION_STATES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground mt-1 m-0">「中止」は進捗の分母から外れます</p>
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-foreground mb-1.5 block">達成条件（判定ルール）</label>
        <RuleEditor companyId={companyId} draft={draft} setDraft={setDraft} />
      </div>

      <div>
        <label className="text-xs font-bold text-foreground mb-1.5 block">立証方法</label>
        <Input
          type="text"
          value={draft.verification_method}
          onChange={(e) => setDraft({ ...draft, verification_method: e.target.value })}
          placeholder="例: 年1回のブランド認知調査（n=1000）"
          className="h-10"
        />
      </div>

      <div>
        <label className="text-xs font-bold text-foreground mb-1.5 block">マイルストーン・メモ</label>
        <AutoResizeTextarea
          value={draft.milestone_note}
          onChange={(e) => setDraft({ ...draft, milestone_note: e.target.value })}
          placeholder="いつまでに・どう進めるか"
          className="min-h-[60px]"
        />
      </div>

      <div className="flex gap-2">
        <Button type="button" onClick={onSave} disabled={saving} size="sm">
          <Check size={14} />
          {saving ? '保存中...' : '保存'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving} size="sm">
          <X size={14} />
          キャンセル
        </Button>
      </div>
    </div>
  )
}
