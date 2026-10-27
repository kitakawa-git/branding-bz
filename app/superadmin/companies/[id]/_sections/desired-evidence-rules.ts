// 望ましい証拠（desired evidence）の判定ルールの下書き⇔ルール変換と表示用の文言。DesiredEvidenceSection から切り出した純粋関数
import type { AchievementRuleV1 } from '@/lib/brand/future-design/types'

export type ExecutionState = 'planned' | 'in_progress' | 'paused' | 'cancelled'

export type DesiredEvidence = {
  id: string
  company_id: string
  title: string
  description: string | null
  importance_weight: number
  achievement_rule: AchievementRuleV1 | Record<string, never> | null
  verification_method: string | null
  milestone_note: string | null
  execution_state: ExecutionState
  sort_order: number
}

export type RuleType = 'boolean' | 'count' | 'aggregate' | 'manual'

export type Draft = {
  title: string
  description: string
  importance_weight: string
  verification_method: string
  milestone_note: string
  execution_state: ExecutionState
  // rule エディタ
  rule_type: RuleType
  minimum_proof_count: string
  threshold: string
  filter_metric_key: string
  filter_metric_label: string // プレビュー用の表示名（保存しない）
  filter_unit: string
  filter_operator: '' | '>=' | '<='
  filter_value: string
  agg_metric_key: string
  agg_metric_label: string // プレビュー用の表示名（保存しない）
  aggregation: 'sum' | 'average' | 'maximum' | 'minimum' | 'latest'
  agg_unit: string
  agg_operator: '>=' | '<='
  agg_target: string
  agg_baseline: string
}

// 非エンジニア向けのテンプレカード（判定ロジック＝rule_type は不変。見せ方だけやさしく）
export const RULE_TEMPLATES: { value: RuleType; title: string; example: string; icon: string }[] = [
  { value: 'aggregate', title: '数字が目標に届いたら', example: '例：ブランド認知率が50%以上になったら', icon: '📈' },
  { value: 'count', title: '◯件たまったら', example: '例：導入事例が3件そろったら', icon: '🔢' },
  { value: 'boolean', title: '証拠が1つでもあれば', example: '例：受賞・掲載などの実績が付いたら', icon: '✅' },
  { value: 'manual', title: '人が見て判断する', example: '自動では測れないものを人が確認して記録', icon: '👤' },
]

export const AGG_LABEL = (v: Draft['aggregation']) =>
  ({ sum: '合計', average: '平均', maximum: '最大', minimum: '最小', latest: '最新' })[v] ?? v

export const OP_WORD = (op: '>=' | '<=') => (op === '>=' ? '以上' : '以下')

// 達成条件を日本語1文にする（常時プレビュー）。metric_key を見せず表示名で語る。
export function rulePreview(d: Draft): string {
  switch (d.rule_type) {
    case 'aggregate': {
      const name = d.agg_metric_label.trim() || '指標'
      const unit = d.agg_unit.trim()
      const target = d.agg_target.trim() || '◯'
      const aggWord = d.aggregation === 'latest' ? '最新で' : `${AGG_LABEL(d.aggregation)}が`
      const base = d.agg_baseline.trim() !== '' ? `（今${d.agg_baseline}${unit}）` : ''
      return `${name}が${aggWord}${target}${unit}${OP_WORD(d.agg_operator)}になったら達成${base}`
    }
    case 'count': {
      const n = d.threshold.trim() || '◯'
      if (d.filter_metric_key.trim()) {
        const name = d.filter_metric_label.trim() || '指定した指標'
        const cond =
          d.filter_operator && d.filter_value.trim() !== ''
            ? `（${name}が${d.filter_value}${d.filter_unit}${OP_WORD(d.filter_operator)}のものだけ）`
            : `（${name}を持つものだけ）`
        return `条件に合う実績が${n}件そろったら達成${cond}`
      }
      return `立証する実績が${n}件そろったら達成`
    }
    case 'boolean': {
      const n = d.minimum_proof_count.trim()
      return n && Number(n) > 1 ? `立証する実績が${n}件以上あれば達成` : `立証する実績が1つでもあれば達成`
    }
    case 'manual':
      return '人が確認して「達成／一部／未達」を記録します'
  }
}

export const AGGREGATIONS: { value: Draft['aggregation']; label: string }[] = [
  { value: 'sum', label: '合計' },
  { value: 'average', label: '平均' },
  { value: 'maximum', label: '最大' },
  { value: 'minimum', label: '最小' },
  { value: 'latest', label: '最新' },
]

export const emptyDraft = (): Draft => ({
  title: '',
  description: '',
  importance_weight: '1',
  verification_method: '',
  milestone_note: '',
  execution_state: 'planned',
  rule_type: 'aggregate',
  minimum_proof_count: '',
  threshold: '3',
  filter_metric_key: '',
  filter_metric_label: '',
  filter_unit: '',
  filter_operator: '',
  filter_value: '',
  agg_metric_key: '',
  agg_metric_label: '',
  aggregation: 'latest',
  agg_unit: '',
  agg_operator: '>=',
  agg_target: '',
  agg_baseline: '',
})

/** DBの achievement_rule → フォーム下書き（編集時） */
export function ruleToDraft(rule: DesiredEvidence['achievement_rule']): Partial<Draft> {
  const base = emptyDraft()
  const r = rule as AchievementRuleV1 | null
  if (!r || typeof r !== 'object' || !('type' in r)) return { rule_type: 'manual' }
  switch (r.type) {
    case 'boolean':
      return { rule_type: 'boolean', minimum_proof_count: r.minimum_proof_count != null ? String(r.minimum_proof_count) : '' }
    case 'count':
      return {
        rule_type: 'count',
        threshold: String(r.threshold ?? base.threshold),
        filter_metric_key: r.metric_filter?.metric_key ?? '',
        filter_unit: r.metric_filter?.unit ?? '',
        filter_operator: (r.metric_filter?.operator as Draft['filter_operator']) ?? '',
        filter_value: r.metric_filter?.value != null ? String(r.metric_filter.value) : '',
      }
    case 'aggregate':
      return {
        rule_type: 'aggregate',
        agg_metric_key: r.metric_key ?? '',
        aggregation: r.aggregation ?? 'latest',
        agg_unit: r.unit ?? '',
        agg_operator: r.operator ?? '>=',
        agg_target: r.target != null ? String(r.target) : '',
        agg_baseline: r.baseline != null ? String(r.baseline) : '',
      }
    default:
      return { rule_type: 'manual' }
  }
}

/** フォーム下書き → achievement_rule（version:1 を必ず含める） */
export function draftToRule(d: Draft): AchievementRuleV1 {
  switch (d.rule_type) {
    case 'boolean': {
      const n = d.minimum_proof_count.trim()
      return n ? { version: 1, type: 'boolean', minimum_proof_count: Number(n) } : { version: 1, type: 'boolean' }
    }
    case 'count': {
      const hasFilter = d.filter_metric_key.trim() !== ''
      const filter = hasFilter
        ? {
            metric_key: d.filter_metric_key.trim(),
            ...(d.filter_unit.trim() ? { unit: d.filter_unit.trim() } : {}),
            ...(d.filter_operator ? { operator: d.filter_operator } : {}),
            ...(d.filter_value.trim() !== '' ? { value: Number(d.filter_value) } : {}),
          }
        : undefined
      return {
        version: 1,
        type: 'count',
        threshold: Number(d.threshold || 0),
        ...(filter ? { metric_filter: filter } : {}),
      }
    }
    case 'aggregate':
      return {
        version: 1,
        type: 'aggregate',
        metric_key: d.agg_metric_key.trim(),
        aggregation: d.aggregation,
        unit: d.agg_unit.trim(),
        operator: d.agg_operator,
        target: Number(d.agg_target || 0),
        ...(d.agg_baseline.trim() !== '' ? { baseline: Number(d.agg_baseline) } : {}),
      }
    case 'manual':
      return { version: 1, type: 'manual' }
  }
}

/** 一覧に出す達成条件の要約 */
export function ruleSummary(rule: DesiredEvidence['achievement_rule']): string {
  const r = rule as AchievementRuleV1 | null
  if (!r || typeof r !== 'object' || !('type' in r)) return '未設定'
  switch (r.type) {
    case 'boolean':
      return `存在：実績${r.minimum_proof_count ?? 1}件以上`
    case 'count':
      return `件数：${r.threshold}件以上${r.metric_filter ? `（${r.metric_filter.metric_key}${r.metric_filter.operator ? ` ${r.metric_filter.operator} ${r.metric_filter.value}` : ''}）` : ''}`
    case 'aggregate': {
      const aggLabel = AGGREGATIONS.find((a) => a.value === r.aggregation)?.label ?? r.aggregation
      return `集計：${r.metric_key}(${r.unit}) の${aggLabel} ${r.operator} ${r.target}${r.baseline != null ? `（基準 ${r.baseline}）` : ''}`
    }
    case 'manual':
      return '手動：人が判断'
  }
}
