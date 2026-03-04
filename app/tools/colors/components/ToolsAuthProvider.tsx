'use client'

// ミニアプリ用認証プロバイダー（admin/portalとは独立の軽量版）
// admin_users / members テーブルへの問い合わせは不要
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { MiniAppSession } from '@/lib/types/color-tool'

interface ToolsAuthContextType {
  user: User | null
  session: MiniAppSession | null
  loading: boolean
  signOut: () => Promise<void>
}

const ToolsAuthContext = createContext<ToolsAuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
})

export function useToolsAuth() {
  return useContext(ToolsAuthContext)
}

export function ToolsAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<MiniAppSession | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const loadedRef = useRef(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, authSession) => {
        console.log('[ToolsAuth] event:', event)

        if (event === 'SIGNED_OUT') {
          setUser(null)
          setSession(null)
          setLoading(false)
          router.replace('/tools/colors')
          return
        }

        if (
          event === 'INITIAL_SESSION' ||
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED'
        ) {
          if (!authSession?.user) {
            // 未認証 → Landing へリダイレクト
            setLoading(false)
            router.replace('/tools/colors')
            return
          }

          setUser(authSession.user)

          // データ読込済み & 初回セッションでない場合はスキップ
          if (loadedRef.current && event !== 'INITIAL_SESSION') {
            setLoading(false)
            return
          }

          // mini_app_sessions から最新セッション取得
          try {
            const { data: sessionData } = await supabase
              .from('mini_app_sessions')
              .select('*')
              .eq('user_id', authSession.user.id)
              .eq('app_type', 'brand_colors')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (sessionData) {
              setSession(sessionData as MiniAppSession)
            }
            loadedRef.current = true
          } catch (err) {
            console.error('[ToolsAuth] セッション取得エラー:', err)
          }

          setLoading(false)
        }
      }
    )

    // 10秒タイムアウト
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('[ToolsAuth] 初期セッション取得タイムアウト')
        setLoading(false)
        router.replace('/tools/colors')
      }
    }, 10000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <ToolsAuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </ToolsAuthContext.Provider>
  )
}
