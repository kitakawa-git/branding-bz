'use client'

// ロゴ規定ツール 本体（ログイン必須）
// ツールそのものは include.bz の tools.include.bz/logo-checker から移植した LogoValidator（画像処理はすべてブラウザ内。
// アップロードしたロゴは端末から出ない・保存もしない）。構築ツールの月次回数には数えない（AI もサーバー処理も無いため）
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppAuth } from '@/components/providers/AppAuthProvider'
import { Skeleton } from '@/components/ui/skeleton'
import LogoValidator from '../components/LogoValidator'

export default function LogoCheckerAppPage() {
  const { user, loading } = useAppAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/portal/auth?from=logo-checker')
  }, [loading, user, router])

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-6 py-10">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    )
  }
  return <LogoValidator />
}
