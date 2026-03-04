'use client'

// ミニアプリ用ログイン / サインアップページ
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

type AuthMode = 'login' | 'signup'

export default function ToolsAuthPage() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const createSessionAndRedirect = async (userId: string) => {
    // セッション作成API呼び出し
    const res = await fetch('/api/tools/colors/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'セッション作成に失敗しました')
    }

    const { sessionId } = await res.json()
    router.replace(`/tools/colors/app/${sessionId}`)
  }

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

      await createSessionAndRedirect(data.user.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログイン中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

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
      // サインアップAPI経由でAuth user作成
      const res = await fetch('/api/tools/colors/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, isNewUser: true }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'アカウント作成に失敗しました')
      }

      // 作成成功 → ログイン
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (loginError) {
        throw new Error('アカウントは作成されましたがログインに失敗しました。ログイン画面からお試しください。')
      }

      const { sessionId } = await res.json()
      router.replace(`/tools/colors/app/${sessionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アカウント作成中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* 戻るリンク */}
      <div className="mx-auto w-full max-w-[400px] px-5 pt-8">
        <Link
          href="/tools/colors"
          className="inline-flex items-center gap-1 text-sm text-gray-500 no-underline hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          ツール紹介に戻る
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-5 pb-16">
        <Card className="w-full max-w-[400px] bg-[hsl(220_13%_18%)] border-[hsl(218_14%_26%)] shadow-none">
          <CardContent className="p-10">
            <div className="mb-8 text-center">
              <h1 className="mb-2 text-2xl font-bold text-white">
                brandconnect
              </h1>
              <p className="m-0 text-sm text-[hsl(216_12%_70%)]">
                {mode === 'login' ? 'カラー定義ツールにログイン' : 'アカウントを作成'}
              </p>
            </div>

            {error && (
              <div className="mb-4 whitespace-pre-wrap break-words rounded-lg bg-red-900/40 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={mode === 'login' ? handleLogin : handleSignup}>
              <div className="mb-5">
                <h2 className="mb-3 text-sm font-bold text-[hsl(216_12%_84%)]">メールアドレス</h2>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="h-10 bg-[hsl(218_14%_26%)] border-[hsl(218_14%_32%)] text-white placeholder:text-[hsl(216_12%_50%)] focus-visible:ring-[hsl(217_91%_60%)]"
                />
              </div>

              <div className="mb-5">
                <h2 className="mb-3 text-sm font-bold text-[hsl(216_12%_84%)]">パスワード</h2>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6文字以上"
                  required
                  minLength={6}
                  className="h-10 bg-[hsl(218_14%_26%)] border-[hsl(218_14%_32%)] text-white placeholder:text-[hsl(216_12%_50%)] focus-visible:ring-[hsl(217_91%_60%)]"
                />
              </div>

              {mode === 'signup' && (
                <div className="mb-5">
                  <h2 className="mb-3 text-sm font-bold text-[hsl(216_12%_84%)]">パスワード（確認）</h2>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="パスワードを再入力"
                    required
                    minLength={6}
                    className="h-10 bg-[hsl(218_14%_26%)] border-[hsl(218_14%_32%)] text-white placeholder:text-[hsl(216_12%_50%)] focus-visible:ring-[hsl(217_91%_60%)]"
                  />
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full text-base font-bold bg-white text-[hsl(220_13%_18%)] hover:bg-white/90"
              >
                {loading
                  ? (mode === 'login' ? 'ログイン中...' : 'アカウント作成中...')
                  : (mode === 'login' ? 'ログイン' : 'アカウントを作成')
                }
              </Button>
            </form>

            <p className="mb-0 mt-6 text-center text-xs">
              {mode === 'login' ? (
                <span className="text-[hsl(216_12%_60%)]">
                  アカウントをお持ちでない方は{' '}
                  <button
                    onClick={() => { setMode('signup'); setError('') }}
                    className="font-bold text-[hsl(217_91%_70%)] underline-offset-2 hover:underline bg-transparent border-0 cursor-pointer"
                  >
                    新規登録
                  </button>
                </span>
              ) : (
                <span className="text-[hsl(216_12%_60%)]">
                  アカウントをお持ちの方は{' '}
                  <button
                    onClick={() => { setMode('login'); setError('') }}
                    className="font-bold text-[hsl(217_91%_70%)] underline-offset-2 hover:underline bg-transparent border-0 cursor-pointer"
                  >
                    ログイン
                  </button>
                </span>
              )}
            </p>

            <p className="mb-0 mt-3 text-center text-xs text-[hsl(216_12%_60%)]">
              brandconnect本体をご利用の方も
              <br />
              同じアカウントでログインできます
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
