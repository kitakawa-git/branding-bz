// §3-3 achievement_rule バリデーション
// baseline の方向違反（== を含む）は 'INVALID_BASELINE'。それ以外は入力エラー文字列。
import { isFiniteNumber, type AchievementRuleV1 } from './types'

export type ValidationResult = { ok: boolean; errors: string[] }

const AGGREGATIONS = ['sum', 'average', 'maximum', 'minimum', 'latest'] as const
const OPERATORS = ['>=', '<='] as const

/** §3-3。baseline 方向違反のみ 'INVALID_BASELINE'（§5-3 で進捗のみ null にする特別扱い） */
export function validateRule(rule: unknown): ValidationResult {
  const errors: string[] = []
  if (!rule || typeof rule !== 'object') return { ok: false, errors: ['INVALID_RULE_SHAPE'] }
  const r = rule as Partial<AchievementRuleV1> & Record<string, unknown>

  if (r.version !== 1) errors.push('INVALID_VERSION')

  switch (r.type) {
    case 'boolean': {
      const n = (r as { minimum_proof_count?: unknown }).minimum_proof_count
      if (n !== undefined && (!isFiniteNumber(n) || n < 1)) errors.push('INVALID_MINIMUM_PROOF_COUNT')
      break
    }
    case 'count': {
      const c = r as { threshold?: unknown; metric_filter?: Record<string, unknown> }
      if (!isFiniteNumber(c.threshold) || c.threshold < 1) errors.push('INVALID_THRESHOLD')
      const f = c.metric_filter
      if (f !== undefined) {
        if (typeof f.metric_key !== 'string' || f.metric_key.trim() === '') errors.push('INVALID_METRIC_KEY')
        if (f.unit !== undefined && (typeof f.unit !== 'string' || f.unit.trim() === '')) errors.push('INVALID_UNIT')
        const hasOp = f.operator !== undefined
        const hasVal = f.value !== undefined
        if (hasOp && !OPERATORS.includes(f.operator as (typeof OPERATORS)[number])) errors.push('INVALID_OPERATOR')
        // operator があれば value 必須／value があれば operator 必須
        if (hasOp && !hasVal) errors.push('MISSING_FILTER_VALUE')
        if (hasVal && !hasOp) errors.push('MISSING_FILTER_OPERATOR')
        if (hasVal && !isFiniteNumber(f.value)) errors.push('INVALID_FILTER_VALUE')
      }
      break
    }
    case 'aggregate': {
      const a = r as {
        metric_key?: unknown; unit?: unknown; target?: unknown
        aggregation?: unknown; operator?: unknown; baseline?: unknown
      }
      if (typeof a.metric_key !== 'string' || a.metric_key.trim() === '') errors.push('INVALID_METRIC_KEY')
      if (typeof a.unit !== 'string' || a.unit.trim() === '') errors.push('INVALID_UNIT')
      if (!isFiniteNumber(a.target)) errors.push('INVALID_TARGET')
      if (!AGGREGATIONS.includes(a.aggregation as (typeof AGGREGATIONS)[number])) errors.push('INVALID_AGGREGATION')
      if (!OPERATORS.includes(a.operator as (typeof OPERATORS)[number])) errors.push('INVALID_OPERATOR')
      if (a.baseline !== undefined) {
        if (!isFiniteNumber(a.baseline)) {
          errors.push('INVALID_BASELINE')
        } else if (isFiniteNumber(a.target)) {
          // >= は baseline < target／<= は baseline > target。== も不正。
          const okDirection = a.operator === '>=' ? a.baseline < a.target : a.operator === '<=' ? a.baseline > a.target : false
          if (!okDirection) errors.push('INVALID_BASELINE')
        }
      }
      break
    }
    case 'manual':
      break
    default:
      errors.push('INVALID_TYPE')
  }

  return { ok: errors.length === 0, errors }
}

/**
 * §5 の `invalid(r)` 判定用。baseline 方向違反は「ルール不正」ではなく
 * 進捗のみ null にして met/unmet を返す（§5-3）ため、構造的不正のみを見る。
 */
export function isStructurallyInvalidRule(rule: unknown): boolean {
  const { errors } = validateRule(rule)
  return errors.some((e) => e !== 'INVALID_BASELINE')
}

// --- §3-3 共通行（rule 以外の入力検証・補助） ---
export const isValidImportanceWeight = (w: unknown): boolean => isFiniteNumber(w) && w > 0
export const isValidProgressFraction = (p: unknown): boolean => p === null || (isFiniteNumber(p) && p >= 0 && p <= 1)
export const isValidMetricValue = (v: unknown): boolean => isFiniteNumber(v)
