'use client'

// 統一ログイン / サインアップページ
// /portal/auth            — 直接アクセス（本体ユーザー）
// /portal/auth?from=colors — カラーツールLPから
// /portal/auth?from=stp    — STPツールLPから
import { Suspense, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'

// from パラメータに応じたサブタイトル
const SUBTITLES: Record<string, string> = {
  colors: 'ブランドカラー定義ツールを利用するにはログインが必要です',
  stp: 'STP分析ツールを利用するにはログインが必要です',
  personality: 'ブランドパーソナリティ診断を利用するにはログインが必要です',
}

export default function PortalAuthPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#08080a] font-sans">
        <p className="text-sm text-white/40">読み込み中...</p>
      </div>
    }>
      <PortalAuthContent />
    </Suspense>
  )
}

function PortalAuthContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()

  const from = searchParams.get('from')

  // エラーパラメータ検出
  useEffect(() => {
    const err = searchParams.get('error')
    if (err === 'auth_failed') {
      setError('ログインに失敗しました。もう一度お試しください。')
    } else if (err === 'not_registered') {
      setError('このGoogleアカウントはまだ登録されていません。\nご利用には新規登録が必要です。下の「新規登録」からお進みください。')
    }
  }, [searchParams])

  // すでにログイン済みの場合はリダイレクト
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        if (from) {
          router.replace(`/portal/auth/select?from=${from}`)
        } else {
          router.replace('/portal')
        }
      } else {
        setCheckingSession(false)
      }
    })
  }, [from, router])

  // ログイン成功後の遷移先
  const redirectAfterAuth = (userId: string) => {
    if (from) {
      router.replace(`/portal/auth/select?from=${from}`)
    } else {
      router.replace('/portal')
    }
  }

  // メール/パスワードログイン
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError('メールアドレスまたはパスワードが正しくありません')
        return
      }

      redirectAfterAuth(data.user.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログイン中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // Googleソーシャルログイン
  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setError('')
    const callbackUrl = from
      ? `${window.location.origin}/portal/auth/callback?from=${from}`
      : `${window.location.origin}/portal/auth/callback`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl,
      },
    })
    if (error) {
      setError('Googleログインに失敗しました')
      setGoogleLoading(false)
    }
  }

  // セッションチェック中
  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08080a] font-sans">
        <p className="text-sm text-white/40">読み込み中...</p>
      </div>
    )
  }

  const subtitle = from ? SUBTITLES[from] || '' : ''

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white font-sans text-white"
    >
      <div
        className="relative z-10 w-full max-w-[400px] mx-5 rounded-3xl overflow-hidden border border-white/15"
        style={{
          background: 'linear-gradient(135deg, rgba(18,20,29,0.88) 0%, rgba(5,6,10,0.93) 100%)',
          backdropFilter: 'blur(22px) saturate(180%)',
          WebkitBackdropFilter: 'blur(22px) saturate(180%)',
          boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.38), inset 0 -8px 24px -8px rgba(255,255,255,0.05), 0 24px 60px -20px rgba(0,0,0,0.5)',
        }}
      >
        {/* スペキュラ（液体ガラスの艶） */}
        <div className="absolute inset-0 pointer-events-none rounded-3xl"
          style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 42%)' }} />
        <div className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)' }} />

        <div className="relative z-10 p-10">
          {subtitle && (
            <div className="mb-8 text-center">
              <p className="m-0 text-base text-white/55">
                {subtitle}
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 whitespace-pre-wrap break-words rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Googleログインボタン */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            className="flex w-full h-12 items-center justify-center gap-3 rounded-full border border-white/15 bg-white/[0.06] text-base font-medium text-white transition-all hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {googleLoading ? '接続中...' : 'Googleで続ける'}
          </button>

          {/* セパレーター */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="rounded-full bg-[#0c0c11] px-3 text-white/40">または</span>
            </div>
          </div>

          <form onSubmit={handleLogin}>
            <div className="mb-5">
              <h2 className="mb-1.5 text-sm font-semibold text-white/70">メールアドレス</h2>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="h-12 text-base md:text-base bg-white/[0.04] border-white/15 text-white placeholder:text-white/30 focus-visible:ring-white/30"
              />
            </div>

            <div className="mb-5">
              <h2 className="mb-1.5 text-sm font-semibold text-white/70">パスワード</h2>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                required
                minLength={6}
                className="h-12 text-base md:text-base bg-white/[0.04] border-white/15 text-white placeholder:text-white/30 focus-visible:ring-white/30"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-full bg-white text-base font-semibold text-black transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>

          <p className="mb-0 mt-6 text-center text-sm">
            <span className="text-white/55">
              アカウントをお持ちでない方は{' '}
              <button
                onClick={() => router.push('/signup')}
                className="font-semibold text-white underline-offset-2 hover:underline bg-transparent border-0 cursor-pointer"
              >
                新規登録
              </button>
            </span>
          </p>

          <p className="mb-0 mt-3 text-center text-sm text-white/40">
            すべてのツール・サービスで
            <br />
            同じアカウントをご利用いただけます
          </p>

          {/* ロゴ（カード最下部）。クリックでトップページへ */}
          <div className="mt-8 flex justify-center border-t border-white/10 pt-6">
            <Link href="/" className="inline-block transition-opacity hover:opacity-80">
              <img
                src="/logo.svg"
                alt="branding.bz"
                style={{ height: '24px', width: 'auto', filter: 'brightness(0) invert(1)' }}
              />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
