// §5 判定アルゴリズム（自動評価エンジン）。純粋関数・DBアクセスなし。
import { isStructurallyInvalidRule } from './rule-validator'
import {
  clamp01, isFiniteNumber, toTime,
  type AchievementEvaluation, type AchievementRuleV1, type DesiredEvidenceInput,
  type MeasurementInput, type ProofInput, type ReasonCode,
} from './types'

const indeterminate = (reason_code: ReasonCode): AchievementEvaluation => ({
  state: 'indeterminate',
  progress_fraction: null,
  source: 'automatic',
  evaluated_value: null,
  matched_measurement_count: 0,
  reason_code,
})

/** §5-3 progressFraction（baseline を自動補完しない）。戻り: [fraction, invalidBaseline] */
export function progressFraction(
  a: number,
  r: Extract<AchievementRuleV1, { type: 'aggregate' }>,
): [number | null, boolean] {
  if (r.baseline === undefined) return [null, false] // 勝手な baseline を作らない
  if (r.operator === '>=') {
    if (!(r.baseline < r.target)) return [null, true] // INVALID_BASELINE
    return [clamp01((a - r.baseline) / (r.target - r.baseline)), false]
  }
  // operator === '<='
  if (!(r.baseline > r.target)) return [null, true] // INVALID_BASELINE
  return [clamp01((r.baseline - a) / (r.baseline - r.target)), false]
}

/** §5-1 一致条件：metric_key 一致 かつ metric_unit 一致 かつ 有限値 */
const matchesKeyAndUnit = (m: MeasurementInput, metric_key: string, unit: string): boolean =>
  m.metric_key === metric_key && m.metric_unit === unit && isFiniteNumber(m.metric_value)

/** §5-5 count: metric_filter を満たす測定値を持つ PP を PP単位で distinct に数える */
function proofsWithQualifyingMeasurement(
  proofs: ProofInput[],
  filter: Extract<AchievementRuleV1, { type: 'count' }>['metric_filter'],
): ProofInput[] {
  if (!filter) return proofs // フィルタ無し＝採用済み実績すべてを1件ずつ数える
  return proofs.filter((p) =>
    (p.measurements || []).some((m) => {
      if (m.metric_key !== filter.metric_key) return false
      if (filter.unit !== undefined && m.metric_unit !== filter.unit) return false
      if (!isFiniteNumber(m.metric_value)) return false
      if (filter.operator !== undefined && filter.value !== undefined) {
        return filter.operator === '>=' ? m.metric_value >= filter.value : m.metric_value <= filter.value
      }
      return true
    }),
  )
}

function aggregateValue(values: number[], aggregation: Extract<AchievementRuleV1, { type: 'aggregate' }>['aggregation']): number {
  switch (aggregation) {
    case 'sum': return values.reduce((s, v) => s + v, 0)
    case 'average': return values.reduce((s, v) => s + v, 0) / values.length
    case 'maximum': return Math.max(...values)
    case 'minimum': return Math.min(...values)
    case 'latest': return values[0] // 呼び出し側で measured_at 降順の先頭を渡す
  }
}

/**
 * §5 自動評価。`adoptedProofs` は verifies で採用済み・端点解決済みの実績のみ（幽霊エッジ除外）。
 * 人間判断の優先は resolveEvaluation（human-judgment.ts）で行う。
 */
export function evaluate(de: DesiredEvidenceInput, adoptedProofs: ProofInput[]): AchievementEvaluation {
  const P = adoptedProofs || []
  const r = de.rule
  if (isStructurallyInvalidRule(r)) return indeterminate('INVALID_RULE')

  switch (r.type) {
    case 'boolean': {
      const n = P.length
      const need = r.minimum_proof_count ?? 1
      const met = n >= need
      return {
        state: met ? 'met' : 'unmet',
        progress_fraction: met ? 1 : 0,
        source: 'automatic',
        evaluated_value: n,
        matched_measurement_count: n,
        reason_code: met ? 'MET' : 'INSUFFICIENT_COUNT',
      }
    }

    case 'count': {
      const Pf = proofsWithQualifyingMeasurement(P, r.metric_filter)
      const n = Pf.length
      const state = n >= r.threshold ? 'met' : n > 0 ? 'partially_met' : 'unmet'
      return {
        state,
        progress_fraction: clamp01(n / r.threshold),
        source: 'automatic',
        evaluated_value: n,
        matched_measurement_count: n,
        reason_code: state === 'met' ? 'MET' : 'INSUFFICIENT_COUNT',
      }
    }

    case 'aggregate': {
      // まず key＋unit＋有限値で母集団を作る。ここが空なら「そもそも測定値が無い」＝ NO_MATCHING_MEASUREMENT。
      const M_all = P.flatMap((p) => p.measurements || []).filter((m) => matchesKeyAndUnit(m, r.metric_key, r.unit))
      if (M_all.length === 0) return indeterminate('NO_MATCHING_MEASUREMENT')

      let M = M_all
      if (r.aggregation === 'latest') {
        // §5-4 measured_at のある測定値のみ対象（created_at にフォールバックしない）
        M = M.filter((m) => toTime(m.measured_at) !== null)
        // 母集団はあるのに measured_at 付きが無い＝「日付が無くて最新を判定できない」＝ NO_MEASURED_DATE。
        if (M.length === 0) return indeterminate('NO_MEASURED_DATE')
        // measured_at 降順（同値は元順＝安定ソートで tie-break）
        M = [...M].sort((a, b) => (toTime(b.measured_at) as number) - (toTime(a.measured_at) as number))
      }
      const a = aggregateValue(M.map((m) => m.metric_value), r.aggregation)
      const met = r.operator === '>=' ? a >= r.target : a <= r.target
      const [frac, invalidBaseline] = progressFraction(a, r)
      if (invalidBaseline) {
        return {
          state: met ? 'met' : 'unmet',
          progress_fraction: null,
          source: 'automatic',
          evaluated_value: a,
          matched_measurement_count: M.length,
          reason_code: 'INVALID_BASELINE',
        }
      }
      const state = met ? 'met' : frac !== null && frac > 0 ? 'partially_met' : 'unmet'
      return {
        state,
        progress_fraction: frac,
        source: 'automatic',
        evaluated_value: a,
        matched_measurement_count: M.length,
        reason_code: met ? 'MET' : 'BELOW_TARGET',
      }
    }

    case 'manual':
      // 人間判断が無い manual は「判定不能」（未達ではない）
      return indeterminate('MANUAL_REVIEW')
  }
}
