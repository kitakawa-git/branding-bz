'use client'

// メンバーログインページ
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
    <div
      className="min-h-screen flex items-center justify-center font-sans"
      style={{
        background: [
          'radial-gradient(ellipse 180% 160% at 5% 20%, rgba(253, 186, 116, 0.7) 0%, transparent 55%)',
          'radial-gradient(ellipse 160% 140% at 85% 10%, rgba(251, 207, 232, 0.65) 0%, transparent 55%)',
          'radial-gradient(ellipse 150% 130% at 50% 90%, rgba(254, 215, 170, 0.6) 0%, transparent 55%)',
          'radial-gradient(ellipse 130% 110% at 95% 65%, rgba(252, 165, 165, 0.5) 0%, transparent 55%)',
          'linear-gradient(135deg, rgba(255, 251, 245, 1) 0%, rgba(255, 247, 237, 1) 50%, rgba(255, 241, 242, 1) 100%)',
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
        {/* リフレクション */}
        <div className="absolute inset-0 pointer-events-none rounded-2xl"
          style={{ background: 'linear-gradient(to left top, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%)' }} />
        <div className="absolute inset-0 pointer-events-none rounded-2xl"
          style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 100%)' }} />

        <div className="relative z-10 p-10">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              branding.bz
            </h1>
            <p className="text-sm text-gray-500 m-0">
              メンバーログイン
            </p>
          </div>

          {error && (
            <div className="bg-red-50/80 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="mb-5">
              <Label className="mb-1.5 font-bold text-gray-700">メールアドレス</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="member@example.com"
                required
                className="h-10 bg-white/60 border-white/80 focus-visible:ring-gray-400"
              />
            </div>

            <div className="mb-5">
              <Label className="mb-1.5 font-bold text-gray-700">パスワード</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                required
                className="h-10 bg-white/60 border-white/80 focus-visible:ring-gray-400"
              />
            </div>

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
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-6 mb-0">
            <Link href="/admin/login" className="text-blue-600 no-underline hover:underline">
              管理者ログインはこちら
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
