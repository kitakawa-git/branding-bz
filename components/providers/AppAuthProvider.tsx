'use client'

// 共通認証 Provider（責務はセッション管理のみ）
// - getUser() を使う（サーバー検証 → 期限切れトークンを自動リフレッシュ）
// - middleware と組み合わせて cookie ベースで動く
// - アプリ固有データ取得は AdminDataProvider / PortalDataProvider に分離
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type AppAuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const AppAuthContext = createContext<AppAuthContextValue | null>(null)

export function AppAuthProvider({
  children,
  redirectOnSignOutTo,
}: {
  children: React.ReactNode
  redirectOnSignOutTo?: string
}) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const initialFetchedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    // 旧クライアントの localStorage キーをクリーンアップ
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem('branding-bz-auth')
      } catch {
        // ignore
      }
    }

    // 初回は getSession ではなく getUser を使う（サーバー検証 → 期限切れトークンを自動リフレッシュ）
    ;(async () => {
      try {
        const { data } = await supabase.auth.getUser()
        if (cancelled) return
        if (data.user) {
          const { data: sessionData } = await supabase.auth.getSession()
          if (cancelled) return
          setSession(sessionData.session)
          setUser(data.user)
        } else {
          setSession(null)
          setUser(null)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[AppAuthProvider] getUser 失敗:', err)
          setSession(null)
          setUser(null)
        }
      } finally {
        if (!cancelled) {
          initialFetchedRef.current = true
          setLoading(false)
        }
      }
    })()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (cancelled) return
        // INITIAL_SESSION は初回 getUser で既に処理しているので無視
        if (event === 'INITIAL_SESSION' && initialFetchedRef.current) return
        setSession(newSession)
        // 同一ユーザーのトークンリフレッシュ等では user の参照を保つ。
        // user を依存に持つ consumer（データProvider・Header等）の不要な再実行を防ぎ、
        // 「読み込み中」のちらつきと無駄なDB再取得を抑える。
        setUser((prev) => {
          const next = newSession?.user ?? null
          return prev && next && prev.id === next.id ? prev : next
        })
        setLoading(false)
      }
    )

    // タブ復帰時にセッション再検証（getUser がリフレッシュをトリガする）
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getUser().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  // signOut は参照を安定させる（consumer の不要な再レンダー／再実行を防ぐ）
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('[AppAuthProvider] signOut エラー:', err)
    }
    setUser(null)
    setSession(null)
    if (redirectOnSignOutTo) {
      router.replace(redirectOnSignOutTo)
    }
  }, [router, redirectOnSignOutTo])

  // context value をメモ化。これがないと毎レンダーで新しいオブジェクトになり、
  // user の参照を保っても全 consumer が再レンダーしてしまう。
  const value = useMemo(
    () => ({ user, session, loading, signOut }),
    [user, session, loading, signOut]
  )

  return (
    <AppAuthContext.Provider value={value}>
      {children}
    </AppAuthContext.Provider>
  )
}

export function useAppAuth() {
  const ctx = useContext(AppAuthContext)
  if (!ctx) throw new Error('useAppAuth must be used within AppAuthProvider')
  return ctx
}
