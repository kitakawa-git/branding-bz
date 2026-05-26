'use client'

// 管理画面 OAuth コールバックページ
// implicit flow で受け取ったトークンを @supabase/ssr クライアントが
// cookie にセット → getUser() で確定 → admin_users チェックして遷移
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminAuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const { data, error: getUserError } = await supabase.auth.getUser()
        if (cancelled) return

        if (getUserError || !data.user) {
          setError('認証に失敗しました')
          setTimeout(() => router.replace('/admin/login?error=auth_failed'), 1500)
          return
        }

        // admin_users で管理者権限を確認
        const { data: adminUser, error: adminError } = await supabase
          .from('admin_users')
          .select('is_superadmin')
          .eq('auth_id', data.user.id)
          .maybeSingle()

        if (cancelled) return

        if (adminError || !adminUser) {
          setError('このアカウントは管理者として登録されていません')
          await supabase.auth.signOut().catch(() => {})
          setTimeout(() => router.replace('/admin/login?error=not_admin'), 1500)
          return
        }

        if (adminUser.is_superadmin === true) {
          router.replace('/admin/login?superadmin=true')
        } else {
          router.replace('/admin/members')
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[AdminCallback] エラー:', err)
          setError('認証中にエラーが発生しました')
          setTimeout(() => router.replace('/admin/login?error=auth_failed'), 1500)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [router])

  if (error) {
    return (
      <div
        className="flex min-h-screen items-center justify-center font-sans"
        style={{ background: 'linear-gradient(135deg, #0f0f1a 0%, #141425 50%, #0d0d1a 100%)' }}
      >
        <div
          className="rounded-xl px-6 py-4 text-sm text-red-300"
          style={{ background: 'rgba(220, 38, 38, 0.15)', border: '1px solid rgba(220, 38, 38, 0.25)' }}
        >
          {error}
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center font-sans"
      style={{ background: 'linear-gradient(135deg, #0f0f1a 0%, #141425 50%, #0d0d1a 100%)' }}
    >
      <div className="text-center">
        <Skeleton className="mx-auto mb-4 h-8 w-48 bg-white/10" />
        <p className="text-sm text-white/50">認証を確認しています...</p>
      </div>
    </div>
  )
}
