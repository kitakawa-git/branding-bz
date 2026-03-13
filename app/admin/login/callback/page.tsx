'use client'

// 管理画面 OAuth コールバックページ（implicit flow）
// Google認証後のリダイレクト先。admin_usersチェックを行い、管理画面へ遷移
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminAuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          subscription.unsubscribe()

          // admin_usersテーブルで管理者権限を確認
          const { data: adminUser, error: adminError } = await supabase
            .from('admin_users')
            .select('*')
            .eq('auth_id', session.user.id)
            .single()

          if (adminError || !adminUser) {
            setError('このアカウントは管理者として登録されていません')
            await supabase.auth.signOut()
            setTimeout(() => {
              router.replace('/admin/login?error=not_admin')
            }, 2000)
            return
          }

          // スーパー管理者の場合は遷移先選択画面へ
          if (adminUser.is_superadmin === true) {
            router.replace('/admin/login?superadmin=true')
          } else {
            router.replace('/admin/members')
          }
        }
      }
    )

    // すでにセッションがある場合
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('*')
          .eq('auth_id', session.user.id)
          .single()

        if (adminUser?.is_superadmin) {
          router.replace('/admin/login?superadmin=true')
        } else if (adminUser) {
          router.replace('/admin/members')
        }
      }
    })

    // 10秒タイムアウト
    const timeout = setTimeout(() => {
      subscription.unsubscribe()
      setError('認証に失敗しました')
      setTimeout(() => {
        router.replace('/admin/login?error=auth_failed')
      }, 1500)
    }, 10000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [router])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center font-sans"
        style={{ background: 'linear-gradient(135deg, #0f0f1a 0%, #141425 50%, #0d0d1a 100%)' }}>
        <div className="rounded-xl px-6 py-4 text-sm text-red-300"
          style={{ background: 'rgba(220, 38, 38, 0.15)', border: '1px solid rgba(220, 38, 38, 0.25)' }}>
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center font-sans"
      style={{ background: 'linear-gradient(135deg, #0f0f1a 0%, #141425 50%, #0d0d1a 100%)' }}>
      <div className="text-center">
        <Skeleton className="mx-auto mb-4 h-8 w-48 bg-white/10" />
        <p className="text-sm text-white/50">認証を確認しています...</p>
      </div>
    </div>
  )
}
