'use client'

// 認証プロバイダー: ログイン状態を管理し、未ログイン時はリダイレクト
// マルチテナント対応: admin_usersテーブルからcompany_idを取得
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { clearPageCache } from '@/lib/page-cache'
import { AppSidebar } from './AppSidebar'
import { AdminHeader } from './AdminHeader'
import { AdminDynamicTitle } from './AdminDynamicTitle'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'

// AuthProvider が再マウントされた時、すでに認証済みなら即時 loading=false で開始する
// （タブ存続中はセッション復元済みとみなす）
let __authInitialized = false

type AuthContextType = {
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

const AuthContext = createContext<AuthContextType>({
  user: null,
  companyId: null,
  companyName: null,
  companyLogoUrl: null,
  role: null,
  isSuperAdmin: false,
  profileName: null,
  profilePhotoUrl: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [profileName, setProfileName] = useState<string | null>(null)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null)
  // 既に一度認証済みの場合（モジュール内フラグ）は false で開始 → 再マウント時のチラつき防止
  const [loading, setLoading] = useState(!__authInitialized)
  const [adminError, setAdminError] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const fetchAdminUser = async (authId: string) => {
    try {
      // admin_users と members(profile込み) を並列取得（authId だけで両方クエリ可能）
      // 必要カラムだけ select して転送量削減
      const [adminRes, memberRes] = await Promise.all([
        supabase
          .from('admin_users')
          .select('company_id, role, is_superadmin')
          .eq('auth_id', authId)
          .single(),
        supabase
          .from('members')
          .select('display_name, profile:profiles(name, photo_url)')
          .eq('auth_id', authId)
          .maybeSingle(),
      ])

      const { data, error } = adminRes

      if (error || !data) {
        console.warn('[AuthProvider] admin_user見つからず:', error?.message || '該当レコードなし')
        setAdminError(true)
        setCompanyId(null)
        setRole(null)
        setIsSuperAdmin(false)
        return false
      }

      setCompanyId(data.company_id)
      setRole(data.role)
      setIsSuperAdmin(data.is_superadmin === true)
      setAdminError(false)

      // メンバー情報の反映（profile はネスト取得済み）
      if (!memberRes.error && memberRes.data) {
        const profileRaw = memberRes.data.profile as { name: string; photo_url: string } | { name: string; photo_url: string }[] | null
        const profile = Array.isArray(profileRaw) ? profileRaw[0] ?? null : profileRaw
        setProfileName(profile?.name || memberRes.data.display_name || null)
        setProfilePhotoUrl(profile?.photo_url || null)
      }

      // 企業情報は admin_users 確定後に取得（company_id 依存）
      // ただしUIブロックしないようバックグラウンドで実行（await しない）
      supabase
        .from('companies')
        .select('name, logo_url')
        .eq('id', data.company_id)
        .single()
        .then(({ data: companyData }) => {
          if (companyData) {
            setCompanyName(companyData.name || null)
            setCompanyLogoUrl(companyData.logo_url || null)
          }
        })

      return true
    } catch (err) {
      console.error('[AuthProvider] fetchAdminUser例外:', err)
      setAdminError(true)
      setCompanyId(null)
      setRole(null)
      setIsSuperAdmin(false)
      return false
    }
  }

  // useRef で最新の値をコールバック内から参照（クロージャの古い値問題を回避）
  const companyIdRef = useRef(companyId)
  useEffect(() => { companyIdRef.current = companyId }, [companyId])

  // 認証ソース：
  //   1) マウント直後に getSession で localStorage から即座にセッション復元
  //      → onAuthStateChange の INITIAL_SESSION を待たないため「読み込み中」が一瞬で終わる
  //   2) onAuthStateChange は SIGNED_IN/OUT/TOKEN_REFRESHED の状態変化監視のみ
  useEffect(() => {
    const isLoginPage = pathname === '/admin/login'
    let cancelled = false

    // フォールバック：getSession が10秒で帰ってこない異常事態への保険
    const timeoutId = setTimeout(() => {
      if (cancelled) return
      console.warn('[AuthProvider] 10秒タイムアウト: ログインページへリダイレクト')
      setLoading(false)
      if (!isLoginPage) {
        router.replace('/admin/login')
      }
    }, 10000)

    // === 1) getSession で即時セッション確認 ===
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (cancelled) return
        clearTimeout(timeoutId)

        const currentUser = data.session?.user ?? null

        if (!currentUser) {
          setUser(null)
          setLoading(false)
          if (!isLoginPage) {
            router.replace('/admin/login')
          }
          return
        }

        setUser(currentUser)
        await fetchAdminUser(currentUser.id)
        if (!cancelled) {
          __authInitialized = true
          setLoading(false)
        }
      } catch (err) {
        if (cancelled) return
        console.error('[AuthProvider] getSession 失敗:', err)
        clearTimeout(timeoutId)
        setLoading(false)
        if (!isLoginPage) {
          router.replace('/admin/login')
        }
      }
    })()

    // === 2) onAuthStateChange で状態変化を監視（INITIAL_SESSION は無視） ===
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthProvider] onAuthStateChange:', event, session?.user?.email)

        // INITIAL_SESSION は getSession 側で処理済みなのでスキップ
        if (event === 'INITIAL_SESSION') return

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const currentUser = session?.user ?? null
          if (!currentUser) return

          // TOKEN_REFRESHED: データ既取得済みなら再取得スキップ
          if (event === 'TOKEN_REFRESHED' && companyIdRef.current) {
            return
          }

          setUser(currentUser)
          await fetchAdminUser(currentUser.id)
        } else if (event === 'SIGNED_OUT') {
          __authInitialized = false
          setUser(null)
          setCompanyId(null)
          setRole(null)
          setIsSuperAdmin(false)
          setProfileName(null)
          setProfilePhotoUrl(null)
          setAdminError(false)
          setLoading(false)
          router.replace('/admin/login')
        }
      }
    )

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signOut = async () => {
    // 先にローカル状態をクリアして即時リダイレクト
    // （supabase.auth.signOut() のサーバーrevokeがブロックすると
    //   ボタン無反応に見えるため、先にUIを進める）
    __authInitialized = false
    clearPageCache()
    setUser(null)
    setCompanyId(null)
    setCompanyName(null)
    setCompanyLogoUrl(null)
    setRole(null)
    setIsSuperAdmin(false)
    setProfileName(null)
    setProfilePhotoUrl(null)
    setAdminError(false)
    router.replace('/admin/login')

    // scope: 'local' でローカルストレージのトークンのみ削除（サーバーrevokeしない＝高速）
    // ネットワーク不調・タブ多重時のLockManager待ちを回避
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch (err) {
      console.error('[AuthProvider] signOut error:', err)
    }
  }

  const contextValue = { user, companyId, companyName, companyLogoUrl, role, isSuperAdmin, profileName, profilePhotoUrl, loading, signOut }

  // ログインページではそのまま表示（サイドバー・ヘッダーなし）
  if (pathname === '/admin/login') {
    return (
      <AuthContext.Provider value={contextValue}>
        {children}
      </AuthContext.Provider>
    )
  }

  // ローディング中
  if (loading) {
    return (
      <AuthContext.Provider value={contextValue}>
        <div className="flex items-center justify-center min-h-screen bg-gray-50 text-base text-gray-500">
          読み込み中...
        </div>
      </AuthContext.Provider>
    )
  }

  // 未認証時は何も表示しない（リダイレクト中）
  if (!user) {
    return null
  }

  // admin_usersに未登録のユーザー
  if (adminError || !companyId) {
    return (
      <AuthContext.Provider value={contextValue}>
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
      </AuthContext.Provider>
    )
  }

  // 認証済み + admin_users登録済み: サイドバー + ヘッダー + コンテンツ
  return (
    <AuthContext.Provider value={contextValue}>
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
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
