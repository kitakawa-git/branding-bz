// npx tsx lib/brand-score/outer-metrics.test.ts
import assert from 'node:assert/strict'
import {
  MIN_CARD_VIEWS_FOR_DIGITAL,
  OUTER_TRACK_WEIGHTS,
  computeDigitalMetrics,
  linearScore,
  weightedAverage,
  type DigitalRawCounts,
} from './outer-metrics'

// 十分にログが溜まっている会社の想定
const healthy: DigitalRawCounts = {
  members: 20,
  uniqueVisitors: 40,
  totalCardViews: 200,
  vcardDownloads: 20,
  brandPageClicks: 10,
  avgDuration: 30,
}

// --- linearScore ---
assert.equal(linearScore(0, 10, 20), 0)
assert.equal(linearScore(10, 10, 20), 50)
assert.equal(linearScore(20, 10, 20), 100)
assert.equal(linearScore(999, 10, 20), 100, '上限を超えても100止まり')

// --- weightedAverage: null は分母から外れる ---
assert.equal(
  weightedAverage([
    { score: 80, weight: 0.5 },
    { score: null, weight: 0.5 },
  ]),
  80,
  'null 側は無視され、残り1項が100%になる'
)
assert.equal(
  weightedAverage([{ score: null, weight: 1 }]),
  null,
  '有効な項目が無ければ 0 ではなく null'
)

// --- 通常時はスコアが出る ---
{
  const r = computeDigitalMetrics(healthy)
  assert.equal(r.unavailable, null)
  assert.equal(typeof r.digitalScore, 'number')
}

// --- A: アクセスが少なすぎるときは未計測（0点にしない） ---
{
  const r = computeDigitalMetrics({
    ...healthy,
    totalCardViews: MIN_CARD_VIEWS_FOR_DIGITAL - 1,
    vcardDownloads: 0,
    brandPageClicks: 0,
  })
  assert.equal(r.unavailable, 'insufficient_data')
  assert.equal(r.digitalScore, null, '数件のアクセスから0点と断じない')
}
{
  const r = computeDigitalMetrics({
    ...healthy,
    totalCardViews: MIN_CARD_VIEWS_FOR_DIGITAL,
  })
  assert.equal(r.unavailable, null, '閾値ちょうどは計測できる扱い')
}

// --- C: スマート名刺がオフなら件数に関わらず未計測 ---
{
  const r = computeDigitalMetrics(healthy, { cardEnabled: false })
  assert.equal(r.unavailable, 'disabled')
  assert.equal(r.digitalScore, null)
}
{
  const r = computeDigitalMetrics(healthy, { cardEnabled: true })
  assert.equal(r.unavailable, null)
}
{
  // opts 未指定は「オン」と同じ（isFeatureEnabled の !== false と揃える）
  const r = computeDigitalMetrics(healthy, {})
  assert.equal(r.unavailable, null)
}

// --- B: 2本立ての合成。デジタルが null なら市場浸透が100%になる ---
{
  const outer = weightedAverage([
    { score: 79, weight: OUTER_TRACK_WEIGHTS.market },
    { score: null, weight: OUTER_TRACK_WEIGHTS.digital },
  ])
  assert.equal(outer, 79, 'デジタルが未計測なら市場浸透がそのままアウターになる')
}
{
  const outer = weightedAverage([
    { score: 80, weight: OUTER_TRACK_WEIGHTS.market },
    { score: 40, weight: OUTER_TRACK_WEIGHTS.digital },
  ])
  assert.equal(outer, 70, '80×0.75 + 40×0.25 = 70')
}
assert.equal(
  OUTER_TRACK_WEIGHTS.market + OUTER_TRACK_WEIGHTS.digital,
  1,
  '重みの合計は1'
)

console.log('✓ outer-metrics: all assertions passed')
