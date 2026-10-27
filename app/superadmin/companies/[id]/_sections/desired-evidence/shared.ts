// 未来設計（獲得目標）セクションで共有する定数・型・小関数（DesiredEvidenceSection から切り出し）
import { supabase } from '@/lib/supabase'
import type {
  DesiredEvidenceEvaluationDto,
  VisionProgressDto,
} from '@/app/api/superadmin/desired-evidence/evaluations/route'
import type { ExecutionState } from '../desired-evidence-rules'

export const EXECUTION_STATES: { value: ExecutionState; label: string }[] = [
  { value: 'planned', label: '計画中' },
  { value: 'in_progress', label: '進行中' },
  { value: 'paused', label: '一時停止' },
  { value: 'cancelled', label: '中止' },
]
export const execLabel = (v: ExecutionState) => EXECUTION_STATES.find((s) => s.value === v)?.label ?? v

export const SELECT_CLASS =
  'h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-ds-app-accent-soft focus:ring-1 focus:ring-ds-app-accent-soft'

// 判定状態の和訳＋バッジ色（§5 の4状態）
export const STATE_META: Record<string, { label: string; cls: string }> = {
  met: { label: '達成', cls: 'bg-emerald-100 text-emerald-800' },
  partially_met: { label: '一部', cls: 'bg-amber-100 text-amber-800' },
  unmet: { label: '未達', cls: 'bg-gray-100 text-gray-700' },
  indeterminate: { label: '判定不能', cls: 'bg-rose-100 text-rose-800' },
}

export const pct = (f: number | null | undefined) => (f == null ? null : Math.round(f * 100))

/** 判定理由コードの読み下し（§5・§14.6） */
const REASON_TEXTS: Record<string, string> = {
  MET: '達成条件を満たしています',
  BELOW_TARGET: '目標値にまだ届いていません',
  INSUFFICIENT_COUNT: '立証する実績の件数が足りません',
  NO_MATCHING_MEASUREMENT: 'まだ測定値がありません（データ不足）',
  NO_MEASURED_DATE: '測定日のない測定値があり「最新」を判定できません',
  INVALID_RULE: '達成条件が不正です。編集して直してください',
  INVALID_BASELINE: '現状値（基準）の向きが目標と矛盾しているため、進捗率は出せません',
  MANUAL_REVIEW: '手動判定です。人の判断が記録されるまで判定できません',
  MANUAL_OVERRIDE: '人の判断で記録された結果です',
}
export const reasonText = (ev: DesiredEvidenceEvaluationDto['evaluation']): string =>
  REASON_TEXTS[ev.reason_code] ?? `判定できません（${ev.reason_code}）`

// 全体／ビジョン単位の進捗（vision_id・vision_label を除いた形）
export type ProgressSummary = Omit<VisionProgressDto, 'vision_id' | 'vision_label'>

// --- §6 人間判断 ---
export type JudgmentDraft = {
  achievementState: 'unmet' | 'partially_met' | 'met'
  progress: string // 空欄＝未指定（null）
  reason: string
}
export const emptyJudgmentDraft = (): JudgmentDraft => ({ achievementState: 'met', progress: '', reason: '' })

export const JUDGMENT_STATES: { value: JudgmentDraft['achievementState']; label: string }[] = [
  { value: 'met', label: '達成' },
  { value: 'partially_met', label: '一部達成' },
  { value: 'unmet', label: '未達' },
]

/** §6-4 状態と進捗率の整合（APIとDB CHECK と同じ規則をUIでも先に弾く） */
export function checkStateProgress(state: JudgmentDraft['achievementState'], raw: string): string | null {
  if (raw.trim() === '') return null
  const p = Number(raw)
  if (!Number.isFinite(p) || p < 0 || p > 1) return '進捗率は0〜1で入力してください（未指定でも可）'
  if (state === 'met' && p !== 1) return '「達成」の進捗率は 1 か未指定にしてください'
  if (state === 'unmet' && p !== 0) return '「未達」の進捗率は 0 か未指定にしてください'
  if (state === 'partially_met' && !(p > 0 && p < 1)) return '「一部達成」の進捗率は 0 より大きく 1 未満にしてください'
  return null
}

// --- §8 提供価値のライフサイクル ---
export type VpRow = { id: string; title: string | null; lifecycle_state: string | null; promoted_at: string | null; sort_order: number }
export const VP_STATES: { value: string; label: string }[] = [
  { value: 'target', label: '目標（未来の約束）' },
  { value: 'transition_candidate', label: '移行候補' },
  { value: 'current', label: '現在の約束' },
  { value: 'retired', label: '廃止' },
]
export const vpStateLabel = (v: string | null) => VP_STATES.find((s) => s.value === (v ?? 'current'))?.label ?? (v ?? 'current')

// --- §6 / §8 書き込みAPI（RLSでクライアント直更新できないため必ずAPI経由） ---
export const authedPost = async (url: string, payload: unknown) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('セッションが無効です。再ログインしてください')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(payload),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error || 'エラーが発生しました')
  return json
}
