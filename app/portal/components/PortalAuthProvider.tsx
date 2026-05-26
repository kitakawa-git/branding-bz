'use client'

// ポータル認証プロバイダー: members テーブルを参照
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { PortalSubtitles } from '@/lib/portal-subtitles'
import { clearPageCache } from '@/lib/page-cache'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShieldAlert } from 'lucide-react'

// PortalAuthProvider が再マウントされた時、すでに認証済みなら即時 loading=false で開始
let __portalAuthInitialized = false

type MemberInfo = {
  id: string
  display_name: string
  email: string
}

type PortalAuthContextType = {
  user: User | null
  companyId: string | null
  companyName: string | null
  companyLogoUrl: string | null
  portalSubtitles: PortalSubtitles | null
  slogan: string | null
  member: MemberInfo | null
  profileName: string | null
  profilePhotoUrl: string | null
  profileSlug: string | null
  isAdmin: boolean
  loading: boolean
  signOut: () => Promise<void>
}

const PortalAuthContext = createContext<PortalAuthContextType>({
  user: null,
  companyId: null,
  companyName: null,
  companyLogoUrl: null,
  portalSubtitles: null,
  slogan: null,
  member: null,
  profileName: null,
  profilePhotoUrl: null,
  profileSlug: null,
  isAdmin: false,
  loading: true,
  signOut: async () => {},
})

// 認証不要のパス
const publicPaths = ['/portal/login', '/portal/register', '/portal/auth']

export function PortalAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null)
  const [portalSubtitles, setPortalSubtitles] = useState<PortalSubtitles | null>(null)
  const [slogan, setSlogan] = useState<string | null>(null)
  const [member, setMember] = useState<MemberInfo | null>(null)
  const [profileName, setProfileName] = useState<string | null>(null)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null)
  const [profileSlug, setProfileSlug] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  // 既に認証済みなら再マウント時に loading=false で開始
  const [loading, setLoading] = useState(!__portalAuthInitialized)
  const router = useRouter()
  const pathname = usePathname()

  const isPublicPath = publicPaths.some(p => pathname.startsWith(p))

  const fetchMember = async (authId: string) => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*, profile:profiles(name, photo_url, slug)')
        .eq('auth_id', authId)
        .eq('is_active', true)
        .single()

      if (error || !data) {
        setCompanyId(null)
        setMember(null)
        return false
      }

      setCompanyId(data.company_id)
      setMember({
        id: data.id,
        display_name: data.display_name,
        email: data.email,
      })

      // プロフィール情報を取得（join 結果から）
      const profileRaw = data.profile as { name: string; photo_url: string; slug: string } | { name: string; photo_url: string; slug: string }[] | null
      const profile = Array.isArray(profileRaw) ? profileRaw[0] ?? null : profileRaw
      setProfileName(profile?.name || data.display_name || null)
      setProfilePhotoUrl(profile?.photo_url || null)
      setProfileSlug(profile?.slug || null)

      // 会社情報を取得
      try {
        const { data: companyData } = await supabase
          .from('companies')
          .select('name, logo_url, portal_subtitles')
          .eq('id', data.company_id)
          .single()
        if (companyData) {
          setCompanyName(companyData.name || null)
          setCompanyLogoUrl(companyData.logo_url || null)
          setPortalSubtitles((companyData.portal_subtitles as PortalSubtitles) || null)
        }
      } catch {
        // 会社情報取得失敗は無視
      }

      // スローガン取得
      try {
        const { data: guidelinesData } = await supabase
          .from('brand_guidelines')
          .select('slogan')
          .eq('company_id', data.company_id)
          .single()
        if (guidelinesData) {
          setSlogan(guidelinesData.slogan || null)
        }
      } catch {
        // スローガン取得失敗は無視
      }

      // 管理者チェック
      try {
        const { data: adminData } = await supabase
          .from('admin_users')
          .select('id')
          .eq('auth_id', authId)
          .eq('company_id', data.company_id)
          .maybeSingle()
        setIsAdmin(!!adminData)
      } catch {
        setIsAdmin(false)
      }

      return true
    } catch {
      setCompanyId(null)
      setMember(null)
      return false
    }
  }

  // useRef で最新の値をコールバック内から参照（クロージャの古い値問題を回避）
  const memberRef = useRef(member)
  useEffect(() => { memberRef.current = member }, [member])

  // 認証ソース：
  //   1) マウント直後に getSession で localStorage から即座にセッション復元
  //      → onAuthStateChange の INITIAL_SESSION を待たないため「読み込み中」が一瞬で終わる
  //   2) onAuthStateChange は SIGNED_IN/OUT/TOKEN_REFRESHED の状態変化監視のみ
  useEffect(() => {
    let cancelled = false

    const timeoutId = setTimeout(() => {
      if (cancelled) return
      console.warn('[PortalAuth] 10秒タイムアウト')
      setLoading(false)
      if (!isPublicPath) {
        router.replace('/portal/auth')
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
          if (!isPublicPath) {
            router.replace('/portal/auth')
          }
          return
        }

        setUser(currentUser)
        await fetchMember(currentUser.id)
        if (!cancelled) {
          __portalAuthInitialized = true
          setLoading(false)
        }
      } catch (err) {
        if (cancelled) return
        console.error('[PortalAuth] getSession 失敗:', err)
        clearTimeout(timeoutId)
        setLoading(false)
        if (!isPublicPath) {
          router.replace('/portal/auth')
        }
      }
    })()

    // === 2) onAuthStateChange で状態変化のみ監視（INITIAL_SESSION は無視） ===
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[PortalAuth] onAuthStateChange:', event, session?.user?.email)

        if (event === 'INITIAL_SESSION') return

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const currentUser = session?.user ?? null
          if (!currentUser) return

          if (event === 'TOKEN_REFRESHED' && memberRef.current) {
            return
          }

          setUser(currentUser)
          await fetchMember(currentUser.id)
        } else if (event === 'SIGNED_OUT') {
          __portalAuthInitialized = false
          setUser(null)
          setCompanyId(null)
          setMember(null)
          setLoading(false)
          router.replace('/portal/auth')
        }
      }
    )

    // === 3) タブ復帰時にセッションを再検証 ===
    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const { data } = await supabase.auth.getSession()
        const currentUser = data.session?.user ?? null
        if (!currentUser) {
          __portalAuthInitialized = false
          setUser(null)
          setCompanyId(null)
          setMember(null)
          if (!isPublicPath) router.replace('/portal/auth')
        } else if (!memberRef.current) {
          setUser(currentUser)
          await fetchMember(currentUser.id)
        }
      } catch (err) {
        console.error('[PortalAuth] visibilitychange セッション確認エラー:', err)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signOut = async () => {
    __portalAuthInitialized = false
    clearPageCache()
    await supabase.auth.signOut()
    setCompanyId(null)
    setCompanyName(null)
    setCompanyLogoUrl(null)
    setPortalSubtitles(null)
    setSlogan(null)
    setIsAdmin(false)
    setMember(null)
    setProfileName(null)
    setProfilePhotoUrl(null)
    setProfileSlug(null)
    router.push('/portal/auth')
  }

  const contextValue = { user, companyId, companyName, companyLogoUrl, portalSubtitles, slogan, member, profileName, profilePhotoUrl, profileSlug, isAdmin, loading, signOut }

  // 公開パスではそのまま表示
  if (isPublicPath) {
    return (
      <PortalAuthContext.Provider value={contextValue}>
        {children}
      </PortalAuthContext.Provider>
    )
  }

  // ローディング中
  if (loading) {
    return (
      <PortalAuthContext.Provider value={contextValue}>
        <div className="flex items-center justify-center min-h-screen bg-white text-base text-gray-500 font-sans">
          読み込み中...
        </div>
      </PortalAuthContext.Provider>
    )
  }

  // 未認証
  if (!user) {
    return null
  }

  // membersに未登録
  if (!member || !companyId) {
    return (
      <PortalAuthContext.Provider value={contextValue}>
        <div className="flex items-center justify-center min-h-screen bg-white font-sans">
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none max-w-[400px] w-full mx-5">
            <CardContent className="p-10 text-center">
              <div className="mb-4 flex justify-center text-muted-foreground">
                <ShieldAlert size={48} />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-3">
                アクセス権限がありません
              </h2>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                このアカウントはメンバーとして登録されていません。管理者に連絡してください。
              </p>
              <Button onClick={signOut} className="rounded-lg">
                ログアウト
              </Button>
            </CardContent>
          </Card>
        </div>
      </PortalAuthContext.Provider>
    )
  }

  // 認証済み
  return (
    <PortalAuthContext.Provider value={contextValue}>
      {children}
    </PortalAuthContext.Provider>
  )
}

export const usePortalAuth = () => useContext(PortalAuthContext)
