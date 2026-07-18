// §7 実証進捗と判定可能率（進捗単独表示は禁止・必ずセットで返す）＋ §14.6 ゼロ分母。
// 呼び出し側で execution_state='cancelled' を除外した DE 群を渡すこと（分母は非cancelled）。
import type { AchievementEvaluation } from './types'

export type ProgressItem = { weight: number; evaluation: AchievementEvaluation }

export type ProgressResult = {
  /** 実証進捗。非cancelled 0件 or evaluable 重み和0 → null（0%にしない・§14.6） */
  progress_fraction: number | null
  /** 判定可能率（重み）＝ Σ_evaluable(weight) / Σ_非cancelled(weight) */
  coverage_weight: number
  /** 判定可能率（件数・補助） */
  coverage_count: { evaluable: number; total: number }
}

/** evaluable = state ∈ {unmet, partially_met, met}（indeterminate を除外） */
const isEvaluable = (e: AchievementEvaluation): boolean => e.state !== 'indeterminate'

/** 各DEの寄与 = progress_fraction があればそれ、無ければ (state==='met' ? 1 : 0) */
const contribution = (e: AchievementEvaluation): number =>
  e.progress_fraction !== null && e.progress_fraction !== undefined ? e.progress_fraction : e.state === 'met' ? 1 : 0

export function computeProgress(items: ProgressItem[]): ProgressResult {
  const all = items || []
  const total = all.length
  const evaluableItems = all.filter((i) => isEvaluable(i.evaluation))

  const totalWeight = all.reduce((s, i) => s + i.weight, 0)
  const evaluableWeight = evaluableItems.reduce((s, i) => s + i.weight, 0)

  // §14.6 非cancelled 0件、または evaluable 重み和0 → 進捗 null／判定可能率 0
  if (total === 0 || evaluableWeight === 0) {
    return {
      progress_fraction: null,
      coverage_weight: 0,
      coverage_count: { evaluable: evaluableItems.length, total },
    }
  }

  const weighted = evaluableItems.reduce((s, i) => s + i.weight * contribution(i.evaluation), 0)

  return {
    progress_fraction: weighted / evaluableWeight,
    coverage_weight: totalWeight > 0 ? evaluableWeight / totalWeight : 0,
    coverage_count: { evaluable: evaluableItems.length, total },
  }
}
