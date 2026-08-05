'use client'

// パスワードリセット申請ページ
// ============================================================
// メールアドレスを受け取り、Supabase のリセットメールを送る。
// redirectTo に /reset-password を明示することで、Site URL の設定に
// 依存せず確実に再設定ページへ戻せる。
//
// メールアドレスの存在有無は画面に出さない（アカウントの存在を
// 外部から確かめられてしまうため）。送信成否にかかわらず同じ文面を返す。
// ============================================================
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { MailCheck } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSending(true)

    const { error: sendError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setSending(false)

    // レート制限など、送信自体が拒否された場合だけエラーを出す。
    // 「そのメールアドレスは存在しない」は出さない（存在確認に使われるため）
    if (sendError) {
      setError(`送信に失敗しました: ${sendError.message}`)
      return
    }

    setSent(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0c0c11] px-5 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 inline-block text-lg font-bold text-white transition-opacity hover:opacity-80">
          branding.bz
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
          {sent ? (
            <>
              <h1 className="mb-2 flex items-center gap-2 text-base font-bold text-white">
                <MailCheck size={18} className="text-green-400" />
                メールを送信しました
              </h1>
              <p className="mb-4 text-sm leading-relaxed text-white/60">
                {email} 宛にパスワード再設定用のリンクを送りました。メール内のリンクから新しいパスワードを設定してください。
              </p>
              <p className="mb-5 text-sm leading-relaxed text-white/40">
                リンクは1回だけ有効で、一定時間で期限切れになります。届かない場合は迷惑メールフォルダもご確認ください。
              </p>
              <p className="mb-0 text-sm">
                <Link href="/admin/login" className="font-semibold text-white underline-offset-2 hover:underline">
                  ログイン画面に戻る
                </Link>
              </p>
            </>
          ) : (
            <>
              <h1 className="mb-1 text-base font-bold text-white">パスワードをお忘れですか？</h1>
              <p className="mb-6 text-sm leading-relaxed text-white/60">
                ご登録のメールアドレスを入力してください。再設定用のリンクをお送りします。
              </p>

              <form onSubmit={handleSubmit}>
                <div className="mb-5">
                  <h2 className="mb-1.5 text-sm font-semibold text-white/70">メールアドレス</h2>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className="h-12 border-white/15 bg-white/[0.04] text-base text-white placeholder:text-white/30 focus-visible:ring-white/30 md:text-base"
                  />
                </div>

                {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

                <button
                  type="submit"
                  disabled={sending}
                  className="h-12 w-full rounded-full bg-white text-base font-semibold text-black transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                >
                  {sending ? '送信中...' : '再設定リンクを送る'}
                </button>
              </form>

              <p className="mb-0 mt-6 text-center text-sm">
                <Link href="/admin/login" className="font-semibold text-white underline-offset-2 hover:underline">
                  ログイン画面に戻る
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
