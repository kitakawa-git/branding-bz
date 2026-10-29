'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppAuth } from '@/components/providers/AppAuthProvider'

/** 未ログインならログイン画面へ（戻り先は日程調整ツール） */
export function useRequireLogin() {
  const { user, loading } = useAppAuth()
  const router = useRouter()
  useEffect(() => {
    if (!loading && !user) router.replace('/portal/auth?from=sorou')
  }, [loading, user, router])
  return { user, ready: !loading && !!user }
}
