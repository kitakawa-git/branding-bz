// 実行: npx tsx lib/brand-score/fetch-all-rows.test.ts
//
// このヘルパーは「PostgREST の1000行上限で黙って切り捨てられる」事故を防ぐためのもの。
// 取りこぼしは件数もエラーも出ないまま集計値がずれるので、必ずテストで固定する。
import assert from 'node:assert/strict'
import { fetchAllRows } from './fetch-all-rows'

const PAGE_SIZE = 1000

/** 指定件数の行を返す偽のクエリビルダ。呼ばれた range を記録する */
function fakeSource(total: number) {
  const calls: [number, number][] = []
  const make = () => ({
    range: async (from: number, to: number) => {
      calls.push([from, to])
      const rows: { i: number }[] = []
      for (let i = from; i <= Math.min(to, total - 1); i++) rows.push({ i })
      return { data: rows, error: null }
    },
  })
  return { make, calls }
}

/** 全行が順番どおりに揃っているか */
function assertSequential(rows: { i: number }[], total: number, label: string) {
  assert.equal(rows.length, total, `${label}: 件数`)
  for (let i = 0; i < total; i++) {
    assert.equal(rows[i].i, i, `${label}: ${i}番目の並び`)
  }
}

async function main() {
// ── 0件 ──
{
  const { make } = fakeSource(0)
  const { data, error } = await fetchAllRows<{ i: number }>(make)
  assert.equal(error, null)
  assert.deepEqual(data, [])
}

// ── 1ページに満たない ──
{
  const { make } = fakeSource(37)
  const { data } = await fetchAllRows<{ i: number }>(make)
  assertSequential(data!, 37, '37件')
}

// ── ちょうど1ページ（境界。ここを間違えると2ページ目を取りに行かない） ──
{
  const { make } = fakeSource(PAGE_SIZE)
  const { data } = await fetchAllRows<{ i: number }>(make)
  assertSequential(data!, PAGE_SIZE, 'ちょうど1000件')
}

// ── ちょうどバッチ境界（4ページ = 4000件） ──
{
  const { make } = fakeSource(PAGE_SIZE * 4)
  const { data } = await fetchAllRows<{ i: number }>(make)
  assertSequential(data!, PAGE_SIZE * 4, 'ちょうど4000件')
}

// ── 実データ相当（11,760件 = 12ページ） ──
{
  const { make, calls } = fakeSource(11760)
  const { data } = await fetchAllRows<{ i: number }>(make)
  assertSequential(data!, 11760, '11760件')
  // 12ページぶん。1ページずつ順番に待つと12往復だが、4件ずつまとめるので3往復
  assert.ok(calls.length >= 12, `12ページ以上を要求している（実際 ${calls.length}）`)
  assert.ok(calls.length <= 16, `空振りは1バッチぶんまで（実際 ${calls.length}）`)
}

// ── エラーはそのまま返す（部分的な結果を返さない） ──
{
  const make = () => ({
    range: async (from: number) => {
      if (from === 0) {
        return { data: Array.from({ length: PAGE_SIZE }, (_, i) => ({ i })), error: null }
      }
      return { data: null, error: { message: '失敗' } }
    },
  })
  const { data, error } = await fetchAllRows<{ i: number }>(make)
  assert.equal(data, null, 'エラー時は中途半端な行を返さない')
  assert.equal(error?.message, '失敗')
}

console.log('✓ fetch-all-rows: 全テスト通過')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
