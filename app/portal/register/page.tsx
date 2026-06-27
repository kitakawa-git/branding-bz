'use client'

// 招待リンクからのセルフ登録ページ（API Route経由）
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ShieldAlert } from 'lucide-react'

export default function PortalRegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#08080a] flex items-center justify-center font-sans text-white/55">
        読み込み中...
      </div>
    }>
      <PortalRegisterContent />
    </Suspense>
  )
}

function PortalRegisterContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [companyName, setCompanyName] = useState('')
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) {
      setTokenValid(false)
      return
    }

    const verifyToken = async () => {
      const { data, error } = await supabase
        .from('invite_links')
        .select('company_id')
        .eq('token', token)
        .eq('is_active', true)
        .single()

      if (error || !data) {
        setTokenValid(false)
        return
      }

      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', data.company_id)
        .single()

      if (company) setCompanyName(company.name)
      setTokenValid(true)
    }

    verifyToken()
  }, [token])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== passwordConfirm) {
      setError('パスワードが一致しません')
      return
    }

    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/members/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          display_name: displayName,
          token,
        }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || '登録に失敗しました')

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: result.email,
        password: result.password,
      })

      if (signInError) {
        throw new Error('ログインに失敗しました: ' + signInError.message)
      }

      router.replace('/portal')
    } catch (err) {
      setError(err instanceof Error ? err.message : '登録に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // トークン検証中
  if (tokenValid === null) {
    return (
      <div className="min-h-screen bg-[#08080a] flex items-center justify-center font-sans text-white/55">
        招待リンクを確認中...
      </div>
    )
  }

  // 無効なトークン
  if (tokenValid === false) {
    return (
      <div className="min-h-screen bg-[#08080a] flex items-center justify-center font-sans text-white">
        <Card
          className="max-w-[400px] w-full mx-5 border border-white/10 shadow-none"
          style={{ background: '#0c0c11', boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 24px 60px -20px rgba(0,0,0,0.45)' }}
        >
          <CardContent className="p-10 text-center">
            <div className="mb-4 flex justify-center text-white/55">
              <ShieldAlert size={48} />
            </div>
            <h2 className="text-xl font-bold text-white mb-3">
              無効な招待リンク
            </h2>
            <p className="text-base sm:text-sm text-white/55 m-0 leading-relaxed">
              この招待リンクは無効または期限切れです。管理者に新しいリンクを発行してもらってください。
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 登録フォーム
  return (
    <div
      className="min-h-screen flex items-center justify-center font-sans text-white"
      style={{
        background: [
          'radial-gradient(ellipse 120% 90% at 12% 8%, rgba(49,46,129,0.5) 0%, transparent 55%)',
          'radial-gradient(ellipse 110% 90% at 88% 12%, rgba(168,85,247,0.25) 0%, transparent 55%)',
          'radial-gradient(ellipse 120% 100% at 50% 110%, rgba(37,99,235,0.28) 0%, transparent 60%)',
          '#08080a',
        ].join(', '),
      }}
    >
      <Card
        className="w-full max-w-[400px] mx-5 border border-white/10 shadow-none"
        style={{ background: '#0c0c11', boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 24px 60px -20px rgba(0,0,0,0.45)' }}
      >
        <CardContent className="p-10">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">
              branding.bz
            </h1>
            <p className="text-sm text-white/55 m-0">
              メンバー登録
            </p>
            {companyName && (
              <p className="text-xs text-ds-app-accent mt-2 font-bold m-0">
                {companyName}
              </p>
            )}
          </div>

          {error && (
            <div className="border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister}>
            <div className="mb-5">
              <Label className="mb-1.5 text-sm font-semibold text-white/70">表示名</Label>
              <Input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="山田太郎"
                required
                className="h-11 bg-white/[0.04] border-white/15 text-white placeholder:text-white/30 focus-visible:ring-white/30"
              />
            </div>

            <div className="mb-5">
              <Label className="mb-1.5 text-sm font-semibold text-white/70">メールアドレス</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="member@example.com"
                required
                className="h-11 bg-white/[0.04] border-white/15 text-white placeholder:text-white/30 focus-visible:ring-white/30"
              />
            </div>

            <div className="mb-5">
              <Label className="mb-1.5 text-sm font-semibold text-white/70">パスワード（8文字以上）</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                required
                minLength={8}
                className="h-11 bg-white/[0.04] border-white/15 text-white placeholder:text-white/30 focus-visible:ring-white/30"
              />
            </div>

            <div className="mb-5">
              <Label className="mb-1.5 text-sm font-semibold text-white/70">パスワード確認</Label>
              <Input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="もう一度入力"
                required
                className="h-11 bg-white/[0.04] border-white/15 text-white placeholder:text-white/30 focus-visible:ring-white/30"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-full text-base font-bold text-black bg-white transition-transform hover:scale-[1.02] disabled:opacity-50"
            >
              {loading ? '登録中...' : '登録する'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
