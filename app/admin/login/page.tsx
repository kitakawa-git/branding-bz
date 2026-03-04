'use client'

// ログインページ
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  const router = useRouter()

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

  // スーパー管理者用の遷移先選択画面
  if (loggedIn && isSuperAdmin) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center font-sans">
        <Card className="w-full max-w-[400px] mx-5 bg-[hsl(220_13%_18%)] border-[hsl(218_14%_26%)] shadow-none">
          <CardContent className="p-10">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-white mb-2">
                brandconnect
              </h1>
              <p className="text-sm text-[hsl(216_12%_70%)] m-0">
                ログイン成功 — 遷移先を選択
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button asChild className="h-12 text-[15px] font-bold bg-white text-[hsl(220_13%_18%)] hover:bg-white/90">
                <Link href="/superadmin/companies">
                  スーパー管理画面
                </Link>
              </Button>
              <Button asChild className="h-12 text-[15px] font-bold bg-[hsl(218_14%_26%)] text-white hover:bg-[hsl(218_14%_30%)]">
                <Link href="/admin/members">
                  通常管理画面
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center font-sans">
      <Card className="w-full max-w-[400px] mx-5 bg-[hsl(220_13%_18%)] border-[hsl(218_14%_26%)] shadow-none">
        <CardContent className="p-10">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">
              brandconnect
            </h1>
            <p className="text-sm text-[hsl(216_12%_70%)] m-0">
              管理画面にログイン
            </p>
          </div>

          {error && (
            <div className="bg-red-900/40 text-red-300 px-4 py-3 rounded-lg text-sm mb-4 whitespace-pre-wrap break-words">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="mb-5">
              <h2 className="text-sm font-bold mb-3 text-[hsl(216_12%_84%)]">メールアドレス</h2>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                className="h-10 bg-[hsl(218_14%_26%)] border-[hsl(218_14%_32%)] text-white placeholder:text-[hsl(216_12%_50%)] focus-visible:ring-[hsl(217_91%_60%)]"
              />
            </div>

            <div className="mb-5">
              <h2 className="text-sm font-bold mb-3 text-[hsl(216_12%_84%)]">パスワード</h2>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                required
                className="h-10 bg-[hsl(218_14%_26%)] border-[hsl(218_14%_32%)] text-white placeholder:text-[hsl(216_12%_50%)] focus-visible:ring-[hsl(217_91%_60%)]"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 text-base font-bold bg-white text-[hsl(220_13%_18%)] hover:bg-white/90"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </Button>
          </form>

          <p className="text-center text-xs mt-6 mb-0">
            <Link href="/portal/login" className="text-[hsl(217_91%_70%)] no-underline hover:underline">
              メンバーログインはこちら
            </Link>
          </p>
          <p className="text-center text-xs text-[hsl(216_12%_60%)] mt-3 mb-0">
            アカウントをお持ちでない方は{' '}
            <Link href="/signup" className="text-[hsl(217_91%_70%)] no-underline font-bold hover:underline">
              こちら
            </Link>
            {' '}から登録
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
