'use client'

// ポータル OAuth コールバックページ
// implicit flow のトークン → cookie 化 → getUser() で確定 → 遷移
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Skeleton } from '@/components/ui/skeleton'

export default function PortalAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center font-sans">
        <p className="text-sm text-gray-500">読み込み中...</p>
      </div>
    }>
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
      <div className="flex min-h-screen items-center justify-center font-sans">
        <div className="rounded-lg bg-red-50 px-6 py-4 text-sm text-red-600">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center font-sans">
      <div className="text-center">
        <Skeleton className="mx-auto mb-4 h-8 w-48" />
        <p className="text-sm text-gray-500">認証を確認しています...</p>
      </div>
    </div>
  )
}
