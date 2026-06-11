'use client'

// ブランドパーソナリティ診断 — 認証後リダイレクトページ
// 新規セッション作成 or 既存セッション復帰 → [sessionId] へリダイレクト
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Skeleton } from '@/components/ui/skeleton'

export default function PersonalityAppPage() {
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          router.replace('/portal/auth?from=personality')
          return
        }

        // セッション作成 or 既存セッション取得
        const res = await fetch('/api/tools/personality/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        })

        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'セッション作成に失敗しました')
          return
        }

        const { sessionId } = await res.json()
        router.replace(`/tools/personality/app/${sessionId}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'エラーが発生しました')
      }
    }

    init()
  }, [router])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-lg bg-red-50 px-6 py-4 text-sm text-red-600">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Skeleton className="mx-auto mb-4 h-8 w-48" />
        <p className="text-sm text-gray-500">準備中...</p>
      </div>
    </div>
  )
}
