// §10 未来設計 整合性チェックの判定ロジック ユニットテスト
// integrity.ts はDB依存のため、そこが用いる判定関数（future-design）と同じ条件式で
// チェック 2 / 4 / 5 / 7 / 10 の発火条件を検証する。実行: npx tsx lib/brand/future-design/integrity-checks.test.ts
import assert from 'node:assert/strict'
import { evaluate } from './evaluate'
import { isHumanJudgmentValid } from './human-judgment'
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
const de = (rule: AchievementRuleV1): DesiredEvidenceInput => ({
  rule, importance_weight: 1, execution_state: 'in_progress', evidence_updated_at: EVIDENCE_AT,
})
const pp = (id: string, ms: ProofInput['measurements'] = []): ProofInput => ({ id, measurements: ms })
const m = (metric_key: string, metric_value: number, metric_unit: string, measured_at: string | null = '2026-07-01') =>
  ({ metric_key, metric_value, metric_unit, measured_at })

// --- チェック2: 未来の約束に獲得計画が無い（toBeEvidencedBy の有無） ---
test('2 未来の約束に獲得計画が無い：target VP に toBeEvidencedBy が無ければ発火', () => {
  type ER = { relation_type: string; source_kind: string; source_id: string }
  const ers: ER[] = [{ relation_type: 'toBeEvidencedBy', source_kind: 'value_proposition', source_id: 'vp-planned' }]
  const hasPlan = (vpId: string) =>
    ers.some((r) => r.relation_type === 'toBeEvidencedBy' && r.source_kind === 'value_proposition' && r.source_id === vpId)
  assert.equal(hasPlan('vp-planned'), true)   // 計画あり → 発火しない
  assert.equal(hasPlan('vp-no-plan'), false)  // 計画なし → 発火する
})

// --- チェック4: 判定条件が未設定（空 or 不正） ---
test('4 判定条件が未設定：空ルール／不正ルールで発火・正常ルールでは発火しない', () => {
  const isEmpty = (r: unknown) => !r || typeof r !== 'object' || Object.keys(r as object).length === 0
  assert.equal(isEmpty({}), true)            // 空 → 発火
  assert.equal(isEmpty(null), true)          // 未設定 → 発火
  const invalid = { version: 1, type: 'count', threshold: 0 } as unknown as AchievementRuleV1
  assert.equal(validateRule(invalid).ok, false) // 不正 → 発火
  const valid: AchievementRuleV1 = { version: 1, type: 'boolean', minimum_proof_count: 1 }
  assert.equal(isEmpty(valid), false)
  assert.equal(validateRule(valid).ok, true)    // 正常 → 発火しない
})

// --- チェック5: 昇格レビュー待ち（全DEが met なのに target のまま） ---
test('5 昇格レビュー待ち：紐づく全DEが met なら発火／1件でも未達なら発火しない', () => {
  const metDe = evaluate(de({ version: 1, type: 'boolean' }), [pp('p1')])
  const unmetDe = evaluate(de({ version: 1, type: 'boolean' }), [])
  assert.equal(metDe.state, 'met')
  assert.equal(unmetDe.state, 'unmet')
  const allMet = (states: string[]) => states.every((s) => s === 'met')
  assert.equal(allMet([metDe.state, metDe.state]), true)   // 全met → 昇格レビュー待ち
  assert.equal(allMet([metDe.state, unmetDe.state]), false) // 未達あり → 発火しない
})

// --- チェック7: 測定値なしで判定不能（aggregate） ---
test('7 測定値なしで判定不能：一致測定値ゼロで indeterminate/NO_MATCHING_MEASUREMENT', () => {
  const rule: AchievementRuleV1 = {
    version: 1, type: 'aggregate', metric_key: 'nps', aggregation: 'average', unit: 'pt', operator: '>=', target: 30,
  }
  const none = evaluate(de(rule), [pp('p1', [m('brand_awareness_rate', 40, '%')])])
  assert.equal(none.state, 'indeterminate')
  assert.equal(none.reason_code, 'NO_MATCHING_MEASUREMENT') // → 発火
  const ok = evaluate(de(rule), [pp('p1', [m('nps', 40, 'pt')])])
  assert.equal(ok.state, 'met')                              // → 発火しない
  // latest で測定日が無い場合は NO_MEASURED_DATE でも発火対象
  const latestRule: AchievementRuleV1 = { ...rule, aggregation: 'latest' }
  const noDate = evaluate(de(latestRule), [pp('p1', [m('nps', 40, 'pt', null)])])
  assert.equal(noDate.reason_code, 'NO_MEASURED_DATE')
})

// --- チェック10: override 要再確認（失効検出） ---
test('10 override要再確認：rule_hash変化/evidence_version不一致で失効＝発火', () => {
  const base: HumanJudgmentInput = {
    source: 'automatic_override', achievement_state: 'met', progress_fraction: 1,
    rule_hash: 'H1', evidence_version_at_eval: EVIDENCE_AT, valid_until: null,
  }
  assert.equal(isHumanJudgmentValid(base, 'H1', EVIDENCE_AT), true)                        // 有効 → 発火しない
  assert.equal(isHumanJudgmentValid(base, 'H2', EVIDENCE_AT), false)                       // rule変化 → 発火
  assert.equal(isHumanJudgmentValid(base, 'H1', '2026-07-19T00:00:00.000Z'), false)         // データ更新 → 発火
  // manual_review は rule/データ変更では失効しない（valid_until のみ）
  const mr: HumanJudgmentInput = { ...base, source: 'manual_review', rule_hash: null, evidence_version_at_eval: null }
  assert.equal(isHumanJudgmentValid(mr, 'H2', '2026-07-19T00:00:00.000Z'), true)
})

// --- 単位・指標不一致（チェック6）の抽出条件も併せて確認 ---
test('6 単位・指標不一致：key/unit が rule と違う測定値を検出（判定対象外）', () => {
  const rule = { metric_key: 'brand_awareness_rate', unit: '%' }
  const all = [m('brand_awareness_rate', 40, '%'), m('churn_rate', 9, '%'), m('brand_awareness_rate', 40, 'pt')]
  const mismatched = all.filter((x) => x.metric_key !== rule.metric_key || x.metric_unit !== rule.unit)
  assert.equal(mismatched.length, 2) // key違い1件＋単位違い1件
})

console.log('=== §10 未来設計 整合性チェック ユニットテスト ===')
console.log(results.join('\n'))
console.log(`\n合計: ${passed} passed / ${results.length} tests`)
if (process.exitCode === 1) console.log('❌ 失敗があります')
else console.log('✅ すべて成功')
