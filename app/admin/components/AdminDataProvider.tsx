'use client'

// 管理画面のアプリ固有データ Provider
// セッション管理は AppAuthProvider に任せ、ここでは admin_users / members / companies の取得に専念。
// 戻り値は旧 useAuth() と互換性を保つ（既存ページのコード変更を最小化）。
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { FEATURE_TOGGLE_COLUMNS } from '@/lib/constants/feature-toggles'
import { useAppAuth } from '@/components/providers/AppAuthProvider'
import { AppSidebar } from './AppSidebar'
import { AdminHeader } from './AdminHeader'
import { AdminDynamicTitle } from './AdminDynamicTitle'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'

// companies レコード（少なくとも機能トグルのカラムを含む）
type CompanyRecord = Record<string, unknown>

type AdminDataContextValue = {
  user: User | null
  companyId: string | null
  companyName: string | null
  companyLogoUrl: string | null
  company: CompanyRecord | null
  role: string | null
  isSuperAdmin: boolean
  profileName: string | null
  profilePhotoUrl: string | null
  loading: boolean
  signOut: () => Promise<void>
  // 機能トグル等を更新した直後にコンテキスト上の company を即時反映するための setter
  updateCompany: (partial: CompanyRecord) => void
}

const AdminDataContext = createContext<AdminDataContextValue | null>(null)

// 機能トグルカラムを含めた companies の select 文字列
const COMPANY_SELECT = ['name', 'logo_url', ...FEATURE_TOGGLE_COLUMNS].join(', ')

// chrome=false の場合は通常管理画面のサイドバー・ヘッダーを描画せず、
// 認証/データのコンテキストと children だけを提供する（スーパー管理画面など、
// 独自のシェルを持つ画面で二重サイドバーになるのを防ぐ）。
export function AdminDataProvider({
  children,
  chrome = true,
}: {
  children: React.ReactNode
  chrome?: boolean
}) {
  const { user, loading: authLoading, signOut } = useAppAuth()
  const router = useRouter()
  const pathname = usePathname()

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null)
  const [company, setCompany] = useState<CompanyRecord | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [profileName, setProfileName] = useState<string | null>(null)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [adminError, setAdminError] = useState(false)
  // 企業が superadmin 承認待ち（approval_status='pending'）ならアクセス不可
  const [companyPending, setCompanyPending] = useState(false)

  const isLoginPage = pathname === '/admin/login'

  useEffect(() => {
    if (authLoading) return

    // 未ログイン → /admin/login へ
    if (!user) {
      // ログアウト時に前ユーザーのデータがコンテキストへ残らないようリセット
      setCompanyId(null)
      setCompanyName(null)
      setCompanyLogoUrl(null)
      setCompany(null)
      setRole(null)
      setIsSuperAdmin(false)
      setProfileName(null)
      setProfilePhotoUrl(null)
      setAdminError(false)
      setCompanyPending(false)
      setLoading(false)
      if (!isLoginPage) {
        router.replace('/admin/login')
      }
      return
    }

    let cancelled = false

    ;(async () => {
      setLoading(true)
      // 別ユーザーへ切り替わった際に前ユーザーの企業/プロフィール/権限が残らないようリセット
      setCompanyId(null)
      setCompanyName(null)
      setCompanyLogoUrl(null)
      setCompany(null)
      setRole(null)
      setIsSuperAdmin(false)
      setProfileName(null)
      setProfilePhotoUrl(null)
      setAdminError(false)
      setCompanyPending(false)
      try {
        // admin_users と members(+profile) を並列取得
        const [adminRes, memberRes] = await Promise.all([
          supabase
            .from('admin_users')
            .select('company_id, role, is_superadmin')
            .eq('auth_id', user.id)
            .maybeSingle(),
          supabase
            .from('members')
            .select('display_name, profile:profiles(name, photo_url)')
            .eq('auth_id', user.id)
            .maybeSingle(),
        ])

        if (cancelled) return

        const adminData = adminRes.data

        if (!adminData) {
          setAdminError(true)
          setCompanyId(null)
          setRole(null)
          setIsSuperAdmin(false)
          return
        }

        setCompanyId(adminData.company_id)
        setRole(adminData.role)
        setIsSuperAdmin(adminData.is_superadmin === true)
        setAdminError(false)

        // 企業の承認状態を確認（pending=superadmin承認待ちはアクセス不可）。
        // superadmin は対象外（自社が承認待ちになることは想定しない）。
        if (adminData.is_superadmin !== true) {
          const { data: gate } = await supabase
            .from('companies')
            .select('approval_status')
            .eq('id', adminData.company_id)
            .maybeSingle()
          if (cancelled) return
          setCompanyPending((gate as { approval_status?: string } | null)?.approval_status === 'pending')
        }

        // メンバー情報の反映
        if (!memberRes.error && memberRes.data) {
          const profileRaw = memberRes.data.profile as
            | { name: string; photo_url: string }
            | { name: string; photo_url: string }[]
            | null
          const profile = Array.isArray(profileRaw) ? profileRaw[0] ?? null : profileRaw
          setProfileName(profile?.name || memberRes.data.display_name || null)
          setProfilePhotoUrl(profile?.photo_url || null)
        }

        // 企業情報はバックグラウンドで取得（UIブロックしない）
        // 機能トグル（timeline_enabled 等）も含めて取得し、company レコードとして公開する
        supabase
          .from('companies')
          .select(COMPANY_SELECT)
          .eq('id', adminData.company_id)
          .maybeSingle()
          .then(({ data: companyData }) => {
            if (cancelled || !companyData) return
            const rec = companyData as unknown as CompanyRecord
            setCompany({ ...rec, id: adminData.company_id })
            setCompanyName((rec.name as string) || null)
            setCompanyLogoUrl((rec.logo_url as string) || null)
          })
      } catch (err) {
        if (!cancelled) {
          console.error('[AdminDataProvider] データ取得エラー:', err)
          setAdminError(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // user はオブジェクト参照ではなく id で依存（トークンリフレッシュ／タブ復帰での不要な再取得を防止）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading, router, isLoginPage])

  // 機能トグル更新後に画面へ即時反映するための setter（参照を安定させる）
  const updateCompany = useCallback((partial: CompanyRecord) => {
    setCompany((prev) => ({ ...(prev ?? {}), ...partial }))
  }, [])

  // context value をメモ化（毎レンダーで新オブジェクトを作らない）
  const contextValue: AdminDataContextValue = useMemo(
    () => ({
      user,
      companyId,
      companyName,
      companyLogoUrl,
      company,
      role,
      isSuperAdmin,
      profileName,
      profilePhotoUrl,
      loading: authLoading || loading,
      signOut,
      updateCompany,
    }),
    [
      user,
      companyId,
      companyName,
      companyLogoUrl,
      company,
      role,
      isSuperAdmin,
      profileName,
      profilePhotoUrl,
      authLoading,
      loading,
      signOut,
      updateCompany,
    ]
  )

  // ログインページではそのまま表示（サイドバー・ヘッダーなし）
  if (isLoginPage) {
    return (
      <AdminDataContext.Provider value={contextValue}>
        {children}
      </AdminDataContext.Provider>
    )
  }

  // ローディング中
  if (authLoading || loading) {
    return (
      <AdminDataContext.Provider value={contextValue}>
        <div className="flex items-center justify-center min-h-screen bg-gray-50 text-base text-gray-500">
          読み込み中...
        </div>
      </AdminDataContext.Provider>
    )
  }

  // 未認証時は何も表示しない（リダイレクト中）
  if (!user) {
    return null
  }

  // admin_usersに未登録のユーザー
  if (adminError || !companyId) {
    return (
      <AdminDataContext.Provider value={contextValue}>
        <div className="flex items-center justify-center min-h-screen bg-gray-50 font-sans">
          <div className="bg-white rounded-xl p-10 text-center max-w-[400px] shadow-sm">
            <div className="text-5xl mb-4">🚫</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              アクセス権限がありません
            </h1>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              このアカウント（{user.email}）は管理者として登録されていません。
              管理者に連絡してください。
            </p>
            <button
              onClick={signOut}
              className="px-6 py-2.5 bg-ds-app-accent text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-ds-app-accent-hover transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>
      </AdminDataContext.Provider>
    )
  }

  // 企業が superadmin 承認待ち（pending）: 承認されるまでアクセス不可
  if (companyPending) {
    return (
      <AdminDataContext.Provider value={contextValue}>
        <div className="flex items-center justify-center min-h-screen bg-gray-50 font-sans">
          <div className="bg-white rounded-xl p-10 text-center max-w-[400px] shadow-sm">
            <div className="text-5xl mb-4">⏳</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              承認待ちです
            </h1>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              ご登録ありがとうございます。ID INC. が内容を確認しています。
              承認されるとログインできるようになります。結果はメールでお知らせします。
            </p>
            <button
              onClick={signOut}
              className="px-6 py-2.5 bg-ds-app-accent text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-ds-app-accent-hover transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>
      </AdminDataContext.Provider>
    )
  }

  // chrome=false: 独自シェルを持つ画面（スーパー管理画面など）。
  // 通常管理画面のサイドバー・ヘッダーは描画せず children をそのまま返す。
  if (!chrome) {
    return (
      <AdminDataContext.Provider value={contextValue}>
        {children}
      </AdminDataContext.Provider>
    )
  }

  // 認証済み + admin_users登録済み: サイドバー + ヘッダー + コンテンツ
  return (
    <AdminDataContext.Provider value={contextValue}>
      <AdminDynamicTitle />
      <SidebarProvider
        style={{
          '--sidebar-width': '19rem',
          // 管理画面サイドバー背景を少し明るく（グローバル 220 13% 18% → 21%）。管理画面のみに限定。
          '--sidebar-background': '220 13% 21%',
        } as React.CSSProperties}
      >
        <AppSidebar />
        <SidebarInset>
          <AdminHeader />
          <main className="max-w-4xl mx-auto px-5 pt-4 pb-6 w-full">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </AdminDataContext.Provider>
  )
}

// 既存コード互換のため useAuth という名前でもエクスポート
export function useAdminData() {
  const ctx = useContext(AdminDataContext)
  if (!ctx) throw new Error('useAdminData must be used within AdminDataProvider')
  return ctx
}

export const useAuth = useAdminData
