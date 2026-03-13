'use client'

// 統一ログイン / サインアップページ
// /portal/auth            — 直接アクセス（本体ユーザー）
// /portal/auth?from=colors — カラーツールLPから
// /portal/auth?from=stp    — STPツールLPから
import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'

type AuthMode = 'login' | 'signup'

// from パラメータに応じたサブタイトル
const SUBTITLES: Record<string, string> = {
  colors: 'ブランドカラー定義ツールを利用するにはログインが必要です',
  stp: 'STP分析ツールを利用するにはログインが必要です',
}

export default function PortalAuthPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center font-sans">
        <p className="text-sm text-gray-500">読み込み中...</p>
      </div>
    }>
      <PortalAuthContent />
    </Suspense>
  )
}

function PortalAuthContent() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()

  const from = searchParams.get('from')

  // エラーパラメータ検出
  useEffect(() => {
    if (searchParams.get('error') === 'auth_failed') {
      setError('ログインに失敗しました。もう一度お試しください。')
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

  // 新規登録
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('パスワードが一致しません')
      setLoading(false)
      return
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('このメールアドレスは既に登録されています。ログインしてください。')
        } else {
          setError(signUpError.message)
        }
        return
      }

      if (data.user) {
        // メール確認が必要な場合
        if (data.session === null) {
          setError('')
          setMode('login')
          alert('確認メールを送信しました。メールを確認してからログインしてください。')
          return
        }
        redirectAfterAuth(data.user.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アカウント作成中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // セッションチェック中
  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center font-sans">
        <p className="text-sm text-gray-500">読み込み中...</p>
      </div>
    )
  }

  const subtitle = from ? SUBTITLES[from] || 'branding.bz にログイン' : 'branding.bz にログイン'

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center font-sans"
      style={{
        background: [
          'radial-gradient(ellipse 180% 160% at 5% 20%, rgba(196, 181, 253, 0.5) 0%, transparent 55%)',
          'radial-gradient(ellipse 160% 140% at 85% 10%, rgba(253, 186, 116, 0.4) 0%, transparent 55%)',
          'radial-gradient(ellipse 150% 130% at 50% 90%, rgba(167, 243, 208, 0.45) 0%, transparent 55%)',
          'radial-gradient(ellipse 130% 110% at 95% 65%, rgba(251, 207, 232, 0.4) 0%, transparent 55%)',
          '#ffffff',
        ].join(', '),
      }}
    >
      <div
        className="relative w-full max-w-[400px] mx-5 rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(12px) saturate(120%)',
          WebkitBackdropFilter: 'blur(12px) saturate(120%)',
          border: '1px solid rgba(255, 255, 255, 0.8)',
          boxShadow: '0px 8px 24px 0 rgba(12, 74, 110, 0.12), inset 0px 0px 4px 2px rgba(255, 255, 255, 0.15)',
        }}
      >
        <div className="absolute inset-0 pointer-events-none rounded-2xl"
          style={{ background: 'linear-gradient(to left top, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%)' }} />
        <div className="absolute inset-0 pointer-events-none rounded-2xl"
          style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 100%)' }} />

        <div className="relative z-10 p-10">
          <div className="mb-8 text-center">
            <img
              src="/logo.svg"
              alt="branding.bz"
              className="mx-auto mb-3"
              style={{ height: '32px', width: 'auto' }}
            />
            <p className="m-0 text-sm text-gray-500">
              {mode === 'login' ? subtitle : 'アカウントを作成'}
            </p>
          </div>

          {error && (
            <div className="mb-4 whitespace-pre-wrap break-words rounded-lg bg-red-50/80 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Googleログインボタン */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            className="flex w-full h-11 items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white font-medium text-gray-700 transition-all hover:bg-gray-50 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
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
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white/70 px-2 text-muted-foreground">または</span>
            </div>
          </div>

          <form onSubmit={mode === 'login' ? handleLogin : handleSignup}>
            <div className="mb-5">
              <h2 className="mb-1.5 text-sm font-bold text-gray-700">メールアドレス</h2>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="h-10 bg-white/60 border-white/80 focus-visible:ring-gray-400"
              />
            </div>

            <div className="mb-5">
              <h2 className="mb-1.5 text-sm font-bold text-gray-700">パスワード</h2>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                required
                minLength={6}
                className="h-10 bg-white/60 border-white/80 focus-visible:ring-gray-400"
              />
            </div>

            {mode === 'signup' && (
              <div className="mb-5">
                <h2 className="mb-1.5 text-sm font-bold text-gray-700">パスワード（確認）</h2>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="パスワードを再入力"
                  required
                  minLength={6}
                  className="h-10 bg-white/60 border-white/80 focus-visible:ring-gray-400"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="relative w-full h-11 rounded-full text-base font-bold text-white overflow-hidden transition-all hover:scale-105 hover:shadow-2xl disabled:opacity-50 disabled:hover:scale-100"
              style={{
                background: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(12px) saturate(120%)',
                WebkitBackdropFilter: 'blur(12px) saturate(120%)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                boxShadow: '0px 8px 24px 0 rgba(0, 0, 0, 0.2), inset 0px 1px 0px 0px rgba(255, 255, 255, 0.15)',
              }}
            >
              {loading
                ? (mode === 'login' ? 'ログイン中...' : 'アカウント作成中...')
                : (mode === 'login' ? 'ログイン' : 'アカウントを作成')
              }
            </button>
          </form>

          <p className="mb-0 mt-6 text-center text-xs">
            {mode === 'login' ? (
              <span className="text-gray-500">
                アカウントをお持ちでない方は{' '}
                <button
                  onClick={() => { setMode('signup'); setError('') }}
                  className="font-bold text-blue-600 underline-offset-2 hover:underline bg-transparent border-0 cursor-pointer"
                >
                  新規登録
                </button>
              </span>
            ) : (
              <span className="text-gray-500">
                アカウントをお持ちの方は{' '}
                <button
                  onClick={() => { setMode('login'); setError('') }}
                  className="font-bold text-blue-600 underline-offset-2 hover:underline bg-transparent border-0 cursor-pointer"
                >
                  ログイン
                </button>
              </span>
            )}
          </p>

          <p className="mb-0 mt-3 text-center text-xs text-gray-500">
            すべてのツール・サービスで
            <br />
            同じアカウントをご利用いただけます
          </p>
        </div>
      </div>
    </div>
  )
}
