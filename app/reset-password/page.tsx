'use client'

// パスワード再設定ページ
// ============================================================
// Supabase のリセットメール／マジックリンクの遷移先。
//
// 背景:
//   これまで Site URL が https://branding.bz（マーケLP）のままで、
//   LP は Supabase クライアントを読み込まないためトークンが誰にも
//   拾われず、リンクを踏んでもトップページが開くだけだった。
//   このページを遷移先にすることでリセットが成立する。
//
// 動作:
//   supabase-js は生成時に URL のハッシュを読んでセッションを確立する
//   （detectSessionInUrl の既定動作）。ここではその結果を待ってから
//   新パスワードの入力フォームを出す。
//   ハッシュにエラーが載っている場合（期限切れ・使用済み）は、
//   その旨と再送の導線を出す。
// ============================================================
import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'

/** パスワードの最低文字数（Supabase 側の既定と揃える） */
const MIN_PASSWORD_LENGTH = 8

type Phase = 'checking' | 'ready' | 'invalid' | 'done'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Splash />}>
      <ResetPasswordContent />
    </Suspense>
  )
}

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0c0c11]">
      <Loader2 size={24} className="animate-spin text-white/60" />
    </div>
  )
}

/** URLハッシュに載ってくる Supabase のエラーを日本語にする */
function describeHashError(code: string | null, description: string | null): string {
  if (code === 'otp_expired') {
    return 'リンクの有効期限が切れているか、すでに使用されています。メール内のリンクは1回しか使えません。お手数ですが再度お試しください。'
  }
  if (code === 'access_denied') {
    return 'リンクが無効です。お手数ですが再度お試しください。'
  }
  return description || 'リンクが無効か、有効期限が切れています。'
}

function ResetPasswordContent() {
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>('checking')
  const [hashError, setHashError] = useState('')
  const [email, setEmail] = useState('')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      // 1. ハッシュにエラーが載っていないか確認する
      //    例: #error=access_denied&error_code=otp_expired&...
      const hash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash
      const params = new URLSearchParams(hash)

      if (params.get('error') || params.get('error_code')) {
        if (cancelled) return
        setHashError(describeHashError(params.get('error_code'), params.get('error_description')))
        setPhase('invalid')
        return
      }

      // 2. セッションの確立を待つ。
      //    supabase-js がハッシュを処理し終えるまで数十msかかることがあるため、
      //    onAuthStateChange と getSession の両方で拾う。
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (cancelled || !session) return
        setEmail(session.user.email ?? '')
        setPhase('ready')
      })

      const { data } = await supabase.auth.getSession()
      if (cancelled) return

      if (data.session) {
        setEmail(data.session.user.email ?? '')
        setPhase('ready')
      } else {
        // ハッシュが無い状態で直接開かれた場合。少し待って確定させる
        setTimeout(() => {
          if (cancelled) return
          setPhase((prev) => (prev === 'checking' ? 'invalid' : prev))
          setHashError((prev) => prev || 'リンクが無効か、有効期限が切れています。')
        }, 1500)
      }

      return () => subscription.unsubscribe()
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください`)
      return
    }
    if (password !== confirm) {
      setError('確認用パスワードが一致しません')
      return
    }

    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)

    if (updateError) {
      setError(`パスワードの変更に失敗しました: ${updateError.message}`)
      return
    }

    setPhase('done')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0c0c11] px-5 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 inline-block text-lg font-bold text-white transition-opacity hover:opacity-80">
          branding.bz
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
          {phase === 'checking' && (
            <p className="m-0 flex items-center gap-2 text-sm text-white/60">
              <Loader2 size={16} className="animate-spin" />
              リンクを確認しています...
            </p>
          )}

          {phase === 'invalid' && (
            <>
              <h1 className="mb-2 flex items-center gap-2 text-base font-bold text-white">
                <AlertTriangle size={18} className="text-amber-400" />
                リンクが使用できません
              </h1>
              <p className="mb-5 text-sm leading-relaxed text-white/60">{hashError}</p>
              <p className="mb-0 text-sm">
                <Link href="/admin/login" className="font-semibold text-white underline-offset-2 hover:underline">
                  ログイン画面から再度お試しください
                </Link>
              </p>
            </>
          )}

          {phase === 'ready' && (
            <>
              <h1 className="mb-1 text-base font-bold text-white">新しいパスワードを設定</h1>
              <p className="mb-6 text-sm text-white/60">
                {email ? `${email} のパスワードを変更します。` : 'パスワードを変更します。'}
              </p>

              <form onSubmit={handleSubmit}>
                <div className="mb-5">
                  <h2 className="mb-1.5 text-sm font-semibold text-white/70">新しいパスワード</h2>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={`${MIN_PASSWORD_LENGTH}文字以上`}
                    autoComplete="new-password"
                    required
                    className="h-12 border-white/15 bg-white/[0.04] text-base text-white placeholder:text-white/30 focus-visible:ring-white/30 md:text-base"
                  />
                </div>

                <div className="mb-5">
                  <h2 className="mb-1.5 text-sm font-semibold text-white/70">確認のためもう一度</h2>
                  <Input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="同じパスワードを入力"
                    autoComplete="new-password"
                    required
                    className="h-12 border-white/15 bg-white/[0.04] text-base text-white placeholder:text-white/30 focus-visible:ring-white/30 md:text-base"
                  />
                </div>

                {error && (
                  <p className="mb-4 text-sm text-red-400">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="h-12 w-full rounded-full bg-white text-base font-semibold text-black transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                >
                  {saving ? '変更中...' : 'パスワードを変更'}
                </button>
              </form>
            </>
          )}

          {phase === 'done' && (
            <>
              <h1 className="mb-2 flex items-center gap-2 text-base font-bold text-white">
                <CheckCircle2 size={18} className="text-green-400" />
                パスワードを変更しました
              </h1>
              <p className="mb-5 text-sm leading-relaxed text-white/60">
                新しいパスワードでログインできます。
              </p>
              <button
                onClick={() => router.push('/admin/login')}
                className="h-12 w-full rounded-full bg-white text-base font-semibold text-black transition-transform hover:scale-[1.02]"
              >
                ログイン画面へ
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
