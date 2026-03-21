// スケジュール関連のユーティリティ
// schedule API と Cron Job の両方で使用

export type Frequency = 'monthly' | 'quarterly' | 'semi_annual' | 'annual'

export const VALID_FREQUENCIES: Frequency[] = ['monthly', 'quarterly', 'semi_annual', 'annual']

// 頻度に応じた月数
const FREQ_MONTHS: Record<Frequency, number> = {
  monthly: 1,
  quarterly: 3,
  semi_annual: 6,
  annual: 12,
}

/**
 * anchor_date と frequency から次回スナップショット日を計算
 * anchor_dateを起点に frequency 間隔で繰り返し、now() 以降の最初の日付を返す
 */
export function calcNextSnapshotDate(anchorDate: string, frequency: Frequency): string {
  const anchor = new Date(anchorDate + 'T00:00:00Z')
  const now = new Date()
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const months = FREQ_MONTHS[frequency]

  let candidate = new Date(anchor)
  // anchor が未来の場合はそのまま返す
  if (candidate >= today) {
    return candidate.toISOString().split('T')[0]
  }

  // anchor から frequency 間隔で進めて today 以降になるまでループ
  while (candidate < today) {
    candidate = new Date(
      Date.UTC(
        candidate.getUTCFullYear(),
        candidate.getUTCMonth() + months,
        candidate.getUTCDate()
      )
    )
  }

  return candidate.toISOString().split('T')[0]
}
