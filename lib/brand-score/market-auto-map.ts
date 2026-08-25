// 市場調査の5段階への「候補の自動割り当て」。I/O を持たない純関数。
// ============================================================
// 41設問×数十セルを人が全部当てるのは現実的でないため、機械的に候補を出す。
// 確定はしない。提案を画面に出して人が確認・修正する前提。
//
// 判定は調査会社の列ラベルの規約に乗る。実データで2025年版と2026年版の
// 両方に同じ規約があることを確認している:
//   認知・計 / 導入・購入経験あり・計 / ロイヤリティあり・計 / 推奨意向あり・計
//   純粋想起は設問文の末尾に【第1想起】【全体想起】
//
// ⚠️ 規約が違う調査会社では当たらない。そのときは提案0件になるだけで、
//    手動割り当ての邪魔はしない（誤った候補を出すより出さないほうがよい）。
// ============================================================
import { MARKET_STAGES, type MarketStage } from './market-stages'
// 「その他」「あてはまるものはない」等の受け皿行。market-extras と共有する
import { isNoiseLabel } from './market-labels'

export interface AutoMapBlock {
  id: string
  questionCode: string
  questionText: string
  isAttribute: boolean
  columns: { code: string | null; label: string }[] | null
}

export interface AutoMapCell {
  id: string
  blockId: string
  rowLabel: string
  colLabel: string | null
  value: number | null
  baseN: number | null
  kind: string
}

export interface AutoMapProposal {
  stage: MarketStage
  cellId: string
  /** 同じ列に並ぶ他社のセル。競合として一緒に登録する */
  competitorCellIds: { cellId: string; name: string }[]
  questionCode: string
  rowLabel: string
  colLabel: string | null
  value: number
  baseN: number | null
  /** 候補の確からしさ。exact = 列ラベルが規約に一致 */
  confidence: 'exact' | 'likely'
  reason: string
}

export interface AutoMapResult {
  proposals: AutoMapProposal[]
  /** 候補が見つからなかった段階 */
  missing: MarketStage[]
  /** 自社行と判定した表記（表記ゆれの確認用に返す） */
  matchedSelfLabels: string[]
}

/**
 * 社名の表記ゆれを吸収する。
 * 実データに「リィツメディカル」と「リッツメディカル」の両方が存在するため、
 * 小書き仮名を落として比較する。法人格・記号・空白も除く。
 */
export function normalizeCompanyName(name: string): string {
  return name
    .replace(/(株式会社|有限会社|合同会社|一般社団法人|\(株\)|（株）|㈱)/g, '')
    .replace(/[\s　]/g, '')
    .replace(/[ァィゥェォッャュョヮぁぃぅぇぉっゃゅょゎ]/g, '')
    .replace(/[・･,、.．]/g, '')
    .toLowerCase()
}

/** その行ラベルが自社か */
function isSelfRow(rowLabel: string, companyNames: string[]): boolean {
  const norm = normalizeCompanyName(rowLabel)
  if (norm.length < 2) return false
  return companyNames.some((n) => {
    const c = normalizeCompanyName(n)
    if (c.length < 2) return false
    return norm.includes(c) || c.includes(norm)
  })
}

// 段階ごとの列ラベル規約。先に一致したものを採る
const COLUMN_RULES: { stage: MarketStage; re: RegExp; reason: string }[] = [
  { stage: 'awareness', re: /^認知[・･]?計$/, reason: '「認知・計」列' },
  { stage: 'usage', re: /^導入[・･]購入経験あり[・･]?計$/, reason: '「導入・購入経験あり・計」列' },
  { stage: 'evaluation', re: /^ロイヤリティあり[・･]?計$/, reason: '「ロイヤリティあり・計」列' },
  { stage: 'advocacy', re: /^推奨意向あり[・･]?計$/, reason: '「推奨意向あり・計」列' },
]

// 規約に当たらないときの緩い候補（confidence = likely）
const LOOSE_RULES: { stage: MarketStage; re: RegExp; reason: string }[] = [
  { stage: 'awareness', re: /認知.*計/, reason: '認知の合計とみられる列' },
  { stage: 'usage', re: /(導入|利用|購入).*(経験|あり).*計/, reason: '利用の合計とみられる列' },
  { stage: 'evaluation', re: /(ロイヤリティ|選びたい|選定).*計/, reason: '選定意向の合計とみられる列' },
  { stage: 'advocacy', re: /(推奨|勧めたい|おすすめ).*計/, reason: '推奨の合計とみられる列' },
]

/**
 * 5段階の候補を出す。
 * 見つからない段階は missing に入れ、勝手に「未計測」にはしない
 * （設問の見落としと、本当に無いことは区別が要る）。
 */
export function autoMapStages(
  blocks: AutoMapBlock[],
  cells: AutoMapCell[],
  companyNames: string[]
): AutoMapResult {
  const names = companyNames.filter((n) => n && n.trim().length >= 2)
  const byBlock = new Map<string, AutoMapCell[]>()
  for (const c of cells) {
    if (!byBlock.has(c.blockId)) byBlock.set(c.blockId, [])
    byBlock.get(c.blockId)!.push(c)
  }

  const proposals: AutoMapProposal[] = []
  const matchedSelfLabels = new Set<string>()

  /** 指定の列ラベルに一致する自社セルを探して提案を作る */
  const proposeByColumn = (
    stage: MarketStage,
    re: RegExp,
    reason: string,
    confidence: 'exact' | 'likely'
  ): boolean => {
    for (const b of blocks) {
      if (b.isAttribute || !b.columns) continue
      const col = b.columns.find((c) => re.test(c.label))
      if (!col) continue

      const blockCells = byBlock.get(b.id) ?? []
      const selfCell = blockCells.find(
        (c) =>
          c.colLabel === col.label &&
          c.kind === 'option' &&
          c.value !== null &&
          isSelfRow(c.rowLabel, names)
      )
      if (!selfCell) continue

      // 同じ列の他社＝競合。順位やトップとの差の算出に使う。
      // 「その他」「あてはまるものはない」はコード付きの行として実在するが
      // 会社ではない。混ぜるとベンチマークの最大値と順位の母数が狂う
      const competitors = blockCells
        .filter(
          (c) =>
            c.colLabel === col.label &&
            c.kind === 'option' &&
            c.value !== null &&
            c.id !== selfCell.id &&
            !isNoiseLabel(c.rowLabel)
        )
        .map((c) => ({ cellId: c.id, name: c.rowLabel }))

      matchedSelfLabels.add(selfCell.rowLabel)
      proposals.push({
        stage,
        cellId: selfCell.id,
        competitorCellIds: competitors,
        questionCode: b.questionCode,
        rowLabel: selfCell.rowLabel,
        colLabel: selfCell.colLabel,
        value: selfCell.value as number,
        baseN: selfCell.baseN,
        confidence,
        reason: `${b.questionCode} の${reason}`,
      })
      return true
    }
    return false
  }

  // 1. 列ラベルの規約で当てる
  for (const rule of COLUMN_RULES) {
    proposeByColumn(rule.stage, rule.re, rule.reason, 'exact')
  }

  // 2. 想起は列ではなく設問文で判定する（非マトリクスのため）
  if (!proposals.some((p) => p.stage === 'recall')) {
    // 【第1想起】を優先。無ければ N 接頭辞の付かない想起設問
    const recallBlocks = blocks.filter(
      (b) => !b.isAttribute && !b.columns && /思い浮かべ|純粋想起/.test(b.questionText)
    )
    const first =
      recallBlocks.find((b) => /【?第[1１一]想起】?/.test(b.questionText)) ??
      recallBlocks.find((b) => !/^N/i.test(b.questionCode))

    if (first) {
      const selfCell = (byBlock.get(first.id) ?? []).find(
        (c) => c.kind === 'option' && c.value !== null && isSelfRow(c.rowLabel, names)
      )
      if (selfCell) {
        // 想起は選択肢がそのまま社名の並びになる。ここにも受け皿行が混ざる
        const competitors = (byBlock.get(first.id) ?? [])
          .filter(
            (c) =>
              c.kind === 'option' &&
              c.value !== null &&
              c.id !== selfCell.id &&
              !isNoiseLabel(c.rowLabel)
          )
          .map((c) => ({ cellId: c.id, name: c.rowLabel }))

        matchedSelfLabels.add(selfCell.rowLabel)
        proposals.push({
          stage: 'recall',
          cellId: selfCell.id,
          competitorCellIds: competitors,
          questionCode: first.questionCode,
          rowLabel: selfCell.rowLabel,
          colLabel: null,
          value: selfCell.value as number,
          baseN: selfCell.baseN,
          confidence: /【?第[1１一]想起】?/.test(first.questionText) ? 'exact' : 'likely',
          reason: `${first.questionCode} の第1想起`,
        })
      }
    }
  }

  // 3. 規約で当たらなかった段階を緩いルールで拾う
  for (const rule of LOOSE_RULES) {
    if (proposals.some((p) => p.stage === rule.stage)) continue
    proposeByColumn(rule.stage, rule.re, rule.reason, 'likely')
  }

  const found = new Set(proposals.map((p) => p.stage))
  return {
    proposals: MARKET_STAGES.filter((s) => found.has(s)).map(
      (s) => proposals.find((p) => p.stage === s)!
    ),
    missing: MARKET_STAGES.filter((s) => !found.has(s)),
    matchedSelfLabels: [...matchedSelfLabels],
  }
}
