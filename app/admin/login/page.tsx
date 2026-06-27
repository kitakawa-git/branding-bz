'use client'

// 管理画面ログイン — /portal/auth のデザインに統一（白背景＋ダークのリキッドグラスカード）
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Suspense } from 'react'

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#08080a] font-sans">
        <p className="text-sm text-white/40">読み込み中...</p>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  // コールバックからのパラメータ処理
  useEffect(() => {
    if (searchParams.get('error') === 'auth_failed') {
      setError('ログインに失敗しました。もう一度お試しください。')
    }
    if (searchParams.get('error') === 'not_admin') {
      setError('このアカウントは管理者として登録されていません')
    }
    // スーパー管理者がGoogle認証で戻ってきた場合
    if (searchParams.get('superadmin') === 'true') {
      setIsSuperAdmin(true)
      setLoggedIn(true)
    }
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError('メールアドレスまたはパスワードが正しくありません')
        return
      }

      // is_superadmin 判定は AdminDataProvider が遷移先で取得する。
      // ここでは即リダイレクトのみ行い、二重取得を避ける。
      // スーパー管理者の遷移先選択は AdminDataProvider 経由（または個別ガードページ）で行う。
      router.replace('/admin/members')
    } catch (err) {
      console.error('[Login] 予期しないエラー:', err)
      setError(`ログイン処理中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  // Googleソーシャルログイン
  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setError('')
    const callbackUrl = `${window.location.origin}/admin/login/callback`
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

  /* /portal/auth と統一したカード／スペキュラ */
  const cardStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, rgba(18,20,29,0.88) 0%, rgba(5,6,10,0.93) 100%)',
    backdropFilter: 'blur(22px) saturate(180%)',
    WebkitBackdropFilter: 'blur(22px) saturate(180%)',
    boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.38), inset 0 -8px 24px -8px rgba(255,255,255,0.05), 0 24px 60px -20px rgba(0,0,0,0.5)',
  }

  const Specular = () => (
    <>
      <div className="absolute inset-0 pointer-events-none rounded-3xl"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 42%)' }} />
      <div className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)' }} />
    </>
  )

  const BottomLogo = () => (
    <div className="mt-8 flex justify-center border-t border-white/10 pt-6">
      <Link href="/" className="inline-block transition-opacity hover:opacity-80">
        <img
          src="/logo.svg"
          alt="branding.bz"
          style={{ height: '24px', width: 'auto', filter: 'brightness(0) invert(1)' }}
        />
      </Link>
    </div>
  )

  // スーパー管理者用の遷移先選択画面
  if (loggedIn && isSuperAdmin) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white font-sans text-white">
        <div className="relative z-10 w-full max-w-[400px] mx-5 rounded-3xl overflow-hidden border border-white/15" style={cardStyle}>
          <Specular />
          <div className="relative z-10 p-10">
            <div className="mb-8 text-center">
              <p className="m-0 text-base text-white/55">
                ログイン成功 — 遷移先を選択
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Link
                href="/superadmin/companies"
                className="flex h-12 w-full items-center justify-center rounded-full bg-white text-base font-semibold text-black transition-transform hover:scale-[1.02]"
              >
                スーパー管理画面
              </Link>
              <Link
                href="/admin/members"
                className="flex h-12 w-full items-center justify-center rounded-full border border-white/15 bg-white/5 text-base font-semibold text-white transition-colors hover:bg-white/10"
              >
                通常管理画面
              </Link>
            </div>

            <BottomLogo />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white font-sans text-white">
      <div className="relative z-10 w-full max-w-[400px] mx-5 rounded-3xl overflow-hidden border border-white/15" style={cardStyle}>
        <Specular />

        <div className="relative z-10 p-10">
          <div className="mb-8 text-center">
            <p className="m-0 text-base text-white/55">
              管理画面にログイン
            </p>
          </div>

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
            {googleLoading ? '接続中...' : 'Googleでログイン'}
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
                placeholder="admin@example.com"
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
            <Link href="/portal/auth" className="font-semibold text-white underline-offset-2 hover:underline">
              メンバーログインはこちら
            </Link>
          </p>
          <p className="mb-0 mt-3 text-center text-sm text-white/55">
            アカウントをお持ちでない方は{' '}
            <Link href="/signup" className="font-semibold text-white underline-offset-2 hover:underline">
              こちら
            </Link>
            {' '}から登録
          </p>

          <BottomLogo />
        </div>
      </div>
    </div>
  )
}
