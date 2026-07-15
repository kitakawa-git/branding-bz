'use client'

// 後方互換: 旧メンバーログインページ → 統一ログインへリダイレクト
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AuthSplash } from '@/components/admin/AuthSplash'

export default function PortalLoginRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/portal/auth')
  }, [router])

  return <AuthSplash message="リダイレクト中..." />
}
