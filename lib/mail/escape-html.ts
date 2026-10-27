// メール本文（HTML）に値を差し込む前に必ず通すエスケープ。
// 問い合わせ・資料請求・新規登録・参加申請などの通知メールで共通に使う（以前は6か所に複製されていた）。
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
