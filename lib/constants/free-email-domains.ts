// フリーメール（個人用・非企業）ドメイン一覧（唯一の定義源）
// 新規登録はここに該当するドメインを拒否する（企業ドメインのみ受け入れる）。
// ドメインマッチング（check-domain）でも企業マッチング対象外の判定に使う。
// ドメインを追加・削除するときはこのファイルのみを変更する。

export const FREE_EMAIL_DOMAINS = new Set<string>([
  // Google
  'gmail.com', 'googlemail.com',
  // Yahoo
  'yahoo.co.jp', 'yahoo.com', 'ymail.com', 'ybb.ne.jp',
  // Microsoft
  'outlook.com', 'outlook.jp', 'hotmail.com', 'hotmail.co.jp',
  'live.com', 'live.jp', 'msn.com',
  // Apple
  'icloud.com', 'me.com', 'mac.com',
  // その他フリーメール
  'aol.com', 'protonmail.com', 'proton.me',
  'zoho.com', 'mail.com', 'gmx.com',
  // 日本の携帯キャリア（個人用）
  'docomo.ne.jp', 'ezweb.ne.jp', 'au.com', 'softbank.ne.jp',
  'i.softbank.jp', 'ipad.softbank.ne.jp',
  // 日本のISP（個人用）
  'nifty.com', 'so-net.ne.jp', 'ocn.ne.jp', 'biglobe.ne.jp',
  'plala.or.jp', 'excite.co.jp',
])

// メールアドレスのドメイン部分を小文字で取り出す（取れなければ null）。
export function getEmailDomain(email: string): string | null {
  const domain = email.split('@')[1]?.toLowerCase().trim()
  return domain || null
}

// フリーメール（個人用・非企業）ドメインかどうか。
// 企業ドメインでない（＝登録を拒否すべき）場合に true。
export function isFreeEmailDomain(email: string): boolean {
  const domain = getEmailDomain(email)
  return domain ? FREE_EMAIL_DOMAINS.has(domain) : false
}

// 新規登録拒否時にユーザーへ返す共通メッセージ。
export const FREE_EMAIL_REJECTION_MESSAGE =
  'フリーメール（Gmail・Yahoo!メールなど）ではご登録いただけません。会社のメールアドレスでご登録ください。'
