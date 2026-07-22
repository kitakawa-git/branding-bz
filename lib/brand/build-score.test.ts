// 構築度スコアの回帰テスト（決定論・期待値固定）。
// 実行: nvm use 22 && npx tsx lib/brand/build-score.test.ts
import assert from 'node:assert/strict'
import { computeBuildScore, deriveBuildScoreInput, type BuildScoreInput } from './build-score'
import type { ElementRef } from './elements-catalog'
import type { RelationRow } from './map-data'

const base = (over: Partial<BuildScoreInput> = {}): BuildScoreInput => ({
  counts: { mission: 1, vision: 1, value: 2, vp: 3, proof: 5, rule: 3, persona: 2, desiredEvidence: 1 },
  connectivity: { total: 20, unconnected: 0, nonPersona: 18, unreachable: 0, islands: 1, hasNodes: true, hasRoots: true },
  backing: { targets: 3, backed: 3, noun: '提供価値' },
  rules: { total: 3, withExamples: 3 },
  future: { hasDesiredEvidence: true, verifiesCount: 1 },
  ...over,
})

// ---- 空企業: 例外なく0相当・構築中 ----
const empty = computeBuildScore({
  counts: { mission: 0, vision: 0, value: 0, vp: 0, proof: 0, rule: 0, persona: 0, desiredEvidence: 0 },
  connectivity: { total: 0, unconnected: 0, nonPersona: 0, unreachable: 0, islands: 0, hasNodes: false, hasRoots: false },
  backing: { targets: 0, backed: 0, noun: '提供価値' },
  rules: { total: 0, withExamples: 0 },
  future: { hasDesiredEvidence: false, verifiesCount: 0 },
})
assert.equal(empty.total, 0)
assert.equal(empty.band.key, 'building')
assert.equal(empty.band.label, '構築中')
assert.ok(empty.axes.every((a) => a.score === 0))

// ---- 満点近い企業: 100・構築完了 ----
const full = computeBuildScore(base())
assert.equal(full.total, 100)
assert.equal(full.band.key, 'complete')
assert.deepEqual(
  full.axes.map((a) => `${a.key}:${a.score}/${a.max}`),
  ['elements:30/30', 'connectivity:30/30', 'backing:25/25', 'rules:15/15'],
)
assert.equal(full.bonus, 5)

// ---- 裏づけ欠落: 25点が落ち、hint が指す ----
const noBacking = computeBuildScore(base({ backing: { targets: 3, backed: 0, noun: '提供価値' } }))
assert.equal(noBacking.total, 30 + 30 + 0 + 15 + 5) // 80
assert.equal(noBacking.band.key, 'substantial') // 充実（71-90）
const backingAxis = noBacking.axes.find((a) => a.key === 'backing')!
assert.equal(backingAxis.score, 0)
assert.ok(backingAxis.hint.includes('あと3件'))

// ---- 未来設計あり/なしの差はボーナス分だけ（未実施でも減点しない） ----
const rulesZero = { rules: { total: 0, withExamples: 0 } }
const withFuture = computeBuildScore(base({ ...rulesZero }))
const withoutFuture = computeBuildScore(
  base({ ...rulesZero, future: { hasDesiredEvidence: false, verifiesCount: 0 } }),
)
assert.equal(withoutFuture.total, 85) // 30+30+25+0
assert.equal(withFuture.total, 90) // +5
assert.equal(withFuture.total - withoutFuture.total, 5)
assert.ok(withoutFuture.bonusHint.includes('設定すると加点'))

// ---- バンド境界: 90は充実・91超相当は構築完了 ----
assert.equal(withFuture.band.key, 'substantial') // 90 → 〜90 充実
assert.equal(computeBuildScore(base()).band.key, 'complete') // 100 → 90超

// ---- 島が増えると減点 ----
const twoIslands = computeBuildScore(base({ connectivity: { total: 20, unconnected: 0, nonPersona: 18, unreachable: 0, islands: 2, hasNodes: true, hasRoots: true } }))
assert.equal(twoIslands.axes.find((a) => a.key === 'connectivity')!.score, 29)

// ---- 理念（根）が無い会社は到達点を満点扱いにしない ----
const rootless = computeBuildScore(
  base({ connectivity: { total: 5, unconnected: 3, nonPersona: 5, unreachable: 0, islands: 1, hasNodes: true, hasRoots: false } }),
)
const rootlessConn = rootless.axes.find((a) => a.key === 'connectivity')!
assert.equal(rootlessConn.score, Math.round((1 - 3 / 5) * 15) + 0 + 3) // 到達12点は付かない
assert.ok(rootlessConn.hint.includes('理念'))

// ---- deriveBuildScoreInput: 生データからの集計 ----
const catalog: ElementRef[] = [
  { kind: 'philosophy_element', id: 'ph1', label: 'ミッション' },
  { kind: 'philosophy_element', id: 'ph2', label: 'バリューA' },
  { kind: 'value_proposition', id: 'vp1', label: '提供価値A' },
  { kind: 'proof_point', id: 'pp1', label: '実績A' },
  { kind: 'persona', id: 'pe1', label: 'ペルソナA' },
]
const philTypes = { ph1: 'mission', ph2: 'value' }
const rel = (id: string, sk: string, sid: string, rt: string, tk: string, tid: string): RelationRow => ({
  id,
  source_kind: sk as RelationRow['source_kind'],
  source_id: sid,
  target_kind: tk as RelationRow['target_kind'],
  target_id: tid,
  relation_type: rt,
  note: null,
})
const relations = [
  rel('r1', 'value_proposition', 'vp1', 'evidencedBy', 'proof_point', 'pp1'),
  rel('r2', 'philosophy_element', 'ph1', 'guides', 'value_proposition', 'vp1'),
]
const derived = deriveBuildScoreInput({
  catalog,
  philTypes,
  relations,
  rules: [
    { ng_example: '絶対に', ok_example: null },
    { ng_example: null, ok_example: null },
  ],
})
assert.equal(derived.counts.mission, 1)
assert.equal(derived.counts.value, 1)
assert.equal(derived.counts.vp, 1)
assert.equal(derived.counts.proof, 1)
assert.equal(derived.counts.persona, 1)
assert.equal(derived.counts.rule, 2)
assert.equal(derived.backing.targets, 1) // 提供価値があるのでVPモード
assert.equal(derived.backing.backed, 1) // vp1 は evidencedBy 済み
assert.equal(derived.backing.noun, '提供価値')
assert.equal(derived.rules.withExamples, 1)
assert.equal(derived.connectivity.unconnected, 2) // バリューph2・ペルソナpe1 は線なし
assert.equal(derived.connectivity.unreachable, 1) // ph2（バリュー）だけ＝ペルソナは対象外
assert.equal(derived.connectivity.islands, 1)
// 空企業でも derive が例外を出さない
const emptyDerived = deriveBuildScoreInput({ catalog: [], philTypes: {}, relations: [], rules: [] })
assert.equal(computeBuildScore(emptyDerived).total, 0)

console.log('build-score.test.ts: all assertions passed')
