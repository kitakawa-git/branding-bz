// 市場調査の値 → 0〜100 の段階スコア。I/O を持たない純関数。
// ============================================================
// %をそのままスコアにすると実態と合わない。
// 例: 第1想起16.8% は業界トップの数字だが、そのまま16.8点にすると
//     「最低評価」に見えてしまう。段階ごとに変換の物差しを変える。
//
// mid = その段階の実務的な合格ライン（50点になる点）
// max = 業界トップ相当（100点）
//
// ⚠️ 相対値（競合トップとの比）を既定にしない理由:
//    競合セットは調査ごとに変わる。比率で作った指標は母集団が動いた瞬間に
//    前年比が壊れる。スコア本体は絶対値で出し、競合との比較は benchmark に
//    別で持って表示にだけ使う。
//
// ⚠️ 変換パラメータは調査ごとに market_surveys.stage_params へ凍結する。
//    既定値を後で変えても、過去の調査のスコアが動かないようにするため。
// ============================================================
import { clamp, linearScore } from './outer-metrics'
import { MARKET_STAGES, type MarketStage, type MarketStageStatus } from './market-stages'

export type StageMethod =
  | { kind: 'linear'; mid: number; max: number }
  | { kind: 'raw' }
  /** 自社% ÷ 競合最大% × 100。既定にはしない（上のコメント参照） */
  | { kind: 'share_of_top' }

/**
 * 段階ごとの既定の物差し。
 * 初回の取り込み結果を見て調整する前提の初期値。
 */
export const DEFAULT_STAGE_METHOD: Record<MarketStage, StageMethod> = {
  awareness: { kind: 'linear', mid: 50, max: 90 },
  recall: { kind: 'linear', mid: 10, max: 30 },
  evaluation: { kind: 'linear', mid: 35, max: 60 },
  usage: { kind: 'linear', mid: 20, max: 50 },
  advocacy: { kind: 'linear', mid: 25, max: 55 },
}

/** 市場浸透スコアを出すのに最低限必要な段階数。これを下回れば null */
export const MIN_SCORED_STAGES = 3

/** 段階に割り当てられた1セル分 */
export interface MappedCell {
  value: number | null
  baseN: number | null
  weight: number
  subject: 'self' | 'competitor'
  competitorName?: string | null
}

export interface StageBenchmark {
  /** 競合の最大値 */
  competitorMax: number
  /** 競合の平均 */
  competitorAvg: number
  /** 自社を含めた順位（1が最上位） */
  rank: number
  /** 比較対象数（自社を含む） */
  n: number
}

export interface StageComputation {
  stage: MarketStage
  status: MarketStageStatus
  /** 自社の生の値（%）。加重平均後 */
  rawPercent: number | null
  score: number | null
  method: StageMethod
  benchmark: StageBenchmark | null
  baseN: number | null
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

/** 物差しを当てて 0-100 にする */
export function applyMethod(
  rawPercent: number,
  method: StageMethod,
  benchmark: StageBenchmark | null
): number {
  switch (method.kind) {
    case 'raw':
      return clamp(rawPercent)
    case 'share_of_top': {
      // 競合が居ない・トップが0なら比を取れないので生値に落とす
      if (!benchmark || benchmark.competitorMax <= 0) return clamp(rawPercent)
      return clamp((rawPercent / benchmark.competitorMax) * 100)
    }
    case 'linear':
    default:
      return clamp(linearScore(rawPercent, method.mid, method.max))
  }
}

/**
 * 1段階のスコアを出す。
 *
 * absent（この調査に該当設問が無い）は呼び出し側が明示する。
 * 未割当と区別しないと「未計測」を0点として扱ってしまう。
 */
export function computeStageScore(
  stage: MarketStage,
  cells: MappedCell[],
  method: StageMethod = DEFAULT_STAGE_METHOD[stage],
  absent = false
): StageComputation {
  const empty: StageComputation = {
    stage,
    status: absent ? 'absent' : 'unmapped',
    rawPercent: null,
    score: null,
    method,
    benchmark: null,
    baseN: null,
  }

  if (absent) return empty

  // 値が読めているものだけを対象にする（null は 0 として扱わない）
  const selfCells = cells.filter(
    (c) => c.subject === 'self' && c.value !== null && c.weight > 0
  )
  if (selfCells.length === 0) return empty

  // 自社が複数セルに割り当てられていれば加重平均
  const totalWeight = selfCells.reduce((s, c) => s + c.weight, 0)
  const rawPercent =
    selfCells.reduce((s, c) => s + (c.value as number) * c.weight, 0) / totalWeight

  // ベースNは割り当てたセルで揃っていれば採用、割れていれば null
  const baseNs = new Set(
    selfCells.map((c) => c.baseN).filter((n): n is number => n !== null)
  )
  const baseN = baseNs.size === 1 ? [...baseNs][0] : null

  // 競合との比較。スコア本体には入れず表示にだけ使う
  const competitorValues = cells
    .filter((c) => c.subject === 'competitor' && c.value !== null)
    .map((c) => c.value as number)

  let benchmark: StageBenchmark | null = null
  if (competitorValues.length > 0) {
    const competitorMax = Math.max(...competitorValues)
    const competitorAvg =
      competitorValues.reduce((s, v) => s + v, 0) / competitorValues.length
    const higher = competitorValues.filter((v) => v > rawPercent).length
    benchmark = {
      competitorMax: round1(competitorMax),
      competitorAvg: round1(competitorAvg),
      rank: higher + 1,
      n: competitorValues.length + 1,
    }
  }

  return {
    stage,
    status: 'scored',
    rawPercent: round1(rawPercent),
    score: applyMethod(rawPercent, method, benchmark),
    method,
    benchmark,
    baseN,
  }
}

/**
 * 段階スコアから市場浸透スコアを出す。
 *
 * absent（未計測）は分母から外す。scored が MIN_SCORED_STAGES 未満なら
 * 全体像が見えないので null を返す（部分的な段階だけで総合値を出さない）。
 */
export function computeMarketScore(
  stages: { status: MarketStageStatus; score: number | null }[]
): number | null {
  const scored = stages.filter(
    (s): s is { status: 'scored'; score: number } =>
      s.status === 'scored' && s.score !== null
  )
  if (scored.length < MIN_SCORED_STAGES) return null
  return clamp(scored.reduce((sum, s) => sum + s.score, 0) / scored.length)
}

/** 保存済みの stage_params から物差しを取り出す（壊れていれば既定値） */
export function resolveStageMethod(
  stage: MarketStage,
  stageParams: unknown
): StageMethod {
  const fallback = DEFAULT_STAGE_METHOD[stage]
  if (!stageParams || typeof stageParams !== 'object') return fallback

  const raw = (stageParams as Record<string, unknown>)[stage]
  if (!raw || typeof raw !== 'object') return fallback

  const m = raw as Record<string, unknown>
  if (m.kind === 'raw') return { kind: 'raw' }
  if (m.kind === 'share_of_top') return { kind: 'share_of_top' }
  if (
    m.kind === 'linear' &&
    typeof m.mid === 'number' &&
    typeof m.max === 'number' &&
    m.mid > 0 &&
    m.max > m.mid
  ) {
    return { kind: 'linear', mid: m.mid, max: m.max }
  }
  return fallback
}

/** 既定の物差し一式（取り込み時に凍結する初期値） */
export function defaultStageParams(): Record<string, StageMethod> {
  const out: Record<string, StageMethod> = {}
  for (const s of MARKET_STAGES) out[s] = DEFAULT_STAGE_METHOD[s]
  return out
}
