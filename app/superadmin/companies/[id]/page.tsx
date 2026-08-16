'use client'

// スーパー管理画面: 企業詳細ページ（編集+社員一覧+管理者一覧）
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, ArrowRight, Check, Eye } from 'lucide-react'
import { Fab, FabButton } from '@/components/ui/fab'
import { Button } from '@/components/ui/button'
import { PLAN_LABELS, PLAN_VALUES, resolvePlanDisplay } from '@/lib/billing/plan-display'
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
  plan: string | null
  plan_started_at: string | null
  plan_expires_at: string | null
  is_demo: boolean | null
}

type Profile = {
  id: string
  name: string
  position: string | null
  department: string | null
  email: string | null
  slug: string
}

// 従業員（profiles）1件あたりのログイン状況。members 経由で auth ユーザーに紐づく
type LoginInfo = {
  profile_id: string
  /** ログイン用アカウントが作られているか（招待前は false） */
  has_account: boolean
  status: string | null
  last_sign_in_at: string | null
}

type AdminUser = {
  id: string
  role: string
  is_superadmin: boolean
  created_at: string
  auth_email: string | null
}

/**
 * 最終ログインの表示。「まだ招待していない」と「招待したがまだ入っていない」は
 * 対応が変わるので、どちらも「—」にせず言葉で分ける
 */
function formatLastLogin(info: LoginInfo | undefined): string {
  if (!info || !info.has_account) return 'アカウント未作成'
  if (!info.last_sign_in_at) return '未ログイン'
  return new Date(info.last_sign_in_at).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CompanyDetailPage() {
  const params = useParams()
  const companyId = params.id as string

  const [company, setCompany] = useState<Company | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [loginByProfile, setLoginByProfile] = useState<Record<string, LoginInfo>>({})
  const [valueProps, setValueProps] = useState<ValuePropositionRef[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [viewStats, setViewStats] = useState({ total: 0, month: 0, week: 0 })
  // 縦に長く、性格の違う2種類が混ざっていたので分ける。
  // 「基本情報」＝会社そのものの設定（プラン・企業情報・人）
  // 「ブランドオントロジー」＝ブランドの中身づくり（構築度・コピーAI）
  // URL は変えず画面内の状態だけで切り替える（1ページのまま保つ）
  const [tab, setTab] = useState<'basic' | 'ontology'>('basic')

  // 編集用フォーム
  // ※ brand_color_primary/secondary は 2026-04-06 に「AI・表示側の参照を brand_visuals へ移行」
  //   の際に一度スーパー管理からも撤去されたが復活していた孤立列。表示側は brand_visuals.color_palette が正本。
  //   唯一の残存参照は CIマニュアルPDF (lib/ci-manual/data-fetcher.ts) のみ。DB列は温存し UI のみ再撤去した。
  const [editName, setEditName] = useState('')
  const [editWebsiteUrl, setEditWebsiteUrl] = useState('')

  // プラン編集。会社情報の保存（anon＋RLS）とは別扱いにし、service_role の
  // API Route 経由で保存する。プラン変更は課金に直結するため
  const [editPlan, setEditPlan] = useState<string>('free')
  const [editPlanExpiresAt, setEditPlanExpiresAt] = useState('') // yyyy-mm-dd。空＝無期限
  const [editIsDemo, setEditIsDemo] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)

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
          setEditWebsiteUrl(companyData.website_url || '')
          setEditPlan(companyData.plan || 'free')
          setEditPlanExpiresAt(
            companyData.plan_expires_at
              ? new Date(companyData.plan_expires_at).toISOString().slice(0, 10)
              : '',
          )
          setEditIsDemo(companyData.is_demo ?? false)
        }

        // 社員一覧
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name, position, department, email, slug')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })

        setProfiles(profilesData || [])

        // 最終ログイン日時（auth.users はクライアントから読めないので service_role API 経由）
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.access_token) {
            const res = await fetch(`/api/superadmin/company-logins/${companyId}`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            })
            if (res.ok) {
              const json = await res.json()
              const map: Record<string, LoginInfo> = {}
              for (const row of (json.logins || []) as LoginInfo[]) {
                map[row.profile_id] = row
              }
              setLoginByProfile(map)
            }
          }
        } catch {
          // 取れなくても一覧そのものは表示する
        }

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

  // プランの保存。会社情報と違い service_role の API Route を経由する
  const handleSavePlan = async () => {
    setSavingPlan(true)
    setMessage('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/superadmin/company-plan', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          company_id: companyId,
          plan: editPlan,
          // 空文字は「無期限」。日付だけ渡すとその日の 00:00 を期限にしてしまうので、
          // 選んだ日いっぱいまで有効になるよう終端に寄せる
          plan_expires_at: editPlanExpiresAt ? `${editPlanExpiresAt}T23:59:59+09:00` : null,
          is_demo: editIsDemo,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)

      setCompany((prev) => (prev ? { ...prev, ...json.company } : prev))
      setMessage('プランを保存しました')
      setMessageType('success')
    } catch (err) {
      setMessage('プランの保存に失敗しました: ' + (err instanceof Error ? err.message : ''))
      setMessageType('error')
    } finally {
      setSavingPlan(false)
    }
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
        ブランドが見つかりません
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
        <ArrowLeft size={14} className="inline" /> ブランドに戻る
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-foreground">
          {company.name}
        </h2>
        <Link
          href={`/superadmin/companies/${companyId}/view`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm font-medium text-foreground no-underline transition-colors hover:bg-muted"
        >
          <Eye size={14} /> このブランドの状態を見る（閲覧）
        </Link>
      </div>

      {/* タブ。管理画面ダッシュボードと同じ体裁に揃える */}
      <div className="mb-6 flex gap-6 border-b">
        {([
          { key: 'basic', label: '基本情報' },
          { key: 'ontology', label: 'ブランドオントロジー' },
        ] as const).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px cursor-pointer border-0 border-b-2 bg-transparent pb-2 text-sm font-semibold transition-colors ${
              tab === t.key
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'basic' && (
      <>

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




      {/* === プラン（課金に直結するため service_role の API 経由で保存する） === */}
      <Card className="bg-muted/50 border shadow-none mb-6">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-bold text-foreground">プラン</h3>
            {(() => {
              const p = resolvePlanDisplay({ plan: editPlan, plan_expires_at: company?.plan_expires_at })
              return (
                <>
                  <span className={`inline-flex items-center py-0.5 px-2 rounded-md text-[11px] font-semibold ${p.toneClass}`}>
                    {p.label}
                  </span>
                  {p.note && <span className="text-xs text-muted-foreground">{p.note}</span>}
                </>
              )
            })()}
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Stripe を入れるまでは、ここがプランを変更する唯一の手段です。
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <Label className="mb-1.5 font-bold">プラン</Label>
              <select
                value={editPlan}
                onChange={(e) => setEditPlan(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {PLAN_VALUES.map((v) => (
                  <option key={v} value={v}>{PLAN_LABELS[v]}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1 m-0">
                enterprise は商談経由の手動割り当て（セルフサーブ対象外）
              </p>
            </div>
            <div>
              <Label className="mb-1.5 font-bold">有効期限</Label>
              <Input
                type="date"
                value={editPlanExpiresAt}
                onChange={(e) => setEditPlanExpiresAt(e.target.value)}
                className="h-10"
              />
              <p className="text-xs text-muted-foreground mt-1 m-0">
                空欄で無期限。過ぎた日付にすると実効プランは Free になる
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={editIsDemo}
              onChange={(e) => setEditIsDemo(e.target.checked)}
              className="size-4"
            />
            <span className="text-sm text-foreground">デモ（実顧客カウントから除外する）</span>
          </label>

          <Button type="button" onClick={handleSavePlan} disabled={savingPlan} size="sm">
            {savingPlan ? '保存中...' : 'プランを保存'}
          </Button>
        </CardContent>
      </Card>

      {/* === 企業情報編集セクション（設定系・下部） === */}
      <Card className="bg-muted/50 border shadow-none mb-6">
        <CardContent className="p-6">
          <h3 className="text-base font-bold text-foreground mb-4">
            ブランド情報
          </h3>

          {message && (
            <div className={messageType === 'success' ? 'bg-green-50 text-green-600 px-4 py-3 rounded-lg text-sm mb-4' : 'bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4'}>
              {message}
            </div>
          )}

          <form onSubmit={handleSave}>
            <div className="mb-5">
              <Label className="mb-1.5 font-bold">ブランド名</Label>
              <Input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-10"
              />
            </div>

            {/* スローガン / MVV / ブランドカラー(primary/secondary) の編集は
                各社の管理画面（/admin/brand/guidelines・/admin/brand/visuals）へ一本化。
                companies.slogan / mvv / brand_color_primary / brand_color_secondary は
                表示に使われていない孤立列（正本は brand_guidelines / brand_visuals）。 */}

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
                  <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">最終ログイン</th>
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
                    <td className="px-4 py-3 border-b border-border text-muted-foreground text-[13px] whitespace-nowrap">
                      {formatLastLogin(loginByProfile[profile.id])}
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

      </>
      )}

      {tab === 'ontology' && (
      <>

      {/* === ブランドオントロジー（全機能の実体を内包する常設カード。重複セクションは置かない） === */}
      <Card className="bg-muted/50 border shadow-none mb-6">
        <CardContent className="p-6">
          <OntologySummaryHub companyId={companyId} valuePropositions={valueProps} />
        </CardContent>
      </Card>

      {/* === コピーAI ワークベンチへの導線 === */}
      <Link href={`/superadmin/companies/${companyId}/copy`} className="block mb-6">
        <Card className="bg-muted/50 border shadow-none transition-colors hover:border-ds-app-accent">
          <CardContent className="p-6 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-foreground mb-1">コピーAI</h3>
              <p className="text-[13px] text-muted-foreground">
                本音→切り口→生成→批評。オントロジーに接地した、退屈でないコピーを作る。
              </p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      </>
      )}

    </div>
  )
}
