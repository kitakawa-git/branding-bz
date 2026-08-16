'use client'

// 新規企業 + 管理者アカウント同時作成フォーム
// /superadmin/companies/new の本体ロジックを抽出。
// モーダル用途では onSuccess/onCancel を渡すことで router.push を抑止する。
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check } from 'lucide-react'
import { Fab, FabButton } from '@/components/ui/fab'

interface CompanyCreateFormProps {
  /** 保存成功時の callback。指定するとモーダルモードになり router.push を行わない */
  onSuccess?: (companyId: string) => void
  /** キャンセル時の callback。未指定なら /superadmin/companies へ遷移 */
  onCancel?: () => void
}

export default function CompanyCreateForm({ onSuccess, onCancel }: CompanyCreateFormProps) {
  const router = useRouter()
  const isModal = !!onSuccess

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // 企業情報（スローガン/MVV/ブランドカラーは作成時には入力しない。
  // 表示は brand_guidelines / brand_visuals 側を使うため、作成後に管理画面で設定する）
  const [companyName, setCompanyName] = useState('')
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
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        setError(`セッションエラー: ${sessionError.message}`)
        return
      }
      if (!session) {
        setError('認証セッションがありません。再ログインしてください。')
        return
      }

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
            websiteUrl,
            adminEmail,
            adminPassword,
          }),
        })
      } catch (fetchErr) {
        setError(`ネットワークエラー: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`)
        return
      }

      let result
      try {
        result = await res.json()
      } catch {
        setError(`APIレスポンス解析エラー (status=${res.status}): レスポンスがJSONではありません`)
        return
      }

      if (!res.ok) {
        setError(result.error || `作成に失敗しました (status=${res.status})`)
        return
      }

      setSuccessMessage(`ブランド「${result.company?.name}」を作成しました。`)

      // モーダル時は親側で閉じる、通常時は一覧へ遷移
      if (onSuccess) {
        onSuccess(result.company?.id)
      } else {
        setTimeout(() => {
          router.push('/superadmin/companies')
        }, 800)
      }
    } catch (err) {
      setError(`予期しないエラー: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
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

      {/* === 企業情報セクション === */}
      <h3 className="text-base font-bold text-foreground mb-4 pb-2 border-b border-border">
        ブランド情報
      </h3>

      <div className="mb-5">
        <Label className="mb-1.5 font-bold">ブランド名 *</Label>
        <Input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="株式会社○○" required className="h-10" />
      </div>

      <div className="mb-5">
        <Label className="mb-1.5 font-bold">Webサイト URL</Label>
        <Input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://example.com" className="h-10" />
        <p className="text-xs text-muted-foreground mt-1">
          ※ スローガン・MVV・ブランドカラーは作成後、管理画面の「ブランド方針」「ビジュアル」で設定します
        </p>
      </div>

      {/* === 管理者アカウントセクション === */}
      <h3 className="text-base font-bold text-foreground mt-6 mb-4 pb-2 border-b border-border">
        管理者アカウント
      </h3>

      <div className="mb-5">
        <Label className="mb-1.5 font-bold">メールアドレス *</Label>
        <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@company.com" required className="h-10" />
      </div>

      <div className="mb-5">
        <Label className="mb-1.5 font-bold">パスワード *</Label>
        <Input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="8文字以上の安全なパスワード" required minLength={8} className="h-10" />
        <p className="text-xs text-muted-foreground mt-1">
          ※ このメールアドレスとパスワードで管理画面にログインできます
        </p>
      </div>

      {/* フッター: モーダル時は通常配置・通常時は FAB */}
      {isModal ? (
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel ?? (() => router.push('/superadmin/companies'))}
            disabled={saving}
            className="flex items-center justify-center h-10 px-5 rounded-full hover:scale-105 transition-transform cursor-pointer text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 bg-white text-foreground border border-gray-300 shadow-sm"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-1 h-10 px-5 rounded-full hover:scale-105 transition-transform cursor-pointer text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 bg-foreground text-background shadow-sm"
          >
            <Check size={16} />
            {saving ? '作成中...' : '作成'}
          </button>
        </div>
      ) : (
        <>
          <div className="h-16" />
          <Fab>
            <FabButton variant="secondary" onClick={() => router.push('/superadmin/companies')} disabled={saving}>
              キャンセル
            </FabButton>
            <FabButton type="submit" disabled={saving} icon={<Check size={16} />}>
              {saving ? '作成中...' : '作成'}
            </FabButton>
          </Fab>
        </>
      )}
    </form>
  )
}
