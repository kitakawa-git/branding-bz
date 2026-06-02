// マイページ振り分けルート（Server Component）
// middleware が更新した cookie からセッションを参照 → 適切な遷移先へ即 redirect
// クライアント側で getUser/admin_users を待たないので体感が速い
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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

  if (admin) {
    redirect(admin.is_superadmin ? '/superadmin/companies' : '/admin/dashboard')
  }

  redirect('/portal')
}
