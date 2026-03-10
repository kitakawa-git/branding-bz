'use client'

// 後方互換: 旧メンバーログインページ → 統一ログインへリダイレクト
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PortalLoginRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/portal/auth')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center font-sans">
      <p className="text-sm text-gray-500">リダイレクト中...</p>
    </div>
  )
}
