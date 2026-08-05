// 複数ファイルの設問マージ
// ============================================================
// 職種別にGoogleフォームを分けて実施した場合（例: 営業向け／本社向け）、
// 大半の設問は共通で、一部だけ職種に合わせた言い換えになる。
// 文言が一致する設問を同一とみなして1本にまとめ、片方にしかない設問は
// 追加の設問として登録する。設問文そのものは書き換えない
// （回答者が実際に聞かれた文言を保つため）。
// ============================================================
import type { ParsedImport, SurveyCategory } from './import-google-form'

/** 設問文の表記ゆれを吸収して比較するためのキー（前後空白・全角空白・改行を無視） */
function questionKey(text: string): string {
  return text.replace(/[\s　]+/g, '').trim()
}

export interface MergedQuestion {
  /** マージ後の通し番号（1始まり） */
  sortOrder: number
  category: SurveyCategory
  questionText: string
  /** この設問を含むファイルのインデックス */
  fileIndexes: number[]
}

/**
 * 複数ファイルの設問を1つに統合する。
 * 1ファイル目の並び順を基準にし、後続ファイルにしかない設問を末尾に足す。
 * カテゴリは最初に登場したファイルの判定を採用する。
 */
export function mergeQuestions(parsedList: ParsedImport[]): MergedQuestion[] {
  const merged: MergedQuestion[] = []
  const indexByKey = new Map<string, number>()

  parsedList.forEach((parsed, fileIndex) => {
    for (const q of parsed.questions) {
      const key = questionKey(q.questionText)
      const existing = indexByKey.get(key)
      if (existing !== undefined) {
        merged[existing].fileIndexes.push(fileIndex)
        continue
      }
      indexByKey.set(key, merged.length)
      merged.push({
        sortOrder: merged.length + 1,
        category: q.category,
        questionText: q.questionText,
        fileIndexes: [fileIndex],
      })
    }
  })

  return merged
}

/** ファイル内の設問index → マージ後の設問index を引く表を作る */
export function buildIndexMap(parsed: ParsedImport, merged: MergedQuestion[]): number[] {
  const mergedIndexByKey = new Map<string, number>(
    merged.map((m, i) => [questionKey(m.questionText), i])
  )
  return parsed.questions.map((q) => mergedIndexByKey.get(questionKey(q.questionText)) as number)
}

