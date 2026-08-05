// Googleフォーム回答（Excel/CSV）→ インナースコア取り込みの変換ロジック
// ============================================================
// I/O を持たない純関数群。API ルートは exceljs で読んだ行データを
// parseGoogleFormRows() に渡すだけで、パース仕様の検証は単体テストで完結する。
// （quiz-scoring.ts と同じく「純関数を切り出して API から再利用する」方針）
// ============================================================
import type { QuizCategory } from '@/lib/types/brand-quiz'

// サーベイ設問のカテゴリ。brand_survey_questions.category と同じ 3 値。
export type SurveyCategory = QuizCategory // 'why' | 'how' | 'what'

// ────────────────────────────────────────────
// 回答ラベル → 1-5 スケール
// ────────────────────────────────────────────
// Googleフォームは選択肢の文言をそのまま出力するため、値は数値ではなく
// 設問ごとに異なる日本語ラベルになる（例:「少し説明できる」「強く共感している」）。
// 実データ 243 件・64 種のラベルを検証した結果、以下の接頭辞ルールで
// 5 段階に一意に分類できる。語彙を増やす場合はここだけを変更する。

/** 5点（最上位）と判定する接頭辞 */
const STRONG_PREFIXES = ['強く', '十分に', '完璧に', 'とても', '積極的に'] as const

/** 中立（3点）の唯一のラベル */
const NEUTRAL_LABEL = 'どちらとも言えない'

/**
 * 回答ラベルを 1-5 のスコアに変換する。
 * ・数値（1-5）がそのまま入っている場合はその値を採用する
 * ・空欄／未知の形式は null（呼び出し側で未変換として扱う）
 */
export function labelToScore(value: unknown): number | null {
  if (value === null || value === undefined) return null

  // 数値スケールで出力されているフォームにも対応
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null
  }

  const s = String(value).trim()
  if (s === '') return null

  // "3" のような数値文字列
  if (/^[1-5]$/.test(s)) return Number(s)

  if (s === NEUTRAL_LABEL) return 3
  if (s.startsWith('全く')) return 1
  if (s.startsWith('あまり')) return 2
  if (STRONG_PREFIXES.some((p) => s.startsWith(p))) return 5

  // 上記いずれにも当たらない素の肯定形（「共感している」「伝えられる」等）
  return 4
}

// ────────────────────────────────────────────
// 設問ヘッダーのパース
// ────────────────────────────────────────────

/**
 * 設問ヘッダーから先頭の番号と本文を取り出す。
 * 例: "1.会社のミッションを自分の言葉で説明できるか。"
 *      → { sortOrder: 1, text: "会社のミッションを自分の言葉で説明できるか。" }
 * 番号が無いヘッダーは sortOrder: null（呼び出し側で列順を採番する）。
 */
export function parseQuestionHeader(header: unknown): { sortOrder: number | null; text: string } {
  const raw = String(header ?? '').trim()
  // "1." / "1．" / "1、" / "Q1." / "1 " などの番号プレフィックスを許容
  const m = raw.match(/^Q?\s*(\d{1,3})\s*[.．。、:：)）]?\s*([\s\S]*)$/)
  if (m && m[2].trim() !== '') {
    return { sortOrder: Number(m[1]), text: m[2].trim() }
  }
  return { sortOrder: null, text: raw }
}

/**
 * 設問番号からカテゴリを決める。
 * 既存テンプレート30問と同じ WHY 1-10 / HOW 11-20 / WHAT 21-30 の構成を前提とし、
 * 設問数が 30 でない場合は列数を 3 等分する（プレビュー画面で変更可能）。
 */
export function categoryForIndex(index0: number, questionCount: number): SurveyCategory {
  const perBlock = Math.ceil(questionCount / 3)
  if (index0 < perBlock) return 'why'
  if (index0 < perBlock * 2) return 'how'
  return 'what'
}

// ────────────────────────────────────────────
// シート全体のパース
// ────────────────────────────────────────────

export interface ParsedQuestion {
  sortOrder: number
  category: SurveyCategory
  questionText: string
}

export interface ParsedRespondent {
  /** 提出日時（ISO文字列）。タイムスタンプ列が無い場合は null */
  submittedAt: string | null
  /** questions と同じ並びのスコア配列。未回答は null */
  scores: (number | null)[]
}

export interface ParsedImport {
  questions: ParsedQuestion[]
  respondents: ParsedRespondent[]
  /** 1-5 に変換できなかったラベル（重複除去・最大50件）。空でなければ取り込みを拒否する */
  unmappedLabels: string[]
  stats: {
    questionCount: number
    respondentCount: number
    /** 空欄セル数（未回答として許容するが件数は提示する） */
    blankCells: number
  }
}

/** 先頭列がタイムスタンプ列かどうかを判定する */
function isTimestampHeader(header: unknown): boolean {
  const s = String(header ?? '').trim()
  return /タイムスタンプ|timestamp|送信日時|回答日時/i.test(s)
}

/** セル値を ISO 文字列に正規化する（Date / 文字列の両方に対応） */
function toIsoString(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString()
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const d = new Date(value.trim())
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  return null
}

/**
 * Googleフォームの回答シート（1行目=ヘッダー、2行目以降=回答）を解析する。
 * @param rows 2次元配列。exceljs / CSV パーサから渡す
 */
export function parseGoogleFormRows(rows: unknown[][]): ParsedImport {
  if (!rows || rows.length === 0) {
    throw new Error('シートが空です')
  }

  const header = rows[0] ?? []
  const hasTimestamp = isTimestampHeader(header[0])
  const firstQuestionCol = hasTimestamp ? 1 : 0

  // 設問列を確定（ヘッダーが空の列は設問として扱わない）
  const questionCols: number[] = []
  for (let c = firstQuestionCol; c < header.length; c++) {
    if (String(header[c] ?? '').trim() !== '') questionCols.push(c)
  }

  if (questionCols.length === 0) {
    throw new Error('設問列が見つかりません。1行目に設問文が並んだシートを指定してください')
  }

  // 設問を組み立てる。番号が全列に付いていればそれを sort_order に採用する
  const parsedHeaders = questionCols.map((c) => parseQuestionHeader(header[c]))
  const allNumbered = parsedHeaders.every((h) => h.sortOrder !== null)

  const questions: ParsedQuestion[] = parsedHeaders.map((h, i) => ({
    sortOrder: allNumbered ? (h.sortOrder as number) : i + 1,
    category: categoryForIndex(
      allNumbered ? (h.sortOrder as number) - 1 : i,
      questionCols.length
    ),
    questionText: h.text,
  }))

  // 回答行を変換
  const respondents: ParsedRespondent[] = []
  const unmapped = new Set<string>()
  let blankCells = 0

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] ?? []
    // 全列空の行はスキップ（末尾の空行対策）
    const hasAnyValue = questionCols.some((c) => {
      const v = row[c]
      return v !== null && v !== undefined && String(v).trim() !== ''
    })
    if (!hasAnyValue) continue

    const scores = questionCols.map((c) => {
      const v = row[c]
      if (v === null || v === undefined || String(v).trim() === '') {
        blankCells++
        return null
      }
      const score = labelToScore(v)
      if (score === null) unmapped.add(String(v).trim())
      return score
    })

    respondents.push({
      submittedAt: hasTimestamp ? toIsoString(row[0]) : null,
      scores,
    })
  }

  if (respondents.length === 0) {
    throw new Error('回答行が1件もありません')
  }

  return {
    questions,
    respondents,
    unmappedLabels: Array.from(unmapped).slice(0, 50),
    stats: {
      questionCount: questions.length,
      respondentCount: respondents.length,
      blankCells,
    },
  }
}
