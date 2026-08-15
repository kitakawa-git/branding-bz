// スーパー管理宛のメール通知（サーバ専用）。
//
// 依頼系（入力サポートの相談・プラン変更の依頼）は、スーパー管理画面を
// 開いたときのバッジでしか気づけなかった。開かなければ何日でも放置される。
// セットアップで詰まった人からの相談は、気づくのが遅れると意味が薄れるので
// メールで届くようにする。
//
// 送信できなくても本体の処理は成功させる。通知はおまけであって、
// メールの失敗で依頼そのものを落とすほうが損。
//
// 宛先は問い合わせフォームと同じ CONTACT_NOTIFICATION_EMAIL。
// 依頼の種類ごとに宛先を分けたくなったら、ここに env を足して分岐させる。
import { Resend } from 'resend'

/** メール本文に値を差し込む前に必ず通す */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** 「ラベル / 値」の2列テーブル。値は呼び出し側でエスケープ済みにしておく */
export function detailTable(rows: [string, string][]): string {
  const body = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px;font-weight:bold;">${escapeHtml(label)}</td><td style="padding:8px;white-space:pre-wrap;">${value}</td></tr>`,
    )
    .join('')
  return `<table style="border-collapse:collapse;">${body}</table>`
}

export async function notifySuperadmin({
  subject,
  html,
}: {
  subject: string
  html: string
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.CONTACT_NOTIFICATION_EMAIL
  // 開発環境では未設定のことがある。黙って何もしない
  if (!apiKey || !to) return

  try {
    await new Resend(apiKey).emails.send({
      from: 'branding.bz <noreply@branding.bz>',
      to,
      subject,
      html,
    })
  } catch (e) {
    console.error('superadmin notification email error:', e)
  }
}
