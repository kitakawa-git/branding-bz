// ビデオラーニング API 用の認証・所属解決ヘルパー（サーバー専用）
// 認証は @supabase/ssr の cookie ベース getUser() に準拠。
// company_id は admin_users（管理側）/ members→profiles（ポータル側）から解決する。
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// 管理者コンテキスト（admin_users 登録者）
export type AdminContext = {
  authId: string
  companyId: string
}

// ポータルメンバーコンテキスト（members 登録者）
export type MemberContext = {
  authId: string
  companyId: string
  profileId: string
}

// cookie セッションから認証ユーザー ID を取得（未認証なら null）
async function getAuthUserId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

// 管理者の company_id を解決（admin_users 未登録なら null）
export async function getAdminContext(): Promise<AdminContext | null> {
  const authId = await getAuthUserId()
  if (!authId) return null

  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('admin_users')
    .select('company_id')
    .eq('auth_id', authId)
    .maybeSingle()

  if (!data?.company_id) return null
  return { authId, companyId: data.company_id }
}

// ポータルメンバーの company_id / profile_id を解決（members 未登録なら null）
export async function getMemberContext(): Promise<MemberContext | null> {
  const authId = await getAuthUserId()
  if (!authId) return null

  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('members')
    .select('company_id, profile_id')
    .eq('auth_id', authId)
    .eq('is_active', true)
    .maybeSingle()

  if (!data?.company_id || !data?.profile_id) return null
  return { authId, companyId: data.company_id, profileId: data.profile_id }
}
