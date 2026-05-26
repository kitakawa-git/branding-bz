'use client'

// 管理画面のアプリ固有データ Provider
// セッション管理は AppAuthProvider に任せ、ここでは admin_users / members / companies の取得に専念。
// 戻り値は旧 useAuth() と互換性を保つ（既存ページのコード変更を最小化）。
import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useAppAuth } from '@/components/providers/AppAuthProvider'
import { AppSidebar } from './AppSidebar'
import { AdminHeader } from './AdminHeader'
import { AdminDynamicTitle } from './AdminDynamicTitle'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'

type AdminDataContextValue = {
  user: User | null
  companyId: string | null
  companyName: string | null
  companyLogoUrl: string | null
  role: string | null
  isSuperAdmin: boolean
  profileName: string | null
  profilePhotoUrl: string | null
  loading: boolean
  signOut: () => Promise<void>
}

const AdminDataContext = createContext<AdminDataContextValue | null>(null)

export function AdminDataProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, signOut } = useAppAuth()
  const router = useRouter()
  const pathname = usePathname()

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [profileName, setProfileName] = useState<string | null>(null)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [adminError, setAdminError] = useState(false)

  const isLoginPage = pathname === '/admin/login'

  useEffect(() => {
    if (authLoading) return

    // 未ログイン → /admin/login へ
    if (!user) {
      setLoading(false)
      if (!isLoginPage) {
        router.replace('/admin/login')
      }
      return
    }

    let cancelled = false

    ;(async () => {
      setLoading(true)
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
        supabase
          .from('companies')
          .select('name, logo_url')
          .eq('id', adminData.company_id)
          .maybeSingle()
          .then(({ data: companyData }) => {
            if (cancelled || !companyData) return
            setCompanyName(companyData.name || null)
            setCompanyLogoUrl(companyData.logo_url || null)
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
  }, [user, authLoading, router, isLoginPage])

  const contextValue: AdminDataContextValue = {
    user,
    companyId,
    companyName,
    companyLogoUrl,
    role,
    isSuperAdmin,
    profileName,
    profilePhotoUrl,
    loading: authLoading || loading,
    signOut,
  }

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
              className="px-6 py-2.5 bg-blue-600 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-700 transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>
      </AdminDataContext.Provider>
    )
  }

  // 認証済み + admin_users登録済み: サイドバー + ヘッダー + コンテンツ
  return (
    <AdminDataContext.Provider value={contextValue}>
      <AdminDynamicTitle />
      <SidebarProvider
        style={{ '--sidebar-width': '19rem' } as React.CSSProperties}
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
