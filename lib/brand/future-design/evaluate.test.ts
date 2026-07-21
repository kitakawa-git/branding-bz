// 未来設計 判定エンジンのユニットテスト（依存追加なし・実行: npx tsx lib/brand/future-design/evaluate.test.ts）
// 正本: docs/260718_ブランドオントロジー_C案統合設計_v1.md（§5 判定 / §6 人間判断 / §7 進捗）
import assert from 'node:assert/strict'
import { evaluate } from './evaluate'
import { resolveEvaluation, isHumanJudgmentValid } from './human-judgment'
import { computeProgress } from './progress'
import { validateRule } from './rule-validator'
import type { AchievementRuleV1, DesiredEvidenceInput, HumanJudgmentInput, ProofInput } from './types'

let passed = 0
const results: string[] = []
function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    results.push(`  ✅ ${name}`)
  } catch (e) {
    results.push(`  ❌ ${name}\n     ${(e as Error).message}`)
    process.exitCode = 1
  }
}

const EVIDENCE_AT = '2026-07-18T00:00:00.000Z'
const de = (rule: AchievementRuleV1, over: Partial<DesiredEvidenceInput> = {}): DesiredEvidenceInput => ({
  rule,
  importance_weight: 1,
  execution_state: 'in_progress',
  evidence_updated_at: EVIDENCE_AT,
  ...over,
})
const pp = (id: string, measurements: ProofInput['measurements'] = []): ProofInput => ({ id, measurements })
const m = (metric_key: string, metric_value: number, metric_unit: string, measured_at: string | null = '2026-07-01') =>
  ({ metric_key, metric_value, metric_unit, measured_at })

// ---------- §7 例A: latest / partially_met 0.68（別metric_key混入は除外） ----------
test('例A latest partially_met 0.68（別metric_keyを除外）', () => {
  const rule: AchievementRuleV1 = {
    version: 1, type: 'aggregate', metric_key: 'brand_awareness_rate',
    aggregation: 'latest', unit: '%', operator: '>=', target: 50, baseline: 20,
  }
  const proofs = [
    pp('p1', [
      m('brand_awareness_rate', 38, '%', '2026-06-01'),
      m('churn_rate', 90, '%', '2026-07-01'),        // 単位同じ・key違い → 除外
    ]),
    pp('p2', [m('brand_awareness_rate', 40.4, '%', '2026-07-01')]), // 最新
  ]
  const r = evaluate(de(rule), proofs)
  assert.equal(r.state, 'partially_met')
  assert.equal(r.evaluated_value, 40.4)
  assert.equal(r.matched_measurement_count, 2) // key/unit一致の2件（churn_rateは除外）
  assert.equal(Math.round((r.progress_fraction as number) * 100) / 100, 0.68) // (40.4-20)/(50-20)
  assert.equal(r.reason_code, 'BELOW_TARGET')
  assert.equal(r.source, 'automatic')
})

// ---------- §7 例B: count 2/3 = 0.67 ----------
test('例B count 2/3＝0.67（partially_met）', () => {
  const rule: AchievementRuleV1 = {
    version: 1, type: 'count', threshold: 3,
    metric_filter: { metric_key: 'case_study', operator: '>=', value: 1 },
  }
  const proofs = [
    pp('p1', [m('case_study', 1, '件')]),
    pp('p2', [m('case_study', 2, '件')]),
    pp('p3', [m('other_metric', 5, '件')]), // 条件を満たさない
  ]
  const r = evaluate(de(rule), proofs)
  assert.equal(r.state, 'partially_met')
  assert.equal(r.evaluated_value, 2)
  assert.equal(Math.round((r.progress_fraction as number) * 100) / 100, 0.67)
  assert.equal(r.reason_code, 'INSUFFICIENT_COUNT')
})

// ---------- §7 例C: indeterminate（測定値なし） ----------
test('例C indeterminate（一致する測定値なし → NO_MATCHING_MEASUREMENT）', () => {
  const rule: AchievementRuleV1 = {
    version: 1, type: 'aggregate', metric_key: 'nps',
    aggregation: 'average', unit: 'pt', operator: '>=', target: 30,
  }
  const r = evaluate(de(rule), [pp('p1', [m('brand_awareness_rate', 40, '%')])])
  assert.equal(r.state, 'indeterminate')
  assert.equal(r.progress_fraction, null)
  assert.equal(r.evaluated_value, null)
  assert.equal(r.matched_measurement_count, 0)
  assert.equal(r.reason_code, 'NO_MATCHING_MEASUREMENT')
})

// ---------- §7 例D: manual（人間判断あり） ----------
test('例D manual（有効な manual_review が自動評価より優先・source=manual）', () => {
  const rule: AchievementRuleV1 = { version: 1, type: 'manual' }
  const hj: HumanJudgmentInput = {
    source: 'manual_review', achievement_state: 'met', progress_fraction: 1,
    rule_hash: null, evidence_version_at_eval: null, valid_until: null,
  }
  const r = resolveEvaluation(de(rule), [], hj)
  assert.equal(r.state, 'met')
  assert.equal(r.source, 'manual')
  assert.equal(r.progress_fraction, 1)
  assert.equal(r.reason_code, 'MANUAL_REVIEW')
  // 人間判断が無い manual は indeterminate（未達ではない）
  const none = evaluate(de(rule), [])
  assert.equal(none.state, 'indeterminate')
  assert.equal(none.reason_code, 'MANUAL_REVIEW')
})

// ---------- 追加: baseline無し → progress null・state は met/unmet のみ ----------
test('baseline無し → progress_fraction=null・partialは出ない', () => {
  const rule: AchievementRuleV1 = {
    version: 1, type: 'aggregate', metric_key: 'nps', aggregation: 'latest', unit: 'pt', operator: '>=', target: 30,
  }
  const below = evaluate(de(rule), [pp('p1', [m('nps', 20, 'pt', '2026-07-01')])])
  assert.equal(below.progress_fraction, null)
  assert.equal(below.state, 'unmet') // partially_met にしない
  assert.equal(below.reason_code, 'BELOW_TARGET')
  const over = evaluate(de(rule), [pp('p1', [m('nps', 35, 'pt', '2026-07-01')])])
  assert.equal(over.state, 'met')
  assert.equal(over.progress_fraction, null)
  assert.equal(over.reason_code, 'MET')
})

// ---------- 追加: 単位一致だが metric_key 不一致は除外 ----------
test('単位一致・metric_key不一致は対象外（§5-1）', () => {
  const rule: AchievementRuleV1 = {
    version: 1, type: 'aggregate', metric_key: 'brand_awareness_rate',
    aggregation: 'sum', unit: '%', operator: '>=', target: 10,
  }
  const r = evaluate(de(rule), [pp('p1', [m('churn_rate', 99, '%')])])
  assert.equal(r.state, 'indeterminate')
  assert.equal(r.reason_code, 'NO_MATCHING_MEASUREMENT')
})

// ---------- 追加: latest で全 measured_at null → indeterminate ----------
test('latest 全measured_at null → NO_MEASURED_DATE（created_atにフォールバックしない）', () => {
  const rule: AchievementRuleV1 = {
    version: 1, type: 'aggregate', metric_key: 'nps', aggregation: 'latest', unit: 'pt', operator: '>=', target: 30,
  }
  const r = evaluate(de(rule), [pp('p1', [m('nps', 40, 'pt', null), m('nps', 50, 'pt', null)])])
  assert.equal(r.state, 'indeterminate')
  assert.equal(r.reason_code, 'NO_MEASURED_DATE')
})

// ---------- 追加: latest でも「測定値ゼロ」は NO_MATCHING（NO_MEASURED_DATE と区別） ----------
test('latest かつ一致する測定値ゼロ → NO_MATCHING_MEASUREMENT（NO_MEASURED_DATEと混同しない）', () => {
  const rule: AchievementRuleV1 = {
    version: 1, type: 'aggregate', metric_key: 'nps', aggregation: 'latest', unit: 'pt', operator: '>=', target: 30,
  }
  // 一致する測定値そのものが無い（別keyのみ）。日付有無以前の「データ不足」。
  const r = evaluate(de(rule), [pp('p1', [m('churn_rate', 5, '%')])])
  assert.equal(r.state, 'indeterminate')
  assert.equal(r.reason_code, 'NO_MATCHING_MEASUREMENT')
})
test('latest で測定値が1件も無い（実績ゼロ） → NO_MATCHING_MEASUREMENT', () => {
  const rule: AchievementRuleV1 = {
    version: 1, type: 'aggregate', metric_key: 'nps', aggregation: 'latest', unit: 'pt', operator: '>=', target: 30,
  }
  const r = evaluate(de(rule), [])
  assert.equal(r.reason_code, 'NO_MATCHING_MEASUREMENT')
})

// ---------- 追加: count は同一PPの複数測定を1件（§5-5 DISTINCT） ----------
test('count は同一PPの複数測定を1件として数える（§5-5）', () => {
  const rule: AchievementRuleV1 = {
    version: 1, type: 'count', threshold: 2, metric_filter: { metric_key: 'survey', operator: '>=', value: 1 },
  }
  const r = evaluate(de(rule), [pp('p1', [m('survey', 1, '件'), m('survey', 2, '件'), m('survey', 3, '件')])])
  assert.equal(r.evaluated_value, 1) // 3測定でもPPは1件
  assert.equal(r.state, 'partially_met')
  assert.equal(r.progress_fraction, 0.5)
})

// ---------- 追加: override 失効（rule_hash 変化 / evidence_version 不一致）→ 自動評価へフォールバック ----------
test('override 失効（rule_hash変化）→ 自動評価にフォールバック', () => {
  const rule: AchievementRuleV1 = { version: 1, type: 'boolean' }
  const hj: HumanJudgmentInput = {
    source: 'automatic_override', achievement_state: 'met', progress_fraction: 1,
    rule_hash: 'OLD_HASH', evidence_version_at_eval: EVIDENCE_AT, valid_until: null,
  }
  const r = resolveEvaluation(de(rule), [], hj, { currentRuleHash: 'NEW_HASH' })
  assert.equal(r.source, 'automatic')
  assert.equal(r.state, 'unmet') // 実績0件 → boolean unmet
  assert.equal(r.reason_code, 'INSUFFICIENT_COUNT')
})

test('override 失効（evidence_version不一致）→ 自動評価にフォールバック', () => {
  const rule: AchievementRuleV1 = { version: 1, type: 'boolean' }
  const hj: HumanJudgmentInput = {
    source: 'automatic_override', achievement_state: 'met', progress_fraction: 1,
    rule_hash: 'H1', evidence_version_at_eval: '2026-07-01T00:00:00.000Z', valid_until: null,
  }
  const r = resolveEvaluation(de(rule), [pp('p1')], hj, { currentRuleHash: 'H1' })
  assert.equal(r.source, 'automatic')
  assert.equal(r.state, 'met') // 実績1件 → boolean met
  // 条件が揃えば override は有効
  const validHj: HumanJudgmentInput = { ...hj, evidence_version_at_eval: EVIDENCE_AT }
  const ok = resolveEvaluation(de(rule), [pp('p1')], validHj, { currentRuleHash: 'H1' })
  assert.equal(ok.source, 'manual')
  assert.equal(ok.reason_code, 'MANUAL_OVERRIDE')
  assert.equal(isHumanJudgmentValid(validHj, 'H1', EVIDENCE_AT), true)
})

// ---------- 追加: INVALID_BASELINE ----------
test('INVALID_BASELINE（>= で baseline>=target）→ progress null・state は met/unmet', () => {
  const rule: AchievementRuleV1 = {
    version: 1, type: 'aggregate', metric_key: 'nps', aggregation: 'latest',
    unit: 'pt', operator: '>=', target: 50, baseline: 60, // 方向違反
  }
  const r = evaluate(de(rule), [pp('p1', [m('nps', 55, 'pt', '2026-07-01')])])
  assert.equal(r.reason_code, 'INVALID_BASELINE')
  assert.equal(r.progress_fraction, null)
  assert.equal(r.state, 'met') // 55>=50
  assert.equal(r.evaluated_value, 55)
  // validator も検出する。baseline==target も不正。
  assert.equal(validateRule(rule).errors.includes('INVALID_BASELINE'), true)
  assert.equal(validateRule({ ...rule, baseline: 50 }).errors.includes('INVALID_BASELINE'), true)
  // <= の方向: baseline > target が正
  assert.equal(validateRule({ version: 1, type: 'aggregate', metric_key: 'x', aggregation: 'latest', unit: '%', operator: '<=', target: 5, baseline: 10 }).ok, true)
  assert.equal(validateRule({ version: 1, type: 'aggregate', metric_key: 'x', aggregation: 'latest', unit: '%', operator: '<=', target: 5, baseline: 3 }).errors.includes('INVALID_BASELINE'), true)
})

test('構造的に不正なルール → INVALID_RULE（indeterminate）', () => {
  const r = evaluate(de({ version: 1, type: 'count', threshold: 0 } as AchievementRuleV1), [pp('p1')])
  assert.equal(r.state, 'indeterminate')
  assert.equal(r.reason_code, 'INVALID_RULE')
})

// ---------- §7 進捗・判定可能率 ----------
test('§7 進捗＝重み付き／判定可能率＝重み・件数（indeterminateは分子分母から除外）', () => {
  const mk = (state: 'met' | 'unmet' | 'partially_met' | 'indeterminate', pf: number | null) =>
    ({ state, progress_fraction: pf, source: 'automatic' as const, evaluated_value: null, matched_measurement_count: 0, reason_code: 'MET' as const })
  const res = computeProgress([
    { weight: 3, evaluation: mk('met', 1) },              // 3×1
    { weight: 1, evaluation: mk('partially_met', 0.5) },  // 1×0.5
    { weight: 4, evaluation: mk('indeterminate', null) }, // 除外
  ])
  assert.equal(res.progress_fraction, 3.5 / 4)          // = 0.875
  assert.equal(res.coverage_weight, 4 / 8)              // 判定可能重み 4 / 全8
  assert.deepEqual(res.coverage_count, { evaluable: 2, total: 3 })
})

test('§14.6 ゼロ分母：0件 or evaluable重み0 → progress=null・coverage_weight=0', () => {
  const empty = computeProgress([])
  assert.equal(empty.progress_fraction, null)
  assert.equal(empty.coverage_weight, 0)
  const allIndeterminate = computeProgress([
    { weight: 2, evaluation: { state: 'indeterminate', progress_fraction: null, source: 'automatic', evaluated_value: null, matched_measurement_count: 0, reason_code: 'INVALID_RULE' } },
  ])
  assert.equal(allIndeterminate.progress_fraction, null) // 0%にしない
  assert.equal(allIndeterminate.coverage_weight, 0)
  assert.deepEqual(allIndeterminate.coverage_count, { evaluable: 0, total: 1 })
})

console.log('=== future-design 判定エンジン ユニットテスト ===')
console.log(results.join('\n'))
console.log(`\n合計: ${passed} passed / ${results.length} tests`)
if (process.exitCode === 1) console.log('❌ 失敗があります')
else console.log('✅ すべて成功')
