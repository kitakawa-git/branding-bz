'use client'

// 後方互換: 旧認証ページ → 統一ログインへリダイレクト
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AuthSplash } from '@/components/admin/AuthSplash'

export default function ColorsAuthRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/portal/auth?from=colors')
  }, [router])

  return <AuthSplash message="リダイレクト中..." />
}
