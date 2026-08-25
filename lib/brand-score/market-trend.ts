// 市場浸透の推移の「隣り合う2点の比べ方」（I/O を持たない純関数）
// ============================================================
// 市場浸透スコアは「スコアが出ている段階の平均」なので、調査ごとに
// 設問の構成が変われば分母が変わる。
//
//   2025年: 認知・想起・評価・利用・推奨 の5段階 → 平均
//   2026年: 推奨の設問が無い              → 4段階の平均
//
// この2つの数字を素で引き算すると、実態が動いていなくても差が出る。
// 「推奨が抜けたぶん平均が上がった」を「浸透が進んだ」と読んでしまう。
//
// なので増減は必ず「両方の点にある段階だけ」で出し直してから取る。
// 段階構成が違うこと自体も画面に出す（黙って別物を比べない）。
// ============================================================
import { MARKET_STAGES, type MarketStage } from './market-stages'
import { computeMarketScore, MIN_SCORED_STAGES } from './market-stage-score'

/** 推移の1点。スコアが出ている段階だけ数値が入る */
export interface TrendStages {
  stages: Record<MarketStage, number | null>
}

/** スコアが出ている段階を並び順どおりに返す */
export function scoredStagesOf(point: TrendStages): MarketStage[] {
  return MARKET_STAGES.filter((s) => point.stages[s] !== null)
}

export interface TrendComparison {
  /** 両方の点でスコアが出ている段階 */
  commonStages: MarketStage[]
  /** 後の点にだけある段階 */
  added: MarketStage[]
  /** 前の点にだけある段階 */
  dropped: MarketStage[]
  /** 段階構成が同じか。false なら画面に注記を出す */
  sameComposition: boolean
  /** 共通段階だけで出し直した前の点のスコア */
  prevScore: number | null
  /** 共通段階だけで出し直した後の点のスコア */
  currScore: number | null
  /**
   * 増減。共通段階が MIN_SCORED_STAGES 未満なら null。
   * 「少ない段階だけで比べた差」は総合の増減として読めないため
   */
  delta: number | null
}

/** 共通段階だけを取り出して computeMarketScore に掛け直す */
function scoreOver(point: TrendStages, stages: MarketStage[]): number | null {
  return computeMarketScore(
    stages.map((s) => ({ status: 'scored' as const, score: point.stages[s] }))
  )
}

/**
 * 隣り合う2点を比べる。
 * prev が無い（最初の点）ときは呼ばない前提。
 */
export function compareTrendPoints(
  prev: TrendStages,
  curr: TrendStages
): TrendComparison {
  const prevScored = scoredStagesOf(prev)
  const currScored = scoredStagesOf(curr)
  const prevSet = new Set(prevScored)
  const currSet = new Set(currScored)

  const commonStages = MARKET_STAGES.filter((s) => prevSet.has(s) && currSet.has(s))
  const added = currScored.filter((s) => !prevSet.has(s))
  const dropped = prevScored.filter((s) => !currSet.has(s))

  const enough = commonStages.length >= MIN_SCORED_STAGES
  const prevScore = enough ? scoreOver(prev, commonStages) : null
  const currScore = enough ? scoreOver(curr, commonStages) : null

  return {
    commonStages,
    added,
    dropped,
    sameComposition: added.length === 0 && dropped.length === 0,
    prevScore,
    currScore,
    delta:
      prevScore !== null && currScore !== null
        ? Math.round((currScore - prevScore) * 10) / 10
        : null,
  }
}
