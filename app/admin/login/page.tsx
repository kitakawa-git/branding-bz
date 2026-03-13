'use client'

// ログインページ — ダークモード リキッドグラス
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Suspense } from 'react'

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center font-sans"
        style={{ background: 'linear-gradient(135deg, #0f0f1a 0%, #141425 50%, #0d0d1a 100%)' }}>
        <p className="text-sm text-white/50">読み込み中...</p>
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
      console.log('[Login] ステップ1: 認証開始 email=', email)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        console.error('[Login] ステップ1失敗: 認証エラー:', authError.message)
        setError('メールアドレスまたはパスワードが正しくありません')
        return
      }

      console.log('[Login] ステップ1完了: 認証成功 userId=', authData.user.id)

      console.log('[Login] ステップ2: admin_users検索中...')
      const { data: adminUser, error: adminError } = await supabase
        .from('admin_users')
        .select('*')
        .eq('auth_id', authData.user.id)
        .single()

      console.log('[Login] ステップ2結果:', {
        adminUser: adminUser ? { company_id: adminUser.company_id, role: adminUser.role, is_superadmin: adminUser.is_superadmin } : null,
        adminError: adminError?.message,
      })

      if (adminError || !adminUser) {
        const errorMsg = adminError
          ? `管理者データ取得エラー: ${adminError.message}（RLSが有効の場合 sql/002_disable_rls.sql を実行してください）`
          : 'このアカウントは管理者として登録されていません。admin_usersテーブルにデータがあるか確認してください。'
        console.error('[Login] ステップ2失敗:', errorMsg)
        setError(errorMsg)
        await supabase.auth.signOut()
        return
      }

      const superAdmin = adminUser.is_superadmin === true
      console.log('[Login] ステップ3: is_superadmin=', superAdmin)

      if (superAdmin) {
        console.log('[Login] ステップ3: スーパー管理者 → 遷移先選択画面を表示')
        setIsSuperAdmin(true)
        setLoggedIn(true)
        return
      }

      console.log('[Login] ステップ4: 通常管理者 → /admin/members にリダイレクト (companyId:', adminUser.company_id, ')')
      router.replace('/admin/members')
    } catch (err) {
      console.error('[Login] 予期しないエラー:', err)
      setError(`ログイン処理中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      console.log('[Login] finally: setLoading(false)')
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

  /* ── グラスモーフィズム共通スタイル ── */
  const glassCard: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.06)',
    backdropFilter: 'blur(24px) saturate(140%)',
    WebkitBackdropFilter: 'blur(24px) saturate(140%)',
    border: '1px solid rgba(255, 255, 255, 0.10)',
    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
  }

  const glassInput: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.06)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.10)',
  }

  /* ── 背景グラデーション ── */
  const bgStyle: React.CSSProperties = {
    background: [
      'radial-gradient(ellipse 120% 100% at 10% 20%, rgba(99, 102, 241, 0.25) 0%, transparent 50%)',
      'radial-gradient(ellipse 100% 80% at 90% 80%, rgba(139, 92, 246, 0.20) 0%, transparent 50%)',
      'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(59, 130, 246, 0.12) 0%, transparent 50%)',
      'linear-gradient(135deg, #0f0f1a 0%, #141425 50%, #0d0d1a 100%)',
    ].join(', '),
  }

  // スーパー管理者用の遷移先選択画面
  if (loggedIn && isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center font-sans px-5" style={bgStyle}>
        <div className="w-full max-w-[420px] rounded-2xl p-10 relative overflow-hidden" style={glassCard}>
          {/* リフレクション */}
          <div className="absolute inset-0 pointer-events-none rounded-2xl"
            style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 40%)' }} />

          <div className="relative">
            <div className="text-center mb-8">
              <img
                src="/logo.svg"
                alt="branding.bz"
                className="mx-auto mb-3"
                style={{ height: '32px', width: 'auto', filter: 'brightness(0) invert(1)' }}
              />
              <p className="text-sm text-white/50 m-0">
                ログイン成功 — 遷移先を選択
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button asChild className="h-12 text-[15px] font-bold rounded-xl bg-white text-gray-900 hover:bg-white/90 shadow-lg">
                <Link href="/superadmin/companies">
                  スーパー管理画面
                </Link>
              </Button>
              <Button asChild className="h-12 text-[15px] font-bold rounded-xl text-white hover:bg-white/10"
                style={glassInput}>
                <Link href="/admin/members">
                  通常管理画面
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center font-sans px-5" style={bgStyle}>
      <div className="w-full max-w-[420px] rounded-2xl p-10 relative overflow-hidden" style={glassCard}>
        {/* リフレクション */}
        <div className="absolute inset-0 pointer-events-none rounded-2xl"
          style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 40%)' }} />

        <div className="relative">
          <div className="text-center mb-8">
            <img
              src="/logo.svg"
              alt="branding.bz"
              className="mx-auto mb-3"
              style={{ height: '32px', width: 'auto', filter: 'brightness(0) invert(1)' }}
            />
            <p className="text-sm text-white/50 m-0">
              管理画面にログイン
            </p>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl text-sm mb-5 whitespace-pre-wrap break-words text-red-300"
              style={{ background: 'rgba(220, 38, 38, 0.15)', border: '1px solid rgba(220, 38, 38, 0.25)' }}>
              {error}
            </div>
          )}

          {/* Googleログインボタン */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            className="flex w-full h-11 items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white font-medium text-gray-700 transition-all hover:bg-gray-50 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {googleLoading ? '接続中...' : 'Googleでログイン'}
          </button>

          {/* セパレーター */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="px-3 text-white/30" style={{ background: 'rgba(15, 15, 26, 0.8)' }}>または</span>
            </div>
          </div>

          <form onSubmit={handleLogin}>
            <div className="mb-5">
              <label className="block text-xs font-semibold mb-2 text-white/60 tracking-wide">
                メールアドレス
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                className="h-11 rounded-xl text-white placeholder:text-white/30 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-0 focus-visible:border-indigo-400/40"
                style={glassInput}
              />
            </div>

            <div className="mb-6">
              <label className="block text-xs font-semibold mb-2 text-white/60 tracking-wide">
                パスワード
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                required
                className="h-11 rounded-xl text-white placeholder:text-white/30 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-0 focus-visible:border-indigo-400/40"
                style={glassInput}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="relative w-full h-11 rounded-full text-base font-bold text-gray-900 bg-white overflow-hidden transition-all hover:scale-105 hover:shadow-2xl hover:bg-white/90 shadow-lg disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>

          <p className="text-center text-xs mt-6 mb-0">
            <Link href="/portal/auth" className="text-indigo-300/80 no-underline hover:text-indigo-200 hover:underline transition-colors">
              メンバーログインはこちら
            </Link>
          </p>
          <p className="text-center text-xs text-white/40 mt-3 mb-0">
            アカウントをお持ちでない方は{' '}
            <Link href="/signup" className="text-indigo-300/80 no-underline font-bold hover:text-indigo-200 hover:underline transition-colors">
              こちら
            </Link>
            {' '}から登録
          </p>
        </div>
      </div>
    </div>
  )
}
