// 4ツール（STP・ペルソナ・パーソナリティ・カラー）共通の月次フリー枠設定。
// 「無料で月に3回まで利用可能」＝ status='completed' 行を当月分（JST）で数える。
// 毎月1日 0:00（日本時間）にリセット。

/** 月間の完了セッション上限（4ツール共通） */
export const MONTHLY_FREE_LIMIT = 3

/**
 * 当月1日 00:00（JST）を UTC の ISO 文字列で返す。
 * Supabase の updated_at（timestamptz）に対する gte フィルタで使う。
 * 例: 2026-07-14 12:00 JST → '2026-06-30T15:00:00.000Z'（= 7月1日 0:00 JST）
 */
export function getCurrentMonthStartUtcIso(now: Date = new Date()): string {
  // JST = UTC+9。 JST の年月を UTC 経由で計算する。
  const jstMs = now.getTime() + 9 * 60 * 60 * 1000
  const jst = new Date(jstMs)
  const y = jst.getUTCFullYear()
  const m = jst.getUTCMonth() // 0-11
  // JST 月初 00:00 = UTC で前月末日の 15:00
  const utcMs = Date.UTC(y, m, 1) - 9 * 60 * 60 * 1000
  return new Date(utcMs).toISOString()
}

/** 上限到達時のエラーメッセージ（4ツール共通） */
export const MONTHLY_LIMIT_REACHED_MESSAGE =
  `無料プランの月に${MONTHLY_FREE_LIMIT}回の上限に達しました。翌月1日 0:00（日本時間）にリセットされます。`

/** LP の CTA バッジ文言（4ツール共通） */
export const FREE_TIER_BADGE_LABEL = `無料で月に${MONTHLY_FREE_LIMIT}回まで利用可能`
