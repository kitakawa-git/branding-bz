'use client'

// 共通認証 Provider（責務はセッション管理のみ）
// - 初回は getSession() で進め、getUser()（サーバー検証）は裏で行う
// - middleware と組み合わせて cookie ベースで動く
// - アプリ固有データ取得は AdminDataProvider / PortalDataProvider に分離
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { clearAllPageCache } from '@/lib/page-cache'

type AppAuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const AppAuthContext = createContext<AppAuthContextValue | null>(null)

// 初回表示のデータ取得が終わるころにセッションを検証する
const VERIFY_DELAY_MS = 3000

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
    let verifyTimer: ReturnType<typeof setTimeout> | undefined

    // 旧クライアントの localStorage キーをクリーンアップ
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem('branding-bz-auth')
      } catch {
        // ignore
      }
    }

    // 初回は cookie のセッションですぐ画面を進める（期限切れならここでリフレッシュされる）。
    // getUser の往復を待つと、ポータルの全ページで最初のデータ取得がその分遅れる。
    // ここで得た user は画面の出し分けと問い合わせの条件にしか使わない。
    // データは RLS と API 側の検証が守るので、失効済みでも何も読めない。
    ;(async () => {
      try {
        const { data: { session: current } } = await supabase.auth.getSession()
        if (cancelled) return
        setSession(current)
        setUser(current?.user ?? null)
        initialFetchedRef.current = true
        setLoading(false)
        if (!current) return

        // 失効していないかは少し後で確かめる。通信エラーではログアウトさせない。
        // すぐ呼ぶと、getUser の応答までクライアントの内部ロックで最初のデータ取得が待たされる
        verifyTimer = setTimeout(async () => {
          const { error } = await supabase.auth.getUser()
          if (cancelled || !error) return
          if (error.status === 401 || error.status === 403 || error.name === 'AuthSessionMissingError') {
            setSession(null)
            setUser(null)
          }
        }, VERIFY_DELAY_MS)
      } catch (err) {
        if (!cancelled) {
          console.error('[AppAuthProvider] セッション確認に失敗:', err)
          initialFetchedRef.current = true
          setLoading(false)
        }
      }
    })()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (cancelled) return
        // ログアウト（別タブでのログアウト・セッション失効を含む）時は、保存したページデータを消す
        if (event === 'SIGNED_OUT') clearAllPageCache()
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
      if (verifyTimer) clearTimeout(verifyTimer)
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
    // 前のユーザーのデータ（sessionStorage に保存したページデータを含む）を残さない
    clearAllPageCache()
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
