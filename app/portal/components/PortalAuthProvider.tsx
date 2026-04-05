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
import { ShieldAlert, WifiOff } from 'lucide-react'

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

// Supabaseクエリ用タイムアウト（個別クエリ）
const QUERY_TIMEOUT_MS = 10000

// クエリをタイムアウト付きで実行
function withTimeout<T>(promise: PromiseLike<T>, ms = QUERY_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('query timeout')), ms)
    ),
  ]) as Promise<T>
}

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
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<'none' | 'not_member' | 'connection_error'>('none')
  const router = useRouter()
  const pathname = usePathname()

  const isPublicPath = publicPaths.some(p => pathname.startsWith(p))

  // レースコンディション防止: 処理中フラグ
  const processingRef = useRef(false)

  // members 取得クエリ（ログ強化版）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fetchMemberQuery = async (authId: string): Promise<{ data: any; error: any }> => {
    const startTime = Date.now()
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('members')
          .select('*, profile:profiles(name, photo_url, slug)')
          .eq('auth_id', authId)
          .eq('is_active', true)
          .single()
      )
      console.log(`[PortalAuth] fetchMemberQuery completed in ${Date.now() - startTime}ms`)
      if (error) {
        console.error('[PortalAuth] fetchMemberQuery エラー:', error.message, error.code)
      }
      return { data, error }
    } catch (e) {
      console.error(`[PortalAuth] fetchMemberQuery 例外 (${Date.now() - startTime}ms):`, e)
      throw e
    }
  }

  // リトライ付き members 取得（最大2回、失敗時はセッションリフレッシュ）
  // エラー種別を返す: 'not_member' = 登録なし確定 / 'connection_error' = タイムアウト等
  const fetchMemberWithRetry = async (
    authId: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<{ data: any; errorType: 'not_member' | 'connection_error' | null }> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await fetchMemberQuery(authId)

        if (result.data) {
          return { data: result.data, errorType: null }
        }

        // PGRST116: .single() でレコードなし/複数ヒット = 本当に未登録
        if (result.error && result.error.code === 'PGRST116') {
          return { data: null, errorType: 'not_member' }
        }

        // data が null でエラーなし（通常起きないが念のため未登録扱い）
        if (result.data === null && !result.error) {
          return { data: null, errorType: 'not_member' }
        }

        // その他のDBエラー → リトライ対象
        throw new Error(result.error?.message || 'Unknown query error')
      } catch (error) {
        console.warn(`[PortalAuth] fetchMember attempt ${attempt + 1} failed:`, error)
        if (attempt < 1) {
          // リトライ前にセッションをリフレッシュ
          try {
            await supabase.auth.refreshSession()
          } catch (refreshErr) {
            console.warn('[PortalAuth] セッションリフレッシュ失敗:', refreshErr)
          }
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }
    // 2回リトライしても失敗 → 接続エラー
    return { data: null, errorType: 'connection_error' }
  }

  const fetchMember = async (authId: string) => {
    try {
      // 1. members取得（必須クエリ — これが失敗したら他は不要）
      const { data, errorType } = await fetchMemberWithRetry(authId)

      if (!data) {
        setCompanyId(null)
        setMember(null)
        setAuthError(errorType || 'connection_error')
        return false
      }

      setAuthError('none')

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

      // 2. 残りのクエリを並列実行（どれか失敗しても致命的ではない）
      const [companyResult, guidelinesResult, adminResult] = await Promise.allSettled([
        withTimeout(
          supabase
            .from('companies')
            .select('name, logo_url, portal_subtitles')
            .eq('id', data.company_id)
            .single()
        ),
        withTimeout(
          supabase
            .from('brand_guidelines')
            .select('slogan')
            .eq('company_id', data.company_id)
            .single()
        ),
        withTimeout(
          supabase
            .from('admin_users')
            .select('id')
            .eq('auth_id', authId)
            .eq('company_id', data.company_id)
            .maybeSingle()
        ),
      ])

      // 会社情報
      if (companyResult.status === 'fulfilled' && companyResult.value.data) {
        const companyData = companyResult.value.data
        setCompanyName(companyData.name || null)
        setCompanyLogoUrl(companyData.logo_url || null)
        setPortalSubtitles((companyData.portal_subtitles as PortalSubtitles) || null)
      }

      // スローガン
      if (guidelinesResult.status === 'fulfilled' && guidelinesResult.value.data) {
        setSlogan(guidelinesResult.value.data.slogan || null)
      }

      // 管理者チェック
      if (adminResult.status === 'fulfilled') {
        setIsAdmin(!!adminResult.value.data)
      } else {
        setIsAdmin(false)
      }

      return true
    } catch (err) {
      console.error('[PortalAuth] fetchMember エラー:', err)
      setCompanyId(null)
      setMember(null)
      setAuthError('connection_error')
      return false
    }
  }

  // useRef で最新の値をコールバック内から参照（クロージャの古い値問題を回避）
  const memberRef = useRef(member)
  useEffect(() => { memberRef.current = member }, [member])

  // onAuthStateChange を唯一の認証ソースとして使用（Supabase推奨パターン）
  useEffect(() => {
    // 全体のセーフティタイムアウト: イベント到達〜fetchMember完了まで含めて15秒
    let safetyTimeoutId: ReturnType<typeof setTimeout> | null = null

    const startSafetyTimeout = () => {
      if (safetyTimeoutId) clearTimeout(safetyTimeoutId)
      safetyTimeoutId = setTimeout(() => {
        console.warn('[PortalAuth] 15秒セーフティタイムアウト — loading強制解除')
        processingRef.current = false
        setLoading(false)
        if (!isPublicPath) {
          router.replace('/portal/auth')
        }
      }, 15000)
    }

    // 初回: INITIAL_SESSION が来ない場合のフォールバック
    startSafetyTimeout()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[PortalAuth] onAuthStateChange:', event, session?.user?.email)

        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // TOKEN_REFRESHED: データ既取得済みなら再取得スキップ（スケルトン回避）
          if (event === 'TOKEN_REFRESHED' && memberRef.current) {
            if (safetyTimeoutId) clearTimeout(safetyTimeoutId)
            return
          }

          // レースコンディション防止: 前の処理がまだ走っていたらスキップ
          if (processingRef.current) {
            console.log('[PortalAuth] 既に処理中のためスキップ:', event)
            return
          }
          processingRef.current = true

          // セーフティタイムアウトを再開始（fetchMember含む全体をカバー）
          startSafetyTimeout()

          // INITIAL_SESSION: キャッシュされたセッションのトークンが期限切れの場合がある
          if (event === 'INITIAL_SESSION' && session?.expires_at) {
            const nowSec = Math.floor(Date.now() / 1000)
            if (session.expires_at < nowSec + 60) {
              console.log('[PortalAuth] INITIAL_SESSION: トークン期限切れ、リフレッシュ実行')
              const { data: refreshResult, error: refreshError } = await supabase.auth.refreshSession()
              if (refreshError || !refreshResult.session) {
                console.warn('[PortalAuth] リフレッシュ失敗、再ログインへ')
                setUser(null)
                setLoading(false)
                processingRef.current = false
                if (safetyTimeoutId) clearTimeout(safetyTimeoutId)
                if (!isPublicPath) {
                  router.replace('/portal/auth')
                }
                return
              }
              // リフレッシュ成功 → フォールスルーで処理を続行
            }
          }

          const currentUser = session?.user ?? null

          if (!currentUser) {
            setUser(null)
            setLoading(false)
            processingRef.current = false
            if (safetyTimeoutId) clearTimeout(safetyTimeoutId)
            if (!isPublicPath) {
              router.replace('/portal/auth')
            }
            return
          }

          setUser(currentUser)
          await fetchMember(currentUser.id)
          setLoading(false)
          processingRef.current = false
          if (safetyTimeoutId) clearTimeout(safetyTimeoutId)
        } else if (event === 'SIGNED_OUT') {
          if (safetyTimeoutId) clearTimeout(safetyTimeoutId)
          processingRef.current = false
          setUser(null)
          setCompanyId(null)
          setMember(null)
          setLoading(false)
          router.replace('/portal/auth')
        }
      }
    )

    return () => {
      if (safetyTimeoutId) clearTimeout(safetyTimeoutId)
      subscription.unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // タブ復帰時・定期的にセッションを確認し、期限切れなら再認証に誘導
  useEffect(() => {
    if (isPublicPath) return

    const checkSession = async () => {
      // まずトークンをリフレッシュ（期限切れの場合は新トークン取得、有効なら何もしない）
      const { data: refreshResult, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError || !refreshResult.session) {
        console.warn('[PortalAuth] セッション復旧失敗、再ログインへ')
        clearPageCache()
        setUser(null)
        setCompanyId(null)
        setMember(null)
        router.replace('/portal/auth')
      } else {
        setUser(refreshResult.session.user)
      }
    }

    // タブがアクティブに戻ったときにセッション確認
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSession()
      }
    }

    // 5分ごとにセッション確認（バックグラウンドでの期限切れ対策）
    const intervalId = setInterval(checkSession, 5 * 60 * 1000)

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(intervalId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPublicPath])

  const signOut = async () => {
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

  // 接続エラー（タイムアウト・ネットワーク障害・セッション不整合）
  if (authError === 'connection_error') {
    return (
      <PortalAuthContext.Provider value={contextValue}>
        <div className="flex items-center justify-center min-h-screen bg-white font-sans">
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none max-w-[400px] w-full mx-5">
            <CardContent className="p-10 text-center">
              <div className="mb-4 flex justify-center text-muted-foreground">
                <WifiOff size={48} />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-3">
                接続できませんでした
              </h2>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                サーバーとの通信に問題が発生しました。しばらく待ってから再試行してください。
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => window.location.reload()} className="rounded-lg">
                  再試行
                </Button>
                <Button variant="outline" onClick={signOut} className="rounded-lg">
                  ログアウト
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PortalAuthContext.Provider>
    )
  }

  // membersに未登録（クエリ成功 + レコードなし）
  if (authError === 'not_member' || !member || !companyId) {
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
