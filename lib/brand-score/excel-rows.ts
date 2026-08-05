// アップロードされた Excel / CSV を2次元配列にする汎用ヘルパー。
//
// もとは surveys/import/route.ts にベタ書きされていたが、市場調査の
// GT表取り込みでも同じものが要るため切り出した。ドメイン知識は持たない。
//
// exceljs の癖をここで吸収している:
//   - row.values は 1-based（[0] は常に undefined）
//   - 数式セルは { result } / リッチテキストは { richText[] } / リンクは { text }
//   - xlsx.load の型定義は Node の Buffer を要求するが実体は Uint8Array で通る
import ExcelJS from 'exceljs'

/** CSV 1行をパースする（ダブルクォート囲み・エスケープに対応） */
export function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      cells.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  cells.push(cur)
  return cells
}

/** CSV 全文を2次元配列にする（クォート内の改行はセル内改行として扱う） */
export function parseCsv(text: string): unknown[][] {
  // BOM 除去 + 改行コード正規化
  const normalized = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // クォート状態を見ながら論理行に分割する
  const lines: string[] = []
  let cur = ''
  let inQuotes = false

  for (const ch of normalized) {
    if (ch === '"') {
      inQuotes = !inQuotes
      cur += ch
    } else if (ch === '\n' && !inQuotes) {
      lines.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur !== '') lines.push(cur)

  return lines.map(parseCsvLine)
}

/** exceljs のセル値をプリミティブに正規化する */
export function normalizeCell(value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>
    // 数式セル
    if ('result' in v) return normalizeCell(v.result)
    // リッチテキスト
    if ('richText' in v && Array.isArray(v.richText)) {
      return (v.richText as { text?: string }[]).map((t) => t.text ?? '').join('')
    }
    // ハイパーリンク
    if ('text' in v) return v.text
    return String(value)
  }
  return value
}

function worksheetToRows(sheet: ExcelJS.Worksheet): unknown[][] {
  const rows: unknown[][] = []
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const values = row.values as unknown[]
    rows.push(values.slice(1).map(normalizeCell))
  })
  return rows
}

async function loadWorkbook(file: File): Promise<ExcelJS.Workbook> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(arrayBuffer as Parameters<typeof workbook.xlsx.load>[0])
  return workbook
}

/**
 * アップロードされたファイルを2次元配列に変換する（先頭シート）。
 * Googleフォームの回答ファイルのようにシートが1枚のものを想定。
 */
export async function fileToRows(file: File): Promise<unknown[][]> {
  const arrayBuffer = await file.arrayBuffer()

  if (/\.csv$/i.test(file.name)) {
    return parseCsv(Buffer.from(arrayBuffer).toString('utf-8'))
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(arrayBuffer as Parameters<typeof workbook.xlsx.load>[0])

  const sheet = workbook.worksheets[0]
  if (!sheet) throw new Error('シートが見つかりません')

  return worksheetToRows(sheet)
}

/** ブックのシート名を並び順で返す（どのシートを読むか選ばせる用） */
export async function listSheetNames(file: File): Promise<string[]> {
  if (/\.csv$/i.test(file.name)) return []
  const workbook = await loadWorkbook(file)
  return workbook.worksheets.map((w) => w.name)
}

/**
 * シート名を指定して2次元配列に変換する。
 * 調査会社の集計表のように複数シートを持つファイル向け。
 * CSV の場合はシート概念が無いのでそのまま全体を返す。
 */
export async function fileSheetToRows(
  file: File,
  sheetName: string
): Promise<unknown[][]> {
  if (/\.csv$/i.test(file.name)) {
    const arrayBuffer = await file.arrayBuffer()
    return parseCsv(Buffer.from(arrayBuffer).toString('utf-8'))
  }

  const workbook = await loadWorkbook(file)
  const sheet = workbook.getWorksheet(sheetName)
  if (!sheet) throw new Error(`シート「${sheetName}」が見つかりません`)

  return worksheetToRows(sheet)
}
