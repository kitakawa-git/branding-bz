// 年・月の表示文字列（"2011年" / "2011年5月"）とドロップダウン値の相互変換ヘルパー。
// 沿革・設立など「年（＋任意の月）」の入力を年/月セレクトで扱うために共通利用する。
// 表示文字列で保持するため DB/表示は変更不要、既存の「年のみ」データもそのまま扱える。

export function parseYearMonth(raw: string): { year: string; month: string } {
  const m = (raw || '').match(/(\d{4})[^\d]*(\d{1,2})?/)
  return { year: m?.[1] ?? '', month: m?.[2] ? String(parseInt(m[2], 10)) : '' }
}

export function formatYearMonth(year: string, month: string): string {
  if (!year) return ''
  return month ? `${year}年${month}月` : `${year}年`
}

const CURRENT_YEAR = new Date().getFullYear()
// 選択できる年（現在の年〜1900年）
export const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 1900 + 1 }, (_, i) => CURRENT_YEAR - i)
