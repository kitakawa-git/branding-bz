'use client'

// ポータルのアプリ固有データ Provider
// セッション管理は AppAuthProvider に任せ、members / companies / brand_guidelines / admin_users を取得。
// 戻り値は旧 usePortalAuth() と互換性を保つ。
import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { PortalSubtitles } from '@/lib/portal-subtitles'
import { supabase } from '@/lib/supabase'
import { useAppAuth } from '@/components/providers/AppAuthProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShieldAlert } from 'lucide-react'

type MemberInfo = {
  id: string
  display_name: string
  email: string
}

type PortalDataContextValue = {
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

const PortalDataContext = createContext<PortalDataContextValue | null>(null)

// 認証不要のパス
const publicPaths = ['/portal/login', '/portal/register', '/portal/auth']

export function PortalDataProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, signOut } = useAppAuth()
  const router = useRouter()
  const pathname = usePathname()

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
  const [loading, setLoading] = useState(true)

  const isPublicPath = publicPaths.some(p => pathname.startsWith(p))

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      setLoading(false)
      if (!isPublicPath) {
        router.replace('/portal/auth')
      }
      return
    }

    let cancelled = false

    ;(async () => {
      setLoading(true)
      try {
        // member 取得と admin_users 取得を並列化
        const [memberRes, adminRes] = await Promise.all([
          supabase
            .from('members')
            .select('*, profile:profiles(name, photo_url, slug)')
            .eq('auth_id', user.id)
            .eq('is_active', true)
            .maybeSingle(),
          supabase
            .from('admin_users')
            .select('id')
            .eq('auth_id', user.id)
            .maybeSingle(),
        ])

        if (cancelled) return

        const memberData = memberRes.data
        if (!memberData) {
          setMember(null)
          setCompanyId(null)
          return
        }

        setCompanyId(memberData.company_id)
        setMember({
          id: memberData.id,
          display_name: memberData.display_name,
          email: memberData.email,
        })

        const profileRaw = memberData.profile as
          | { name: string; photo_url: string; slug: string }
          | { name: string; photo_url: string; slug: string }[]
          | null
        const profile = Array.isArray(profileRaw) ? profileRaw[0] ?? null : profileRaw
        setProfileName(profile?.name || memberData.display_name || null)
        setProfilePhotoUrl(profile?.photo_url || null)
        setProfileSlug(profile?.slug || null)

        setIsAdmin(!!adminRes.data)

        // companies と brand_guidelines を並列取得（companyId 確定後）
        const [companyRes, guidelinesRes] = await Promise.all([
          supabase
            .from('companies')
            .select('name, logo_url, portal_subtitles')
            .eq('id', memberData.company_id)
            .maybeSingle(),
          supabase
            .from('brand_guidelines')
            .select('slogan')
            .eq('company_id', memberData.company_id)
            .maybeSingle(),
        ])

        if (cancelled) return

        if (companyRes.data) {
          setCompanyName(companyRes.data.name || null)
          setCompanyLogoUrl(companyRes.data.logo_url || null)
          setPortalSubtitles((companyRes.data.portal_subtitles as PortalSubtitles) || null)
        }
        if (guidelinesRes.data) {
          setSlogan(guidelinesRes.data.slogan || null)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[PortalDataProvider] データ取得エラー:', err)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user, authLoading, router, isPublicPath])

  const contextValue: PortalDataContextValue = {
    user,
    companyId,
    companyName,
    companyLogoUrl,
    portalSubtitles,
    slogan,
    member,
    profileName,
    profilePhotoUrl,
    profileSlug,
    isAdmin,
    loading: authLoading || loading,
    signOut,
  }

  // 公開パスではそのまま表示
  if (isPublicPath) {
    return (
      <PortalDataContext.Provider value={contextValue}>
        {children}
      </PortalDataContext.Provider>
    )
  }

  // ローディング中
  if (authLoading || loading) {
    return (
      <PortalDataContext.Provider value={contextValue}>
        <div className="flex items-center justify-center min-h-screen bg-white text-base text-gray-500 font-sans">
          読み込み中...
        </div>
      </PortalDataContext.Provider>
    )
  }

  // 未認証
  if (!user) {
    return null
  }

  // membersに未登録
  if (!member || !companyId) {
    return (
      <PortalDataContext.Provider value={contextValue}>
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
      </PortalDataContext.Provider>
    )
  }

  // 認証済み
  return (
    <PortalDataContext.Provider value={contextValue}>
      {children}
    </PortalDataContext.Provider>
  )
}

// 既存コード互換: usePortalAuth という名前でも提供
export function usePortalData() {
  const ctx = useContext(PortalDataContext)
  if (!ctx) throw new Error('usePortalData must be used within PortalDataProvider')
  return ctx
}

export const usePortalAuth = usePortalData
