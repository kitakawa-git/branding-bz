'use client'

// スーパー管理画面: 新規企業+管理者アカウント同時作成
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft } from 'lucide-react'

export default function NewCompanyPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // 企業情報
  const [companyName, setCompanyName] = useState('')
  const [slogan, setSlogan] = useState('')
  const [mvv, setMvv] = useState('')
  const [brandColorPrimary, setBrandColorPrimary] = useState('#1a1a1a')
  const [brandColorSecondary, setBrandColorSecondary] = useState('#666666')
  const [websiteUrl, setWebsiteUrl] = useState('')

  // 管理者アカウント情報
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccessMessage('')

    try {
      // ステップ1: 認証トークンを取得
      console.log('[NewCompany] ステップ1: 認証セッション取得中...')
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        console.error('[NewCompany] ステップ1失敗: セッションエラー:', sessionError.message)
        setError(`セッションエラー: ${sessionError.message}`)
        return
      }

      if (!session) {
        console.error('[NewCompany] ステップ1失敗: セッションなし')
        setError('認証セッションがありません。再ログインしてください。')
        return
      }

      console.log('[NewCompany] ステップ1完了: トークン取得成功')

      // ステップ2: API Routeにリクエスト
      console.log('[NewCompany] ステップ2: API呼び出し中... POST /api/superadmin/create-company')
      console.log('[NewCompany] 送信データ:', { companyName, adminEmail, slogan: slogan ? '(あり)' : '(なし)' })

      let res: Response
      try {
        res = await fetch('/api/superadmin/create-company', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            companyName,
            slogan,
            mvv,
            brandColorPrimary,
            brandColorSecondary,
            websiteUrl,
            adminEmail,
            adminPassword,
          }),
        })
      } catch (fetchErr) {
        // ネットワークエラー（fetch自体が失敗）
        console.error('[NewCompany] ステップ2失敗: fetch例外:', fetchErr)
        setError(`ネットワークエラー: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`)
        return
      }

      console.log('[NewCompany] ステップ2完了: APIレスポンス status=', res.status)

      // ステップ3: レスポンス解析
      console.log('[NewCompany] ステップ3: レスポンス解析中...')
      let result
      try {
        result = await res.json()
      } catch (jsonErr) {
        console.error('[NewCompany] ステップ3失敗: JSON解析エラー:', jsonErr)
        setError(`APIレスポンス解析エラー (status=${res.status}): レスポンスがJSONではありません`)
        return
      }

      console.log('[NewCompany] ステップ3完了: レスポンス=', JSON.stringify(result))

      if (!res.ok) {
        console.error('[NewCompany] APIエラー:', result.error)
        setError(result.error || `作成に失敗しました (status=${res.status})`)
        return
      }

      // ステップ4: 成功
      console.log('[NewCompany] ステップ4: 作成成功! → 企業一覧へ遷移')
      setSuccessMessage(`企業「${result.company?.name}」を作成しました。リダイレクト中...`)
      setTimeout(() => {
        router.push('/superadmin/companies')
      }, 1000)
    } catch (err) {
      console.error('[NewCompany] 予期しないエラー:', err)
      setError(`予期しないエラー: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      // どのパスを通っても必ず saving を解除
      console.log('[NewCompany] finally: setSaving(false)')
      setSaving(false)
    }
  }

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/superadmin/companies"
          className="text-muted-foreground no-underline text-sm"
        >
          <ArrowLeft size={14} className="inline" /> 企業一覧に戻る
        </Link>
      </div>

      {/* タイトルはヘッダーのパンくずに移動 */}
      <Card className="bg-muted/50 border shadow-none max-w-[600px]">
        <CardContent className="p-6">
          {/* 成功メッセージ */}
          {successMessage && (
            <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg text-sm mb-4">
              {successMessage}
            </div>
          )}

          {/* エラーメッセージ */}
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4 whitespace-pre-wrap break-words">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* === 企業情報セクション === */}
            <h3 className="text-base font-bold text-foreground mb-4 pb-2 border-b border-border">
              企業情報
            </h3>

            <div className="mb-5">
              <Label className="mb-1.5 font-bold">企業名 *</Label>
              <Input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="株式会社○○"
                required
                className="h-10"
              />
            </div>

            <div className="mb-5">
              <Label className="mb-1.5 font-bold">スローガン</Label>
              <Input
                type="text"
                value={slogan}
                onChange={(e) => setSlogan(e.target.value)}
                placeholder="企業のスローガン"
                className="h-10"
              />
            </div>

            <div className="mb-5">
              <Label className="mb-1.5 font-bold">ミッション・ビジョン・バリュー</Label>
              <textarea
                value={mvv}
                onChange={(e) => setMvv(e.target.value)}
                placeholder="企業のMVVを入力"
                className="w-full px-3 py-2.5 bg-white border border-border rounded-lg text-sm outline-none resize-y min-h-[100px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="mb-5">
              <Label className="mb-1.5 font-bold">ブランドカラー（プライマリ）</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={brandColorPrimary}
                  onChange={(e) => setBrandColorPrimary(e.target.value)}
                  className="w-12 h-12 border border-border rounded-lg cursor-pointer p-0.5"
                />
                <Input
                  type="text"
                  value={brandColorPrimary}
                  onChange={(e) => setBrandColorPrimary(e.target.value)}
                  className="h-10 w-[140px]"
                />
              </div>
            </div>

            <div className="mb-5">
              <Label className="mb-1.5 font-bold">ブランドカラー（セカンダリ）</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={brandColorSecondary}
                  onChange={(e) => setBrandColorSecondary(e.target.value)}
                  className="w-12 h-12 border border-border rounded-lg cursor-pointer p-0.5"
                />
                <Input
                  type="text"
                  value={brandColorSecondary}
                  onChange={(e) => setBrandColorSecondary(e.target.value)}
                  className="h-10 w-[140px]"
                />
              </div>
            </div>

            <div className="mb-5">
              <Label className="mb-1.5 font-bold">Webサイト URL</Label>
              <Input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://example.com"
                className="h-10"
              />
            </div>

            {/* === 管理者アカウントセクション === */}
            <h3 className="text-base font-bold text-foreground mt-6 mb-4 pb-2 border-b border-border">
              管理者アカウント
            </h3>

            <div className="mb-5">
              <Label className="mb-1.5 font-bold">メールアドレス *</Label>
              <Input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@company.com"
                required
                className="h-10"
              />
            </div>

            <div className="mb-5">
              <Label className="mb-1.5 font-bold">パスワード *</Label>
              <Input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="8文字以上の安全なパスワード"
                required
                minLength={8}
                className="h-10"
              />
              <p className="text-xs text-muted-foreground mt-1">
                ※ このメールアドレスとパスワードで管理画面にログインできます
              </p>
            </div>

            {/* ボタン */}
            <div className="flex gap-3 mt-6">
              <Button
                type="submit"
                disabled={saving}
                className={`bg-[#1e3a5f] hover:bg-[#2a4a6f] ${saving ? 'opacity-60' : ''}`}
              >
                {saving ? '作成中...' : '企業+管理者を作成'}
              </Button>
              <Button variant="outline" asChild>
                <Link href="/superadmin/companies">
                  キャンセル
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
