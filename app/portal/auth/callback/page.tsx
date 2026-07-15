'use client'

// ポータル OAuth コールバックページ
// implicit flow のトークン → cookie 化 → getUser() で確定 → 遷移
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AuthSplash } from '@/components/admin/AuthSplash'

export default function PortalAuthCallbackPage() {
  return (
    <Suspense fallback={<AuthSplash />}>
      <PortalAuthCallbackContent />
    </Suspense>
  )
}

function PortalAuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const from = searchParams.get('from')

    ;(async () => {
      try {
        const { data, error: getUserError } = await supabase.auth.getUser()
        if (cancelled) return

        if (getUserError || !data.user) {
          setError('認証に失敗しました')
          setTimeout(() => {
            const errorUrl = from
              ? `/portal/auth?from=${from}&error=auth_failed`
              : '/portal/auth?error=auth_failed'
            router.replace(errorUrl)
          }, 1500)
          return
        }

        // Googleログインは既存メンバー専用。未登録の孤児アカウントはここで弾く。
        // （members / admin_users が無ければサーバ側で auth user を削除しメールを解放する）
        // 認証は本人の cookie セッションで解決するため Authorization ヘッダは不要。
        const res = await fetch('/api/portal/oauth-gate', { method: 'POST' })
        if (cancelled) return
        const gate = await res.json().catch(() => ({ orphan: false }))
        if (gate.orphan) {
          // 未登録 → サインアウトして「まず新規登録を」へ誘導
          await supabase.auth.signOut()
          if (cancelled) return
          const errorUrl = from
            ? `/portal/auth?from=${from}&error=not_registered`
            : '/portal/auth?error=not_registered'
          router.replace(errorUrl)
          return
        }

        if (from) {
          router.replace(`/portal/auth/select?from=${from}`)
        } else {
          router.replace('/portal')
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[PortalCallback] エラー:', err)
          setError('認証中にエラーが発生しました')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [router, searchParams])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6 font-sans">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 px-6 py-4 text-sm text-rose-500">
          {error}
        </div>
      </div>
    )
  }

  return <AuthSplash message="認証を確認しています..." />
}
