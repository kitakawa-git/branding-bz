// 実行: npx tsx lib/brand-score/market-trend.test.ts
//
// 段階構成が変わった年をまたぐと、素の引き算では実態と逆の読みになる。
// そこを固定するためのテスト。
import assert from 'node:assert/strict'
import { compareTrendPoints, scoredStagesOf } from './market-trend'
import type { MarketStage } from './market-stages'

type Stages = Record<MarketStage, number | null>
function p(v: Partial<Stages>): { stages: Stages } {
  return {
    stages: {
      awareness: null,
      recall: null,
      evaluation: null,
      usage: null,
      advocacy: null,
      ...v,
    },
  }
}

// ── scoredStagesOf は並び順どおり ──
{
  assert.deepEqual(
    scoredStagesOf(p({ advocacy: 70, awareness: 90 })),
    ['awareness', 'advocacy'],
    'MARKET_STAGES の順で返す'
  )
}

// ── 構成が同じなら素の差と一致する ──
{
  const prev = p({ awareness: 80, recall: 40, evaluation: 60, usage: 50, advocacy: 50 })
  const curr = p({ awareness: 90, recall: 40, evaluation: 60, usage: 50, advocacy: 50 })
  const r = compareTrendPoints(prev, curr)
  assert.equal(r.sameComposition, true)
  assert.deepEqual(r.added, [])
  assert.deepEqual(r.dropped, [])
  assert.equal(r.commonStages.length, 5)
  // 平均が 56 → 58
  assert.equal(r.prevScore, 56)
  assert.equal(r.currScore, 58)
  assert.equal(r.delta, 2)
}

// ── 段階が抜けた年: 素の引き算だと「上がった」に見えるケース ──
{
  // 推奨(20)が低く、それが翌年に無くなった。他の段階は横ばい
  const prev = p({ awareness: 80, recall: 40, evaluation: 60, usage: 60, advocacy: 20 })
  const curr = p({ awareness: 80, recall: 40, evaluation: 60, usage: 60 })

  // 素の全段階平均で比べると 52 → 60 で「+8」に見える
  const naivePrev = (80 + 40 + 60 + 60 + 20) / 5
  const naiveCurr = (80 + 40 + 60 + 60) / 4
  assert.equal(naivePrev, 52)
  assert.equal(naiveCurr, 60)

  const r = compareTrendPoints(prev, curr)
  assert.equal(r.sameComposition, false, '構成が違うことを検出する')
  assert.deepEqual(r.dropped, ['advocacy'])
  assert.deepEqual(r.added, [])
  assert.deepEqual(r.commonStages, ['awareness', 'recall', 'evaluation', 'usage'])
  // 共通段階だけなら横ばい。素の引き算の +8 は分母が変わっただけだった
  assert.equal(r.prevScore, 60)
  assert.equal(r.currScore, 60)
  assert.equal(r.delta, 0)
}

// ── 段階が増えた年 ──
{
  const prev = p({ awareness: 80, recall: 40, evaluation: 60 })
  const curr = p({ awareness: 90, recall: 40, evaluation: 60, advocacy: 10 })
  const r = compareTrendPoints(prev, curr)
  assert.equal(r.sameComposition, false)
  assert.deepEqual(r.added, ['advocacy'])
  assert.deepEqual(r.dropped, [])
  // computeMarketScore は clamp（Math.round）を通すのでスコアは整数。
  // 共通3段階で 60 → 63（63.33 が丸められる）
  assert.equal(r.prevScore, 60)
  assert.equal(r.currScore, 63)
  assert.equal(r.delta, 3)
}

// ── 共通段階が3つ未満なら増減を出さない ──
{
  const prev = p({ awareness: 80, recall: 40, evaluation: 60 })
  const curr = p({ awareness: 90, usage: 70, advocacy: 50 })
  const r = compareTrendPoints(prev, curr)
  assert.deepEqual(r.commonStages, ['awareness'])
  assert.equal(r.prevScore, null)
  assert.equal(r.currScore, null)
  assert.equal(r.delta, null, '1段階だけの差は総合の増減として読めない')
}

// ── ちょうど3段階なら出す（MIN_SCORED_STAGES の境界） ──
{
  const prev = p({ awareness: 80, recall: 40, evaluation: 60, usage: 99 })
  const curr = p({ awareness: 80, recall: 40, evaluation: 90, advocacy: 99 })
  const r = compareTrendPoints(prev, curr)
  assert.deepEqual(r.commonStages, ['awareness', 'recall', 'evaluation'])
  assert.equal(r.prevScore, 60)
  assert.equal(r.currScore, 70)
  assert.equal(r.delta, 10)
}

console.log('✓ market-trend: 全テスト通過')
