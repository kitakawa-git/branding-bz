// マイページ振り分けルート（Server Component）
// middleware が更新した cookie からセッションを参照 → 適切な遷移先へ即 redirect
// クライアント側で getUser/admin_users を待たないので体感が速い
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function MyPageRouter() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/portal/auth')
  }

  const { data: admin } = await supabase
    .from('admin_users')
    .select('is_superadmin')
    .eq('auth_id', user.id)
    .maybeSingle()

  // スーパー管理者のみ専用画面へ。一般管理者・メンバーはポータルに着地させる
  // （管理者は管理画面へポータルのサイドメニューから遷移可能）
  if (admin?.is_superadmin) {
    redirect('/superadmin/companies')
  }

  redirect('/portal')
}
