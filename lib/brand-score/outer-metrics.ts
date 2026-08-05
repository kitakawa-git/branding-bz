// アウタースコアの算出ロジック（I/O を持たない純関数）
//
// 同じ式が outer-score API と calculate-snapshot.ts に完全複製されていたため、
// ここに一本化した。指標の重みや変換の閾値を変えるときはこのファイルだけを直す。
// 片方だけ直して画面とスナップショットが食い違う事故を防ぐのが目的。

/** 各指標の重み。合計 1.0 */
export const OUTER_WEIGHTS = {
  reach: 0.2,
  interest: 0.2,
  transition: 0.25,
  engagement: 0.2,
  impression: 0.15,
} as const

/** 0-100 にクランプ（四捨五入込みなのでスコアは整数になる） */
export function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)))
}

/**
 * 線形マッピング: 0→0, midValue→50, maxValue→100
 * midValue は「実務的な合格ライン」、maxValue は「これ以上は満点」の意味で使う。
 */
export function linearScore(value: number, midValue: number, maxValue: number): number {
  if (value <= 0) return 0
  if (value >= maxValue) return 100
  if (value <= midValue) {
    return (value / midValue) * 50
  }
  return 50 + ((value - midValue) / (maxValue - midValue)) * 50
}

/**
 * null の項目を分母から除いて加重平均を取る。
 *
 * 以前は「印象一致度が null だから残り85%で按分」と activeWeight を
 * 4項ベタ書きしていた。指標を増減するたびに分母の書き換えが必要で、
 * 直し漏れると 100 を超える。ここでは有効な項目の重みだけを足すので
 * 項目が増えても分母の式を触らなくてよい。
 *
 * 有効な項目が1つも無ければ null（0 ではない。「データが無い」と
 * 「スコアが0」は別物のため）。
 */
export function weightedAverage(
  entries: { score: number | null; weight: number }[]
): number | null {
  const active = entries.filter(
    (e): e is { score: number; weight: number } => e.score !== null && e.weight > 0
  )
  if (active.length === 0) return null

  const totalWeight = active.reduce((sum, e) => sum + e.weight, 0)
  if (totalWeight <= 0) return null

  const sum = active.reduce((acc, e) => acc + e.score * e.weight, 0)
  return clamp(sum / totalWeight)
}

/** デジタル接点（名刺・ブランドページのアクセスログ）の生カウント */
export interface DigitalRawCounts {
  /** 社員数 */
  members: number
  /** 名刺のユニーク訪問者数（IPベース） */
  uniqueVisitors: number
  /** 名刺のPV数 */
  totalCardViews: number
  /** vCard ダウンロード数 */
  vcardDownloads: number
  /** ブランドページへの遷移クリック数 */
  brandPageClicks: number
  /** ブランドページの平均滞在秒数 */
  avgDuration: number
}

export interface DigitalMetrics {
  /** 生の値（画面に「5.0回」「12.3%」と出すためのもの） */
  values: {
    reach: number
    interest: number
    transition: number
    engagement: number
  }
  scores: {
    reach: number
    interest: number
    transition: number
    engagement: number
  }
  /** 4指標＋印象一致度(null)の加重平均。従来の outer_score と同値 */
  digitalScore: number | null
}

/**
 * 生カウント → デジタル接点の4指標。
 * 取得（fetch）は呼び出し側の責務。ここは計算だけを持つ。
 *
 * 閾値は既存実装から変更していない:
 *   到達力   UU数 ÷ 社員数 × 10 をそのままクランプ
 *   関心度   DL率 %  → 0%→0, 10%→50, 20%→100
 *   遷移率   遷移率% → 0%→0,  5%→50, 15%→100
 *   関与度   平均秒  → 0s→0,  30s→50, 90s→100
 */
export function computeDigitalMetrics(raw: DigitalRawCounts): DigitalMetrics {
  const reachValue = raw.members > 0 ? (raw.uniqueVisitors / raw.members) * 10 : 0
  const interestPct =
    raw.totalCardViews > 0 ? (raw.vcardDownloads / raw.totalCardViews) * 100 : 0
  const transitionPct =
    raw.totalCardViews > 0 ? (raw.brandPageClicks / raw.totalCardViews) * 100 : 0
  const engagementValue = raw.avgDuration

  const scores = {
    reach: clamp(reachValue),
    interest: clamp(linearScore(interestPct, 10, 20)),
    transition: clamp(linearScore(transitionPct, 5, 15)),
    engagement: clamp(linearScore(engagementValue, 30, 90)),
  }

  // 印象一致度は未実装のため null。weightedAverage が分母から外す
  const digitalScore = weightedAverage([
    { score: scores.reach, weight: OUTER_WEIGHTS.reach },
    { score: scores.interest, weight: OUTER_WEIGHTS.interest },
    { score: scores.transition, weight: OUTER_WEIGHTS.transition },
    { score: scores.engagement, weight: OUTER_WEIGHTS.engagement },
    { score: null, weight: OUTER_WEIGHTS.impression },
  ])

  return {
    values: {
      reach: reachValue,
      interest: interestPct,
      transition: transitionPct,
      engagement: engagementValue,
    },
    scores,
    digitalScore,
  }
}
