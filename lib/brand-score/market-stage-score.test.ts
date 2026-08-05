// 市場調査の段階スコア変換のテスト
// 実行: npx tsx lib/brand-score/market-stage-score.test.ts
import assert from 'node:assert/strict'
import {
  MIN_BENCHMARK_BASE_N,
  computeStageScore,
  computeMarketScore,
  applyMethod,
  resolveStageMethod,
  defaultStageParams,
  DEFAULT_STAGE_METHOD,
  type MappedCell,
} from './market-stage-score'

// 本体を波括弧で書く（`=> ({...})` は直後の素のブロックと組み合わさると
// パーサが引数の分割代入と誤認する）
function mine(value: number | null, baseN: number | null = 220, weight = 1): MappedCell {
  return { value, baseN, weight, subject: 'self' }
}

function rival(value: number, name: string): MappedCell {
  return { value, baseN: 220, weight: 1, subject: 'competitor', competitorName: name }
}

// ────────────────────────────────────────────
// 1. 実データでの変換（リィツメディカル 2025年調査）
// ────────────────────────────────────────────
{
  // 認知 77.3% → linear(50, 90)
  const awareness = computeStageScore('awareness', [mine(77.2727272727273)])
  assert.equal(awareness.status, 'scored')
  assert.equal(awareness.rawPercent, 77.3)
  assert.equal(awareness.score, 84, '77.3% → 84点')
  assert.equal(awareness.baseN, 220)

  // 第1想起 16.8% → linear(10, 30)
  // 生の%をそのまま使うと16.8点。業界トップの数字が最低評価になってしまう
  const recall = computeStageScore('recall', [mine(16.8181818181818)])
  assert.equal(recall.rawPercent, 16.8)
  assert.equal(recall.score, 67, '16.8% → 67点（そのままなら17点）')
  assert.ok(recall.score! > recall.rawPercent!, '物差しを当てた結果、生値より高くなる')

  // 利用 70.6%（認知者ベース n=170）→ linear(50, 85)
  // 「導入経験あり・計」は構造的に高く出るので mid を50に置いている
  const usage = computeStageScore('usage', [mine(70.5882352941177, 170)])
  assert.equal(usage.score, 79, '70.6% → 79点（振り切れない）')
  assert.equal(usage.baseN, 170, 'ベースNは220ではなく170')

  // 評価 78.0%（ロイヤリティあり・計）→ linear(60, 90)
  assert.equal(computeStageScore('evaluation', [mine(78.021978021978, 182)]).score, 80)
  // 推奨 65.4%（推奨意向あり・計）→ linear(50, 85)
  assert.equal(computeStageScore('advocacy', [mine(65.3846153846154, 182)]).score, 72)
}

// ────────────────────────────────────────────
// 2. 未計測（absent）と未割当（unmapped）を区別する
// ────────────────────────────────────────────
{
  const absent = computeStageScore('advocacy', [], DEFAULT_STAGE_METHOD.advocacy, true)
  assert.equal(absent.status, 'absent')
  assert.equal(absent.score, null, '未計測を0点にしない')

  const unmapped = computeStageScore('advocacy', [])
  assert.equal(unmapped.status, 'unmapped')
  assert.equal(unmapped.score, null)

  // 値が読めなかったセルだけを割り当てても scored にしない
  const nullOnly = computeStageScore('awareness', [mine(null)])
  assert.equal(nullOnly.status, 'unmapped')
  assert.equal(nullOnly.score, null, 'null を 0 として扱わない')
}

// ────────────────────────────────────────────
// 3. 複数セルの加重平均
// ────────────────────────────────────────────
{
  // イメージ10項目をまとめて評価段階に割り当てるケース
  const r = computeStageScore('evaluation', [mine(48.2), mine(24.7), mine(48.8)])
  assert.equal(r.rawPercent, 40.6, '(48.2+24.7+48.8)/3')

  // 重み付き
  const w = computeStageScore('evaluation', [mine(60, 220, 3), mine(20, 220, 1)])
  assert.equal(w.rawPercent, 50, '(60*3+20*1)/4')

  // ベースNが割れていたら採用しない（比較できない数字を1つに見せない）
  const mixed = computeStageScore('evaluation', [mine(50, 220), mine(50, 170)])
  assert.equal(mixed.baseN, null)
}

// ────────────────────────────────────────────
// 4. 競合ベンチマーク（スコア本体には影響しない）
// ────────────────────────────────────────────
{
  const cells = [
    mine(77.2727272727273),
    rival(85, 'はんだや'),
    rival(15.9090909090909, 'ユニハイト'),
    rival(24.5454545454545, 'ジャメックス'),
  ]
  const r = computeStageScore('awareness', cells)

  assert.equal(r.score, 84, '競合を足してもスコア本体は変わらない')
  assert.equal(r.benchmark?.competitorMax, 85)
  assert.equal(r.benchmark?.rank, 2, '85% の1社だけが上なので2位')
  assert.equal(r.benchmark?.n, 4, '自社を含めた比較対象数')
  assert.equal(r.benchmark?.competitorAvg, 41.8, '(85+15.9+24.5)/3')

  // 競合が居なければ benchmark は null
  assert.equal(computeStageScore('awareness', [mine(77.3)]).benchmark, null)
}

// ────────────────────────────────────────────
// 5. 物差しの種類
// ────────────────────────────────────────────
{
  assert.equal(applyMethod(77.3, { kind: 'raw' }, null), 77)
  assert.equal(applyMethod(50, { kind: 'linear', mid: 50, max: 90 }, null), 50, 'mid で50点')
  assert.equal(applyMethod(90, { kind: 'linear', mid: 50, max: 90 }, null), 100, 'max で100点')
  assert.equal(applyMethod(0, { kind: 'linear', mid: 50, max: 90 }, null), 0)

  // share_of_top は競合トップとの比
  const bm = { competitorMax: 85, competitorAvg: 40, rank: 2, n: 4, excluded: 0 }
  assert.equal(applyMethod(77.3, { kind: 'share_of_top' }, bm), 91, '77.3/85')
  // 競合が居なければ生値に落とす（0除算しない）
  assert.equal(applyMethod(77.3, { kind: 'share_of_top' }, null), 77)
  assert.equal(
    applyMethod(50, { kind: 'share_of_top' }, { ...bm, competitorMax: 0 }),
    50
  )
}

// ────────────────────────────────────────────
// 6. 市場浸透スコア（absent は分母から外す）
// ────────────────────────────────────────────
{
  // 実データ想定: 推奨の設問が無いので4段階だけ
  const score = computeMarketScore([
    { status: 'scored', score: 84 },
    { status: 'scored', score: 67 },
    { status: 'scored', score: 71 },
    { status: 'scored', score: 100 },
    { status: 'absent', score: null },
  ])
  assert.equal(score, 81, '(84+67+71+100)/4 = 80.5 → 81。absent は分母に入れない')

  // 3段階未満は全体像が見えないので出さない
  assert.equal(
    computeMarketScore([
      { status: 'scored', score: 84 },
      { status: 'scored', score: 67 },
      { status: 'unmapped', score: null },
      { status: 'unmapped', score: null },
      { status: 'unmapped', score: null },
    ]),
    null,
    '2段階だけでは市場浸透スコアを出さない'
  )

  // ちょうど3段階なら出す
  assert.equal(
    computeMarketScore([
      { status: 'scored', score: 60 },
      { status: 'scored', score: 60 },
      { status: 'scored', score: 60 },
      { status: 'absent', score: null },
      { status: 'unmapped', score: null },
    ]),
    60
  )

  assert.equal(computeMarketScore([]), null)
}

// ────────────────────────────────────────────
// 7. 保存済みパラメータの復元（壊れていれば既定値）
// ────────────────────────────────────────────
{
  const params = { awareness: { kind: 'linear', mid: 40, max: 80 } }
  assert.deepEqual(resolveStageMethod('awareness', params), {
    kind: 'linear',
    mid: 40,
    max: 80,
  })
  // 保存されていない段階は既定値
  assert.deepEqual(resolveStageMethod('recall', params), DEFAULT_STAGE_METHOD.recall)
  // 壊れた値は既定値に落とす（mid >= max は不正）
  assert.deepEqual(
    resolveStageMethod('awareness', { awareness: { kind: 'linear', mid: 90, max: 50 } }),
    DEFAULT_STAGE_METHOD.awareness
  )
  assert.deepEqual(resolveStageMethod('awareness', null), DEFAULT_STAGE_METHOD.awareness)
  assert.deepEqual(resolveStageMethod('awareness', 'こわれた'), DEFAULT_STAGE_METHOD.awareness)

  const d = defaultStageParams()
  assert.equal(Object.keys(d).length, 5)
  assert.deepEqual(d.awareness, DEFAULT_STAGE_METHOD.awareness)
}

console.log('✓ market-stage-score: 全テスト通過')

// ────────────────────────────────────────────
// 7. 母数の小さい競合はベンチマークから外す
// ────────────────────────────────────────────
{
  // 実データ（2026年 眼科医調査・ロイヤリティ）を縮めたもの。
  // キシヤは n=27 で 81.5% だが、母数不足なので順位には入れない
  const cells: MappedCell[] = [
    { value: 78.0, baseN: 182, weight: 1, subject: 'self' },
    { value: 81.5, baseN: 27, weight: 1, subject: 'competitor', competitorName: 'キシヤ' },
    { value: 76.8, baseN: 56, weight: 1, subject: 'competitor', competitorName: 'B社' },
    { value: 71.4, baseN: 189, weight: 1, subject: 'competitor', competitorName: 'C社' },
  ]
  const r = computeStageScore('evaluation', cells, { kind: 'raw' })
  assert.equal(r.benchmark?.rank, 1, '母数不足の1社を外せば自社が1位')
  assert.equal(r.benchmark?.excluded, 1)
  assert.equal(r.benchmark?.n, 3, '外したぶんは比較対象数に含めない')
  assert.equal(r.benchmark?.competitorMax, 76.8)

  // 母数が読めないセルは判断材料が無いので残す
  const unknown: MappedCell[] = [
    { value: 78.0, baseN: null, weight: 1, subject: 'self' },
    { value: 90, baseN: null, weight: 1, subject: 'competitor', competitorName: 'D社' },
  ]
  const r2 = computeStageScore('evaluation', unknown, { kind: 'raw' })
  assert.equal(r2.benchmark?.rank, 2)
  assert.equal(r2.benchmark?.excluded, 0)

  assert.equal(MIN_BENCHMARK_BASE_N, 50)
}
