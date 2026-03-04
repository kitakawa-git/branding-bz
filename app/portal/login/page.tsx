'use client'

// メンバーログインページ
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function PortalLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError('メールアドレスまたはパスワードが正しくありません')
        return
      }

      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('*')
        .eq('auth_id', authData.user.id)
        .eq('is_active', true)
        .single()

      if (memberError || !memberData) {
        setError('メンバーとして登録されていません。管理者に連絡してください。')
        await supabase.auth.signOut()
        return
      }

      router.replace('/portal')
    } catch (err) {
      setError(`ログイン処理中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center font-sans">
      <Card className="w-full max-w-[400px] mx-5 bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-10">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              brandconnect
            </h1>
            <p className="text-sm text-muted-foreground m-0">
              メンバーログイン
            </p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="mb-5">
              <Label className="mb-1.5 font-bold">メールアドレス</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="member@example.com"
                required
                className="h-10"
              />
            </div>

            <div className="mb-5">
              <Label className="mb-1.5 font-bold">パスワード</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                required
                className="h-10"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 text-base font-bold"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6 mb-0">
            <Link href="/admin/login" className="text-blue-600 no-underline hover:underline">
              管理者ログインはこちら
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
