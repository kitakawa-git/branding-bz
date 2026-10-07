// フリーメールの例外許可リスト（サーバー側専用）。
// 個人のメールアドレスを含むため NEXT_PUBLIC_ にせず、API ルートからだけ読む。
// 追加するときは環境変数 FREE_EMAIL_ALLOWLIST にカンマ区切りで足す（コードは変更不要）。
import { parseEmailAllowlist, isBlockedFreeEmail } from '@/lib/constants/free-email-domains'

export function getFreeEmailAllowlist(): Set<string> {
  return parseEmailAllowlist(process.env.FREE_EMAIL_ALLOWLIST)
}

// フリーメールで、かつ例外リストに無ければ true（＝登録を拒否する）
export function isSignupEmailBlocked(email: string): boolean {
  return isBlockedFreeEmail(email, getFreeEmailAllowlist())
}
