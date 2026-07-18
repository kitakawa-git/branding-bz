// ブランドオントロジー未来設計：ドメイン型（正本: docs/260718_ブランドオントロジー_C案統合設計_v1.md）
// §3-2 achievement_rule / §4 判定結果型 / 各入力型。DB書き込みは行わない（純粋ドメイン層）。

/** §3-2 achievement_rule スキーマ（明示語彙・演算子は >= と <= のみ） */
export type AchievementRuleV1 =
  | { version: 1; type: 'boolean'; minimum_proof_count?: number }
  | {
      version: 1
      type: 'count'
      threshold: number
      metric_filter?: { metric_key: string; unit?: string; operator?: '>=' | '<='; value?: number }
    }
  | {
      version: 1
      type: 'aggregate'
      metric_key: string
      aggregation: 'sum' | 'average' | 'maximum' | 'minimum' | 'latest'
      unit: string
      operator: '>=' | '<='
      target: number
      baseline?: number
    }
  | { version: 1; type: 'manual' }

export type AchievementState = 'unmet' | 'partially_met' | 'met' | 'indeterminate'

/** §4 reason_code 語彙 */
export type ReasonCode =
  | 'MET'
  | 'BELOW_TARGET'
  | 'INSUFFICIENT_COUNT'
  | 'NO_MATCHING_MEASUREMENT'
  | 'NO_MEASURED_DATE'
  | 'INVALID_RULE'
  | 'INVALID_BASELINE'
  | 'MANUAL_REVIEW'
  | 'MANUAL_OVERRIDE'

/** §4 判定結果 */
export type AchievementEvaluation = {
  state: AchievementState
  progress_fraction: number | null // baseline無し等は null
  source: 'automatic' | 'manual'
  evaluated_value: number | null // aggregate 集計結果など
  matched_measurement_count: number // 判定に使えた実績/測定値の件数
  reason_code: ReasonCode
}

export type ExecutionState = 'planned' | 'in_progress' | 'paused' | 'cancelled'

/** 獲得目標（desired_evidence）の判定に必要な入力 */
export type DesiredEvidenceInput = {
  rule: AchievementRuleV1
  importance_weight: number
  execution_state: ExecutionState
  /** §14.1 override 失効判定に使う evidence バージョン */
  evidence_updated_at: string | Date
}

/** §2-2 proof_point_measurements（判定に使う列のみ） */
export type MeasurementInput = {
  metric_key: string
  metric_value: number
  metric_unit: string
  measured_at: string | Date | null
}

/** verifies で採用済みの実績（Proof Point）とその測定値 */
export type ProofInput = {
  id: string
  measurements: MeasurementInput[]
}

/** §2-3＋§14.1 人間判断（automatic_override はスナップショットで失効判定） */
export type HumanJudgmentInput = {
  source: 'manual_review' | 'automatic_override'
  /** 人間は indeterminate を選べない（§6-4） */
  achievement_state: Exclude<AchievementState, 'indeterminate'>
  progress_fraction: number | null
  /** 評価時 rule のハッシュ（§14.2 DB側生成） */
  rule_hash: string | null
  /** 評価時の DE.evidence_updated_at（§14.1） */
  evidence_version_at_eval: string | Date | null
  valid_until: string | Date | null
}

/** 日時を比較可能な数値へ（null は null のまま） */
export const toTime = (v: string | Date | null | undefined): number | null => {
  if (v === null || v === undefined) return null
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime()
  return Number.isFinite(t) ? t : null
}

export const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)
