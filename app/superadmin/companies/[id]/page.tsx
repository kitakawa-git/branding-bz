'use client'

// スーパー管理画面: 企業詳細ページ（編集+社員一覧+管理者一覧）
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Check } from 'lucide-react'
import { Fab, FabButton } from '@/components/ui/fab'
import { type ValuePropositionRef } from './_sections/ProofPointsSection'
import OntologySummaryHub from './_sections/OntologySummaryHub'

type Company = {
  id: string
  name: string
  logo_url: string | null
  brand_color_primary: string | null
  brand_color_secondary: string | null
  website_url: string | null
  created_at: string
}

type Profile = {
  id: string
  name: string
  position: string | null
  department: string | null
  email: string | null
  slug: string
}

type AdminUser = {
  id: string
  role: string
  is_superadmin: boolean
  created_at: string
  auth_email: string | null
}

export default function CompanyDetailPage() {
  const params = useParams()
  const companyId = params.id as string

  const [company, setCompany] = useState<Company | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [valueProps, setValueProps] = useState<ValuePropositionRef[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [viewStats, setViewStats] = useState({ total: 0, month: 0, week: 0 })

  // 編集用フォーム
  const [editName, setEditName] = useState('')
  const [editBrandColorPrimary, setEditBrandColorPrimary] = useState('#1a1a1a')
  const [editBrandColorSecondary, setEditBrandColorSecondary] = useState('#666666')
  const [editWebsiteUrl, setEditWebsiteUrl] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 企業データ
        const { data: companyData } = await supabase
          .from('companies')
          .select('*')
          .eq('id', companyId)
          .single()

        if (companyData) {
          setCompany(companyData)
          setEditName(companyData.name || '')
          setEditBrandColorPrimary(companyData.brand_color_primary || '#1a1a1a')
          setEditBrandColorSecondary(companyData.brand_color_secondary || '#666666')
          setEditWebsiteUrl(companyData.website_url || '')
        }

        // 社員一覧
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name, position, department, email, slug')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })

        setProfiles(profilesData || [])

        // 管理者一覧（auth.usersのメールをサブクエリで取得できないので別途処理）
        const { data: adminData } = await supabase
          .from('admin_users')
          .select('id, role, is_superadmin, created_at, auth_id')
          .eq('company_id', companyId)
          .order('created_at', { ascending: true })

        // admin_usersのauth_idからメールを取得するため、一旦表示
        const adminsWithEmail = (adminData || []).map((admin) => ({
          id: admin.id,
          role: admin.role,
          is_superadmin: admin.is_superadmin,
          created_at: admin.created_at,
          auth_email: null, // クライアントサイドではauth.usersにアクセスできないため
        }))
        setAdminUsers(adminsWithEmail)

        // 提供価値（証拠・表現ルールの紐づけ用セレクト）
        const { data: vpData } = await supabase
          .from('value_propositions')
          .select('id, title')
          .eq('company_id', companyId)
          .order('sort_order', { ascending: true })
        setValueProps((vpData as ValuePropositionRef[]) || [])

        // アクセス解析サマリー
        if (profilesData && profilesData.length > 0) {
          const profileIds = profilesData.map((p: Profile) => p.id)
          const { data: viewsData } = await supabase
            .from('card_views')
            .select('viewed_at')
            .in('profile_id', profileIds)

          if (viewsData) {
            const now = new Date()
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
            const dayOfWeek = now.getDay()
            const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
            const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff)
            weekStart.setHours(0, 0, 0, 0)

            setViewStats({
              total: viewsData.length,
              month: viewsData.filter(v => v.viewed_at >= monthStart).length,
              week: viewsData.filter(v => new Date(v.viewed_at) >= weekStart).length,
            })
          }
        }
      } catch (err) {
        console.error('[SuperAdmin] 企業詳細取得エラー:', err)
      }
      setLoading(false)
    }

    fetchData()
  }, [companyId])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    // 会社名を変更する場合は誤操作防止の確認ダイアログ（実データ取り違え事故の再発防止）
    const currentName = company?.name ?? ''
    if (editName.trim() !== currentName) {
      const ok = window.confirm(
        `会社名を変更します。\n\n「${currentName}」\n→「${editName.trim()}」\n\nこの操作で他の会社の名前を誤って書き換えていないか確認してください。続行しますか？`,
      )
      if (!ok) return
    }

    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('companies')
      .update({
        name: editName,
        brand_color_primary: editBrandColorPrimary,
        brand_color_secondary: editBrandColorSecondary,
        website_url: editWebsiteUrl,
      })
      .eq('id', companyId)

    if (error) {
      setMessage('保存に失敗しました: ' + error.message)
      setMessageType('error')
    } else {
      setMessage('保存しました')
      setMessageType('success')
      // 確認ダイアログが次回も正しい現在値と比較できるよう、ローカルの会社名を更新
      setCompany((prev) => (prev ? { ...prev, name: editName.trim() } : prev))
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <p className="text-muted-foreground text-center p-10">
        読み込み中...
      </p>
    )
  }

  if (!company) {
    return (
      <p className="text-muted-foreground text-center p-10">
        企業が見つかりません
      </p>
    )
  }

  return (
    <div>
      {/* ナビ */}
      <Link
        href="/superadmin/companies"
        className="text-muted-foreground no-underline text-sm inline-block mb-4"
      >
        <ArrowLeft size={14} className="inline" /> 企業一覧に戻る
      </Link>

      <h2 className="text-xl font-bold text-foreground mb-6">
        {company.name}
      </h2>

      {/* === アクセス解析サマリー === */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: '総閲覧数', value: viewStats.total, color: 'var(--ds-app-accent)' },
          { label: '今月', value: viewStats.month, color: '#16a34a' },
          { label: '今週', value: viewStats.week, color: '#f59e0b' },
        ].map((stat) => (
          <Card key={stat.label} className="bg-muted/50 border shadow-none">
            <CardContent className="text-center p-5">
              <p className="text-xs text-muted-foreground mb-1.5">
                {stat.label}
              </p>
              <p className="text-[28px] font-bold m-0" style={{ color: stat.color }}>
                {stat.value.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* === ブランドオントロジー（全機能の実体を内包する常設カード。重複セクションは置かない） === */}
      <Card className="bg-muted/50 border shadow-none mb-6">
        <CardContent className="p-6">
          <OntologySummaryHub companyId={companyId} valuePropositions={valueProps} />
        </CardContent>
      </Card>

      {/* === 企業情報編集セクション（設定系・下部） === */}
      <Card className="bg-muted/50 border shadow-none mb-6">
        <CardContent className="p-6">
          <h3 className="text-base font-bold text-foreground mb-4">
            企業情報
          </h3>

          {message && (
            <div className={messageType === 'success' ? 'bg-green-50 text-green-600 px-4 py-3 rounded-lg text-sm mb-4' : 'bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4'}>
              {message}
            </div>
          )}

          <form onSubmit={handleSave}>
            <div className="mb-5">
              <Label className="mb-1.5 font-bold">企業名</Label>
              <Input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-10"
              />
            </div>

            {/* スローガン / MVV の編集はブランドガイドライン（/admin/brand/guidelines）へ一本化。
                companies.slogan / mvv は廃止（表示は brand_guidelines 側を参照）。 */}

            <div className="mb-5">
              <Label className="mb-1.5 font-bold">ブランドカラー（プライマリ）</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={editBrandColorPrimary}
                  onChange={(e) => setEditBrandColorPrimary(e.target.value)}
                  className="w-12 h-12 border border-border rounded-lg cursor-pointer p-0.5"
                />
                <Input
                  type="text"
                  value={editBrandColorPrimary}
                  onChange={(e) => setEditBrandColorPrimary(e.target.value)}
                  className="h-10 w-[140px]"
                />
                <div
                  className="w-20 h-10 rounded-md border border-border"
                  style={{ backgroundColor: editBrandColorPrimary }}
                />
              </div>
            </div>

            <div className="mb-5">
              <Label className="mb-1.5 font-bold">ブランドカラー（セカンダリ）</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={editBrandColorSecondary}
                  onChange={(e) => setEditBrandColorSecondary(e.target.value)}
                  className="w-12 h-12 border border-border rounded-lg cursor-pointer p-0.5"
                />
                <Input
                  type="text"
                  value={editBrandColorSecondary}
                  onChange={(e) => setEditBrandColorSecondary(e.target.value)}
                  className="h-10 w-[140px]"
                />
                <div
                  className="w-20 h-10 rounded-md border border-border"
                  style={{ backgroundColor: editBrandColorSecondary }}
                />
              </div>
            </div>

            <div className="mb-5">
              <Label className="mb-1.5 font-bold">Webサイト URL</Label>
              <Input
                type="url"
                value={editWebsiteUrl}
                onChange={(e) => setEditWebsiteUrl(e.target.value)}
                className="h-10"
              />
            </div>

            {/* FabBar との重なりを防ぐスペーサー */}
            <div className="h-16" />

            {/* 保存 FAB（右下固定・include-bz node の FabButton と同装飾） */}
            <Fab>
              <FabButton type="submit" disabled={saving} icon={<Check size={16} />}>
                {saving ? '保存中...' : '保存'}
              </FabButton>
            </Fab>
          </form>
        </CardContent>
      </Card>

      {/* === 社員一覧セクション === */}
      <Card className="bg-muted/50 border shadow-none mb-6">
        <CardContent className="p-6">
          <h3 className="text-base font-bold text-foreground mb-4">
            従業員一覧（{profiles.length}名）
          </h3>

          {profiles.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              従業員が登録されていません
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">名前</th>
                  <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">部署</th>
                  <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">役職</th>
                  <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">メール</th>
                  <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">slug</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr key={profile.id}>
                    <td className="px-4 py-3 border-b border-border text-foreground font-semibold">{profile.name}</td>
                    <td className="px-4 py-3 border-b border-border text-muted-foreground">
                      {profile.department || '—'}
                    </td>
                    <td className="px-4 py-3 border-b border-border text-muted-foreground">
                      {profile.position || '—'}
                    </td>
                    <td className="px-4 py-3 border-b border-border text-muted-foreground text-[13px]">
                      {profile.email || '—'}
                    </td>
                    <td className="px-4 py-3 border-b border-border text-foreground text-[13px]">
                      <Link
                        href={`/card/${profile.slug}`}
                        target="_blank"
                        className="text-ds-app-accent no-underline"
                      >
                        {profile.slug}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* === 管理者一覧セクション === */}
      <Card className="bg-muted/50 border shadow-none">
        <CardContent className="p-6">
          <h3 className="text-base font-bold text-foreground mb-4">
            管理者（{adminUsers.length}名）
          </h3>

          {adminUsers.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              管理者が登録されていません
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">権限</th>
                  <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">スーパー管理者</th>
                  <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">登録日</th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map((admin) => (
                  <tr key={admin.id}>
                    <td className="px-4 py-3 border-b border-border text-foreground">
                      <span
                        className="py-0.5 px-2 rounded text-xs font-semibold"
                        style={{
                          backgroundColor: admin.role === 'owner' ? '#dbeafe' : '#f3f4f6',
                          color: admin.role === 'owner' ? '#1e40af' : '#6b7280',
                        }}
                      >
                        {admin.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 border-b border-border text-foreground">
                      {admin.is_superadmin ? (
                        <span className="py-0.5 px-2 bg-amber-100 text-amber-800 rounded text-xs font-semibold">
                          YES
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 border-b border-border text-muted-foreground text-[13px]">
                      {new Date(admin.created_at).toLocaleDateString('ja-JP')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
