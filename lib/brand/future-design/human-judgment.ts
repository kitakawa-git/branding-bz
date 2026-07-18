// §6-1 人間判断の有効性（失効・再確認）＋ §14.1 evidence バージョンでの厳密化。
// is_current（最新の人間判断）と is_valid（動的算出）は別物（§14.4）。ここで算出するのは is_valid。
import { evaluate } from './evaluate'
import { toTime, type AchievementEvaluation, type DesiredEvidenceInput, type HumanJudgmentInput, type ProofInput } from './types'

/**
 * §6-1 / §14.1
 * - manual_review     : valid_until 内なら有効（null なら次の人間レビューまで有効）
 * - automatic_override: rule_hash 一致 かつ evidence_version_at_eval == 現在 evidence_updated_at
 *                       かつ valid_until 内 の全てを満たすときだけ有効
 */
export function isHumanJudgmentValid(
  hj: HumanJudgmentInput | null | undefined,
  currentRuleHash: string | null | undefined,
  currentEvidenceUpdatedAt: string | Date | null | undefined,
  now: string | Date = new Date(),
): boolean {
  if (!hj) return false

  // valid_until は両方式で尊重（null は無期限）
  const until = toTime(hj.valid_until)
  const nowT = toTime(now)
  if (until !== null && nowT !== null && nowT >= until) return false

  if (hj.source === 'manual_review') return true

  // automatic_override: ルール不変 かつ evidence バージョン一致
  if (!hj.rule_hash || !currentRuleHash) return false
  if (hj.rule_hash !== currentRuleHash) return false
  const evalVersion = toTime(hj.evidence_version_at_eval)
  const currentVersion = toTime(currentEvidenceUpdatedAt)
  if (evalVersion === null || currentVersion === null) return false
  return evalVersion === currentVersion
}

export type ResolveContext = {
  /** §14.2 rule_hash はDB側生成。override 検証時に渡す（無ければ override は失効扱い） */
  currentRuleHash?: string | null
  now?: string | Date
}

/**
 * §5-0 有効な人間判断があれば自動評価より優先。無ければ evaluate() にフォールバック。
 * 失効した override は使わず自動評価へ（レコード自体は残す＝呼び出し側で「再確認」info を出す）。
 */
export function resolveEvaluation(
  de: DesiredEvidenceInput,
  adoptedProofs: ProofInput[],
  hj?: HumanJudgmentInput | null,
  ctx: ResolveContext = {},
): AchievementEvaluation {
  const valid = isHumanJudgmentValid(hj, ctx.currentRuleHash ?? null, de.evidence_updated_at, ctx.now ?? new Date())
  if (valid && hj) {
    return {
      state: hj.achievement_state,
      progress_fraction: hj.progress_fraction,
      source: 'manual',
      evaluated_value: null,
      matched_measurement_count: 0,
      reason_code: hj.source === 'manual_review' ? 'MANUAL_REVIEW' : 'MANUAL_OVERRIDE',
    }
  }
  return evaluate(de, adoptedProofs)
}
