// GT集計表から「5段階以外の読みどころ」を取り出す（I/O を持たない純関数）
// ============================================================
// 5段階（認知→想起→評価→利用→推奨）は定点観測の基準なので、
// 設問の割り当てを人が決める前提で作ってある。
// 一方でここで扱うのは、割り当てを決めなくても構造から機械的に読める情報。
//
//   1. 印象一致度   市場が重視する点（Q5）× 自社イメージ（Q6）
//   2. パーソナリティ SD法の対語（Q14）
//   3. 認知経路     どこで見聞きしたか（Q9）
//   4. 事業浸透度   自社サービス別の導入率（Q12）
//   5. サービス評価  導入者による評価（Q13）
//
// ⚠️ 設問コード（q5, q6 …）では判定しない。調査会社・年度で番号が変わるため。
//    列見出しと設問文の言い回しで拾う（market-auto-map.ts と同じ考え方）。
// ⚠️ どれも「取れなければ null」。無理に0を返すと、測っていないものを
//    低評価として扱うことになる。
// ============================================================

import { normalizeCompanyName } from './market-auto-map'

/** GT表のブロック（設問1つぶん）。API が返す形をそのまま受ける */
export interface ExtraBlock {
  id: string
  question_code: string | null
  question_text: string | null
  answer_type_raw?: string | null
  is_attribute?: boolean | null
}

/** GT表のセル（1マス） */
export interface ExtraCell {
  block_id: string
  row_label: string
  col_label: string | null
  value: number | null
  base_n: number | null
}

export interface RankedItem {
  label: string
  value: number
}

/** 市場の重視点と自社イメージの突き合わせ */
export interface ImpressionMatch {
  label: string
  /** 市場が重視する順位（1が最上位） */
  importanceRank: number
  importanceValue: number
  /** 自社イメージとして挙がる順位 */
  imageRank: number
  imageValue: number
}

export interface ImpressionFit {
  /** 市場が重視する点（降順） */
  importance: RankedItem[]
  /** 自社のイメージ（降順） */
  image: RankedItem[]
  /** 両方に出てくる項目を、市場の重視順に並べたもの */
  matches: ImpressionMatch[]
  /** 市場トップ5のうち、自社イメージでもトップ5に入っているもの */
  hits: string[]
  /** 同じく、入っていないもの（＝伝わっていない期待） */
  misses: string[]
  /** 自社イメージ上位のうち、市場トップ5に入っていないもの（＝伝わりすぎ） */
  overs: string[]
  /** 印象一致度 0-100。項目が足りなければ null */
  score: number | null
  importanceBaseN: number | null
  imageBaseN: number | null
}

/** SD法（対語5段階）の1項目 */
export interface PersonalityItem {
  /** 肯定側の語（「誠実な」） */
  positive: string
  /** 否定側の語（「いい加減な」） */
  negative: string
  /** 肯定側に寄った人の割合（%） */
  value: number
}

export interface ServiceItem {
  label: string
  value: number
}

export interface MarketExtras {
  impression: ImpressionFit | null
  personality: { items: PersonalityItem[]; baseN: number | null } | null
  contactPoints: { items: RankedItem[]; baseN: number | null } | null
  services: { items: ServiceItem[]; baseN: number | null } | null
  serviceEvaluation: { items: RankedItem[]; baseN: number | null } | null
}

/**
 * 集計表の「中身ではない列」。
 * 回答個数の集計行や「あてはまるものはない」は項目として並べると邪魔になる。
 */
const NOISE_LABEL = /^(回答個数|あてはまるものはない|あてはまるものはひとつもない|その他$|不明|無回答)/

function isNoise(label: string | null | undefined): boolean {
  if (!label) return true
  return NOISE_LABEL.test(label.trim())
}

function toRanked(cells: ExtraCell[], key: 'col_label' | 'row_label'): RankedItem[] {
  return cells
    .filter((c) => c.value !== null && !isNoise(c[key]))
    .map((c) => ({ label: (c[key] as string).trim(), value: c.value as number }))
    .sort((a, b) => b.value - a.value)
}

function firstBaseN(cells: ExtraCell[]): number | null {
  return cells.find((c) => c.base_n !== null)?.base_n ?? null
}

/** 印象一致度を出すときに見る上位件数 */
export const IMPRESSION_TOP_N = 5

/**
 * 市場が重視する点と自社イメージの一致度。
 *
 * ⚠️ 重視点は全数ベース、イメージは自社認知者ベースで母数が違う。
 *    「70.9% と 25.3% の差は45.6pt」のような引き算はできない。
 *    比べてよいのは順位だけ。調査会社のレポートも順位で語っている。
 */
export function computeImpressionFit(
  importance: RankedItem[],
  image: RankedItem[],
  importanceBaseN: number | null,
  imageBaseN: number | null
): ImpressionFit {
  const imageRankOf = new Map(image.map((it, i) => [it.label, i + 1]))
  const imageValueOf = new Map(image.map((it) => [it.label, it.value]))

  const matches: ImpressionMatch[] = importance
    .map((it, i) => {
      const rank = imageRankOf.get(it.label)
      if (rank === undefined) return null
      return {
        label: it.label,
        importanceRank: i + 1,
        importanceValue: it.value,
        imageRank: rank,
        imageValue: imageValueOf.get(it.label) as number,
      }
    })
    .filter((m): m is ImpressionMatch => m !== null)

  const marketTop = importance.slice(0, IMPRESSION_TOP_N).map((i) => i.label)
  const imageTop = image.slice(0, IMPRESSION_TOP_N).map((i) => i.label)

  const hits = marketTop.filter((l) => imageTop.includes(l))
  const misses = marketTop.filter((l) => !imageTop.includes(l))
  const overs = imageTop.filter((l) => !marketTop.includes(l))

  // 「市場が重視する上位5つのうち、自社の印象としても上位5つに入っている数」。
  // 20点刻みで粗いが、何が当たって何が外れているかをそのまま言えるのが利点。
  // 相関係数だと、重視されていない項目どうしの一致で点が上振れする
  //（実データでスピアマンを取ると90点になり、品質が伝わっていない実態と合わない）
  const score =
    importance.length >= IMPRESSION_TOP_N && image.length >= IMPRESSION_TOP_N
      ? Math.round((hits.length / IMPRESSION_TOP_N) * 100)
      : null

  return { importance, image, matches, hits, misses, overs, score, importanceBaseN, imageBaseN }
}

/**
 * GT表から5つの読みどころを取り出す。
 *
 * @param selfName 自社名。5段階の割り当て（subject='self'）の行ラベルから取る
 */
export function extractMarketExtras(
  blocks: ExtraBlock[],
  cells: ExtraCell[],
  selfName: string | null
): MarketExtras {
  const empty: MarketExtras = {
    impression: null,
    personality: null,
    contactPoints: null,
    services: null,
    serviceEvaluation: null,
  }
  if (!selfName) return empty

  const self = normalizeCompanyName(selfName)
  const byBlock = new Map<string, ExtraCell[]>()
  for (const c of cells) {
    const list = byBlock.get(c.block_id)
    if (list) list.push(c)
    else byBlock.set(c.block_id, [c])
  }

  const target = blocks.filter((b) => !b.is_attribute)
  const textOf = (b: ExtraBlock) => b.question_text ?? ''
  const cellsOf = (b: ExtraBlock) => byBlock.get(b.id) ?? []
  const selfRows = (b: ExtraBlock) =>
    cellsOf(b).filter((c) => normalizeCompanyName(c.row_label) === self)
  /** 設問文が自社について聞いているもの（「リィツメディカルについてお聞きします」） */
  const isAboutSelf = (b: ExtraBlock) => normalizeCompanyName(textOf(b)).includes(self)

  // ── 1. 市場が重視する点（複数回答のほう。「最も重視する」単一回答ではない）
  const importanceBlock = target.find(
    (b) => textOf(b).includes('重視') && cellsOf(b).length > 0
  )
  let importance: RankedItem[] = []
  let importanceBaseN: number | null = null
  if (importanceBlock) {
    const all = cellsOf(importanceBlock)
    const multi = all.filter(
      (c) => c.row_label.includes('いくつでも') || c.row_label.includes('すべて')
    )
    const picked = multi.length > 0 ? multi : all
    importance = toRanked(picked, 'col_label')
    importanceBaseN = firstBaseN(picked)
  }

  // ── 2. 自社イメージ（企業ごとの行がある設問。SD法の対語ブロックは行が社名でないので外れる）
  const imageBlock = target.find(
    (b) => textOf(b).includes('イメージ') && selfRows(b).length > 0 && !isAboutSelf(b)
  )
  let image: RankedItem[] = []
  let imageBaseN: number | null = null
  if (imageBlock) {
    const rows = selfRows(imageBlock)
    image = toRanked(rows, 'col_label')
    imageBaseN = firstBaseN(rows)
  }

  const impression =
    importance.length > 0 && image.length > 0
      ? computeImpressionFit(importance, image, importanceBaseN, imageBaseN)
      : null

  // ── 3. ブランドパーソナリティ（SD法。「Aに近い・計」が肯定側に寄った割合）
  const personalityCells = cells.filter(
    (c) =>
      (c.col_label ?? '').startsWith('Aに近い') &&
      c.value !== null &&
      c.row_label.includes(':')
  )
  const personality =
    personalityCells.length > 0
      ? {
          items: personalityCells
            .map((c) => {
              const [positive, negative] = c.row_label.split(':')
              return {
                positive: positive.trim(),
                negative: (negative ?? '').trim(),
                value: c.value as number,
              }
            })
            .sort((a, b) => b.value - a.value),
          baseN: firstBaseN(personalityCells),
        }
      : null

  // ── 4. 認知経路（どこで見聞きしたか）
  const contactBlock = target.find(
    (b) =>
      (textOf(b).includes('情報源') || textOf(b).includes('見聞き')) &&
      selfRows(b).length > 0
  )
  const contactPoints = contactBlock
    ? {
        items: toRanked(selfRows(contactBlock), 'col_label'),
        baseN: firstBaseN(selfRows(contactBlock)),
      }
    : null

  // ── 5. 事業浸透度（自社のサービス別の導入率）。
  //     全社を並べる導入設問と紛らわしいので、設問文が自社について聞いているものに限る
  const serviceCells = cells.filter((c) => {
    if (c.value === null || !(c.col_label ?? '').includes('導入・購入経験あり')) return false
    const b = blocks.find((x) => x.id === c.block_id)
    return b ? isAboutSelf(b) : false
  })
  const services =
    serviceCells.length > 0
      ? {
          items: serviceCells
            .map((c) => ({ label: c.row_label.trim(), value: c.value as number }))
            .sort((a, b) => b.value - a.value),
          baseN: firstBaseN(serviceCells),
        }
      : null

  // ── 6. サービス評価（導入者による評価。「あてはまる・計」）
  const evalCells = cells.filter((c) => {
    if (c.value === null || (c.col_label ?? '').trim() !== 'あてはまる・計') return false
    const b = blocks.find((x) => x.id === c.block_id)
    return b ? isAboutSelf(b) : false
  })
  const serviceEvaluation =
    evalCells.length > 0
      ? { items: toRanked(evalCells, 'row_label'), baseN: firstBaseN(evalCells) }
      : null

  return { impression, personality, contactPoints, services, serviceEvaluation }
}
