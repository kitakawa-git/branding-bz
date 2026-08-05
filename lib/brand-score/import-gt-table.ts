// 調査会社の GT 集計表（クロス集計表）のパース。I/O を持たない純関数。
// ============================================================
// 対象は「PTable#### ブロックが縦に並ぶ」形式の集計表。
// 実データ（電通マクロミルインサイト／眼科医220名・2025年）で検証している。
//
// ブロックの形（非マトリクス）
//   col B = 'PTable0011'
//   col B = 'q1_ac 「眼科の医療機器の…」【第1想起】'      ← 設問コード + 設問文
//   （空行）
//   col C = '単一回答'                  col E = '％'      ← 値の列はここで決まる
//   col C = '全体'                      col E = 220       ← ベースN
//   col B = 1  col C = 'リッツメディカル'  col E = 16.8
//
// ブロックの形（マトリクス）
//   col C = '単一回答マトリクス'   col F.. = 列コード 1,2,3
//   col E = '全体'  col F..= '確かに知っている' / … / '認知・計'  ← 列ラベル
//   col B = 1  col C = 'リィツメディカル'  col E = 220(ベースN)  col F..= 各値
//
// ── 設計上の注意（実データで確認した事実に基づく）─────────────
// 1. ベースNは行ごとに違う。q4 はリィツ行が170、はんだや行が187。
//    ブロック単位で1つと決めつけると数字の意味が壊れる。
// 2. NET行（「認知・計」等）と無回答行はコードを持たない。捨てずに
//    kind で区別して保存する（どれを指標に使うかは人が決める）。
// 3. 集計済みバリアント（Nq3_T2B）が原設問（q3）と併存する。
//    自動で重複排除しない。
// 4. 値の列は col E とは限らない。回答形式行から探す。
// 5. 属性設問はここでフィルタしない。フラグを立てるだけにして、
//    何が除かれたかが画面から見えるようにする。
// ============================================================

export type GtAnswerType =
  | 'single'
  | 'multi'
  | 'single_matrix'
  | 'multi_matrix'
  | 'numeric'
  | 'unknown'

export type GtCellKind = 'option' | 'net' | 'no_answer'

export type GtWarningCode =
  | 'NO_BASE_N'
  | 'UNPARSEABLE_VALUE'
  | 'UNKNOWN_ANSWER_TYPE'
  | 'NO_VALUE_COLUMN'
  | 'EMPTY_BLOCK'
  | 'PERCENT_OUT_OF_RANGE'

export interface GtWarning {
  code: GtWarningCode
  severity: 'error' | 'warn'
  blockKey: string
  /** シート上の行番号（1始まり）。特定できないときは null */
  row: number | null
  detail: string
}

export interface GtCell {
  /** 選択肢コード。NET行・無回答行は null */
  rowCode: string | null
  rowLabel: string
  rowIndex: number
  /** マトリクスの列コード。非マトリクスと NET 列は null */
  colCode: string | null
  colLabel: string | null
  colIndex: number | null
  /** パースできなかった場合は null（0 にはしない） */
  value: number | null
  valueRaw: string
  /** この値の母数。行ごとに違うのでセル側に持つ */
  baseN: number | null
  kind: GtCellKind
  /** シート上の行番号（1始まり） */
  sourceRow: number
}

export interface GtBlock {
  blockKey: string
  blockIndex: number
  /** 設問コード（'q3' / 'Nq3_T2B' / 'BD11'） */
  questionCode: string
  /** 設問文（設問コードを除いたもの） */
  questionText: string
  answerType: GtAnswerType
  answerTypeRaw: string
  /** ブロック共通のベースN。行ごとに違う場合は null */
  blockBaseN: number | null
  /** マトリクスの列定義。非マトリクスは null */
  columns: { code: string | null; label: string }[] | null
  cells: GtCell[]
  /** 属性設問（性別・診療科など）と推定されるか。除外はしないがUIで畳む */
  isAttribute: boolean
  sourceRow: number
  warnings: GtWarning[]
}

export interface GtParseResult {
  sheetName: string
  blocks: GtBlock[]
  warnings: GtWarning[]
}

// ────────────────────────────────────────────
// 小道具
// ────────────────────────────────────────────

const BLOCK_KEY_RE = /^P?N?Table\d{3,5}$/
const ANSWER_TYPE_RE = /^(単一回答|複数回答|数値回答)(マトリクス)?$/

/** GT表の集計シートを選ぶ。%表 を最優先 */
export function pickGtSheet(sheetNames: string[]): string | null {
  const priority = ['%表', 'N%表', '％表']
  for (const p of priority) {
    const hit = sheetNames.find((n) => n.trim() === p)
    if (hit) return hit
  }
  return null
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString()
  return String(v).trim()
}

function isBlank(row: unknown[] | undefined): boolean {
  if (!row) return true
  return row.every((c) => cellText(c) === '')
}

function toAnswerType(raw: string): GtAnswerType {
  switch (raw) {
    case '単一回答':
      return 'single'
    case '複数回答':
      return 'multi'
    case '単一回答マトリクス':
      return 'single_matrix'
    case '複数回答マトリクス':
      return 'multi_matrix'
    case '数値回答':
      return 'numeric'
    default:
      return 'unknown'
  }
}

function isMatrix(t: GtAnswerType): boolean {
  return t === 'single_matrix' || t === 'multi_matrix'
}

/**
 * 「％ではない」ラベル。
 * 集計表には実数の行・列が混ざる:
 *   列 … 数値回答の「有効ケース数 / 合計 / 平均 / 標準偏差」
 *   行 … 複数回答の末尾に付く「回答個数有効ケース数 / 回答個数平均」
 * これらに 0-100 の範囲チェックをかけると誤検知になる。
 */
const NON_PERCENT_LABEL_RE =
  /(ケース数|件数|人数|回答数|回答個数|合計|平均|標準偏差|最小値|最大値|中央値)/

/** そのセルが百分率かどうか。行・列どちらかが実数ラベルなら％ではない */
function isPercentCell(rowLabel: string, colLabel: string | null): boolean {
  if (NON_PERCENT_LABEL_RE.test(rowLabel)) return false
  if (colLabel !== null && NON_PERCENT_LABEL_RE.test(colLabel)) return false
  return true
}

/** 設問文の先頭トークンを設問コードとして切り出す */
export function splitQuestionCode(raw: string): { code: string; text: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { code: '', text: '' }
  const m = trimmed.match(/^(\S+)\s+([\s\S]*)$/)
  if (!m) return { code: trimmed, text: '' }
  return { code: m[1], text: m[2].trim() }
}

/** 属性設問（集計の切り口）と推定されるか。除外はせずフラグだけ立てる */
const ATTRIBUTE_KEYWORDS = [
  '性別', '年齢', '年代', '診療科', '病床数', '医師歴', '所在地', '都道府県',
  '地域', '勤務先の形態', 'お住まい', '同意する',
]

export function guessIsAttribute(code: string, text: string): boolean {
  // BD* はブレイクダウン定義（集計軸そのもの）
  if (/^BD/i.test(code)) return true
  // 冒頭の同意確認・スクリーニング設問
  if (/^dcid$/i.test(code)) return true
  return ATTRIBUTE_KEYWORDS.some((k) => text.includes(k))
}

/**
 * 「％」「12.3%」「77.2727272727273」→ 数値
 * 変換できなければ null（0 にはしない）
 */
function parseValue(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  const s = cellText(raw)
  if (s === '') return null
  const stripped = s.replace(/[%％]\s*$/, '').replace(/,/g, '').trim()
  if (stripped === '') return null
  const n = Number(stripped)
  return Number.isFinite(n) ? n : null
}

function classifyRow(code: string, label: string): GtCellKind {
  if (code !== '') return 'option'
  if (label.includes('無回答')) return 'no_answer'
  return 'net'
}

// ────────────────────────────────────────────
// ブロック分割
// ────────────────────────────────────────────

export function splitBlocks(
  rows: unknown[][]
): { key: string; start: number; end: number }[] {
  const starts: { key: string; start: number }[] = []
  rows.forEach((row, i) => {
    const key = cellText(row?.[1])
    if (BLOCK_KEY_RE.test(key)) starts.push({ key, start: i })
  })

  return starts.map((s, i) => ({
    key: s.key,
    start: s.start,
    end: i + 1 < starts.length ? starts[i + 1].start : rows.length,
  }))
}

// ────────────────────────────────────────────
// ブロック1つのパース
// ────────────────────────────────────────────

export function parseBlock(
  rows: unknown[][],
  blockKey: string,
  start: number,
  end: number,
  blockIndex: number
): GtBlock {
  const warnings: GtWarning[] = []
  const warn = (
    code: GtWarningCode,
    severity: 'error' | 'warn',
    row: number | null,
    detail: string
  ) => warnings.push({ code, severity, blockKey, row, detail })

  const rawQuestion = cellText(rows[start + 1]?.[1])
  const { code: questionCode, text: questionText } = splitQuestionCode(rawQuestion)

  const base: GtBlock = {
    blockKey,
    blockIndex,
    questionCode,
    questionText,
    answerType: 'unknown',
    answerTypeRaw: '',
    blockBaseN: null,
    columns: null,
    cells: [],
    isAttribute: guessIsAttribute(questionCode, questionText),
    sourceRow: start + 1,
    warnings,
  }

  // 回答形式行を探す（固定オフセットに依存しない）
  let typeRowIdx = -1
  for (let i = start + 1; i < end; i++) {
    const t = cellText(rows[i]?.[2])
    if (ANSWER_TYPE_RE.test(t)) {
      typeRowIdx = i
      break
    }
  }

  if (typeRowIdx === -1) {
    warn('UNKNOWN_ANSWER_TYPE', 'warn', start + 1, '回答形式の行が見つかりません')
    return base
  }

  const typeRow = rows[typeRowIdx]
  base.answerTypeRaw = cellText(typeRow[2])
  base.answerType = toAnswerType(base.answerTypeRaw)

  // 数値回答は回答形式行がそのまま列ラベル行を兼ねる
  // （'数値回答 | 全体 | 有効ケース数 | 合計 | 平均 | 標準偏差 | …'）
  if (base.answerType === 'numeric') {
    parseMatrixBlock(rows, base, typeRow, typeRowIdx, typeRowIdx, end, warn)
    if (base.cells.length === 0) {
      warn('EMPTY_BLOCK', 'warn', start + 1, '選択肢の行が1つもありません')
    }
    return base
  }

  // 次の非空行がヘッダー（非マトリクス=全体行 / マトリクス=列ラベル行）
  let headerRowIdx = -1
  for (let i = typeRowIdx + 1; i < end; i++) {
    if (!isBlank(rows[i])) {
      headerRowIdx = i
      break
    }
  }
  if (headerRowIdx === -1) {
    warn('EMPTY_BLOCK', 'warn', start + 1, 'ヘッダー行が見つかりません')
    return base
  }

  if (isMatrix(base.answerType)) {
    parseMatrixBlock(rows, base, typeRow, typeRowIdx, headerRowIdx, end, warn)
  } else {
    parseFlatBlock(rows, base, typeRow, headerRowIdx, end, warn)
  }

  if (base.cells.length === 0) {
    warn('EMPTY_BLOCK', 'warn', start + 1, '選択肢の行が1つもありません')
  }
  return base
}

type WarnFn = (
  code: GtWarningCode,
  severity: 'error' | 'warn',
  row: number | null,
  detail: string
) => void

/** 非マトリクス: 値の列を回答形式行から特定し、1行1セルで読む */
function parseFlatBlock(
  rows: unknown[][],
  block: GtBlock,
  typeRow: unknown[],
  totalRowIdx: number,
  end: number,
  warn: WarnFn
): void {
  // 回答形式行で「％」「%」「n」が入っている列が値の列。col E 決め打ちにしない
  let valueCol = -1
  for (let c = 3; c < typeRow.length; c++) {
    const t = cellText(typeRow[c])
    if (t === '％' || t === '%' || t.toLowerCase() === 'n') {
      valueCol = c
      break
    }
  }
  if (valueCol === -1) {
    warn('NO_VALUE_COLUMN', 'error', block.sourceRow, '値の列（％）が特定できません')
    return
  }

  // 「全体」行がベースN
  const totalRow = rows[totalRowIdx]
  if (cellText(totalRow?.[2]) === '全体') {
    block.blockBaseN = parseValue(totalRow[valueCol])
  }
  if (block.blockBaseN === null) {
    warn('NO_BASE_N', 'warn', totalRowIdx + 1, 'ベースN（全体行）が見つかりません')
  }

  for (let i = totalRowIdx + 1; i < end; i++) {
    const row = rows[i]
    if (isBlank(row)) continue

    const code = cellText(row[1])
    const label = cellText(row[2])
    if (label === '') continue

    const raw = row[valueCol]
    const value = parseValue(raw)
    const valueRaw = cellText(raw)

    if (value === null && valueRaw !== '') {
      warn('UNPARSEABLE_VALUE', 'error', i + 1, `値 "${valueRaw}" を数値に変換できません`)
    } else if (value !== null && value > 100.5 && isPercentCell(label, null)) {
      warn('PERCENT_OUT_OF_RANGE', 'error', i + 1, `値 ${value} が100%を超えています`)
    }

    block.cells.push({
      rowCode: code === '' ? null : code,
      rowLabel: label,
      rowIndex: block.cells.length,
      colCode: null,
      colLabel: null,
      colIndex: null,
      value,
      valueRaw,
      baseN: block.blockBaseN,
      kind: classifyRow(code, label),
      sourceRow: i + 1,
    })
  }
}

/** マトリクス: 行×列でセルを展開する。ベースNは行ごとに読む */
function parseMatrixBlock(
  rows: unknown[][],
  block: GtBlock,
  typeRow: unknown[],
  typeRowIdx: number,
  labelRowIdx: number,
  end: number,
  warn: WarnFn
): void {
  const labelRow = rows[labelRowIdx]

  // 列ラベル行で「全体」が入っている列がベースNの列。その右が値の列
  let baseCol = -1
  for (let c = 0; c < labelRow.length; c++) {
    if (cellText(labelRow[c]) === '全体') {
      baseCol = c
      break
    }
  }
  if (baseCol === -1) {
    warn('NO_VALUE_COLUMN', 'error', labelRowIdx + 1, '「全体」列が見つかりません')
    return
  }

  // 「全体」の右から順に列定義を作る。
  // NET列（「認知・計」等）は回答形式行にコードが無いので code は null になる
  const columns: { code: string | null; label: string; col: number }[] = []
  for (let c = baseCol + 1; c < labelRow.length; c++) {
    const label = cellText(labelRow[c])
    if (label === '') continue
    const code = cellText(typeRow[c])
    columns.push({ code: code === '' ? null : code, label, col: c })
  }
  if (columns.length === 0) {
    warn('NO_VALUE_COLUMN', 'error', labelRowIdx + 1, '列ラベルが1つもありません')
    return
  }
  block.columns = columns.map((c) => ({ code: c.code, label: c.label }))

  let rowIndex = 0
  const baseNs = new Set<number>()

  for (let i = labelRowIdx + 1; i < end; i++) {
    const row = rows[i]
    if (isBlank(row)) continue

    const code = cellText(row[1])
    const label = cellText(row[2])
    if (label === '') continue

    const baseN = parseValue(row[baseCol])
    if (baseN === null) {
      warn('NO_BASE_N', 'warn', i + 1, `「${label}」のベースNが読めません`)
    } else {
      baseNs.add(baseN)
    }

    const kind = classifyRow(code, label)

    for (const col of columns) {
      const raw = row[col.col]
      const value = parseValue(raw)
      const valueRaw = cellText(raw)

      if (value === null && valueRaw !== '') {
        warn(
          'UNPARSEABLE_VALUE',
          'error',
          i + 1,
          `「${label}」×「${col.label}」の値 "${valueRaw}" を数値に変換できません`
        )
      } else if (value !== null && value > 100.5 && isPercentCell(label, col.label)) {
        warn(
          'PERCENT_OUT_OF_RANGE',
          'error',
          i + 1,
          `「${label}」×「${col.label}」の値 ${value} が100%を超えています`
        )
      }

      block.cells.push({
        rowCode: code === '' ? null : code,
        rowLabel: label,
        rowIndex,
        colCode: col.code,
        colLabel: col.label,
        colIndex: col.col,
        value,
        valueRaw,
        baseN,
        kind,
        sourceRow: i + 1,
      })
    }
    rowIndex++
  }

  // 全行で同じNなら「ブロック共通のN」として持てる。違うなら null のまま
  block.blockBaseN = baseNs.size === 1 ? [...baseNs][0] : null
}

// ────────────────────────────────────────────
// エントリポイント
// ────────────────────────────────────────────

/**
 * GT表の集計シートをパースする。
 *
 * throw するのは構造的な全損のみ（ブロックが1つも無い）。
 * 個々の不整合は warnings に積んで返し、取り込みを止めるかは
 * 呼び出し側（severity='error' があれば拒否）が決める。
 */
export function parseGtTable(sheetName: string, rows: unknown[][]): GtParseResult {
  const ranges = splitBlocks(rows)

  if (ranges.length === 0) {
    throw new Error(
      'GT集計表の形式ではありません（PTable で始まる集計ブロックが見つかりません）'
    )
  }

  const blocks = ranges.map((r, i) => parseBlock(rows, r.key, r.start, r.end, i))
  const warnings = blocks.flatMap((b) => b.warnings)

  return { sheetName, blocks, warnings }
}
