// 日程調整ツール（sorou）の純関数のテスト
// 実行: npx tsx lib/tools/sorou/core.test.ts
import assert from 'node:assert/strict'
import { normalizeCands, normalizeAnswers, remapAnswers, tally, bestScore, candLabel, isEventId, TIME_OPTIONS } from './core'

// 候補の検証と並べ替え
{
  assert.deepEqual(normalizeCands([{ k: '2026-11-03', t: '19:00' }, { k: '2026-11-02', t: '' }, { k: '2026-11-03', t: '10:00' }]), [
    { k: '2026-11-02', t: '' }, { k: '2026-11-03', t: '10:00' }, { k: '2026-11-03', t: '19:00' },
  ])
  assert.equal(normalizeCands([]), null, '候補0件は不可')
  assert.equal(normalizeCands([{ k: '2026-02-30', t: '' }]), null, '存在しない日付は不可')
  assert.equal(normalizeCands([{ k: '2026/11/03', t: '' }]), null, '形式違いは不可')
  assert.equal(normalizeCands(Array.from({ length: 201 }, () => ({ k: '2026-11-03', t: '' }))), null, '201件は不可')
  assert.deepEqual(normalizeCands([{ k: '2026-11-03', t: 123 }]), [{ k: '2026-11-03', t: '' }], '時刻が文字列でなければ時刻未定')
}

// 回答の検証
{
  assert.deepEqual(normalizeAnswers(['ok', 'mb', 'no'], 3), ['ok', 'mb', 'no'])
  assert.equal(normalizeAnswers(['ok', 'mb'], 3), null, '候補数と違う')
  assert.equal(normalizeAnswers(['ok', null, 'no'], 3), null, '未回答は不可')
  assert.equal(normalizeAnswers(['yes'], 1), null, '値が不正')
}

// 候補を編集したときの回答の引き継ぎ
{
  const oldCands = [{ k: '2026-11-02', t: '19:00' }, { k: '2026-11-03', t: '19:00' }, { k: '2026-11-04', t: '' }]
  const newCands = [{ k: '2026-11-03', t: '19:00' }, { k: '2026-11-04', t: '10:00' }, { k: '2026-11-05', t: '19:00' }]
  assert.deepEqual(remapAnswers(oldCands, newCands, ['ok', 'no', 'mb']), ['no', null, null], '同じ日付×時刻だけ引き継ぐ')
}

// 集計と最有力
{
  const cands = [{ k: '2026-11-02', t: '' }, { k: '2026-11-03', t: '' }]
  const rows = tally(cands, [{ answers: ['ok', 'mb'] }, { answers: ['ok', 'no'] }, { answers: ['mb', 'ok'] }])
  assert.deepEqual(rows.map(r => [r.ok, r.mb, r.no, r.score]), [[2, 1, 0, 5], [1, 1, 1, 3]])
  assert.equal(bestScore(rows), 5)
  assert.equal(bestScore(tally(cands, [{ answers: ['no', 'no'] }])), null, '全員不可なら最有力なし')
}

// 表示・ID・時刻の選択肢
{
  assert.equal(candLabel({ k: '2026-10-29', t: '19:00' }), '10/29(木) 19:00')
  assert.equal(candLabel({ k: '2026-11-01', t: '' }), '11/01(日)')
  assert.ok(isEventId('Ab3dEf7hJk'))
  assert.ok(!isEventId('abc'))
  assert.ok(!isEventId('Ab3dEf7hJ!'))
  assert.equal(TIME_OPTIONS[0], '07:00')
  assert.equal(TIME_OPTIONS[TIME_OPTIONS.length - 1], '22:00')
}

console.log('lib/tools/sorou/core: ok')
