// コピーAI API 共通 superadmin ガード（既存 /api/superadmin/copy/* と同型）。
// Bearer → getUser → admin_users.is_superadmin を確認。OK時は userId も返す。
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function requireSuperadmin(
  request: NextRequest,
): Promise<{ ok: true; userId: string } | { ok: false; res: NextResponse }> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, res: NextResponse.json({ error: '認証が必要です。再ログインしてください。' }, { status: 401 }) }
  }
  const token = authHeader.replace('Bearer ', '')
  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
  if (authError || !user) {
    return { ok: false, res: NextResponse.json({ error: '認証エラー: セッションが無効です。' }, { status: 401 }) }
  }
  const supabaseAdmin = getSupabaseAdmin()
  const { data: adminUser } = await supabaseAdmin
    .from('admin_users')
    .select('is_superadmin')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!adminUser?.is_superadmin) {
    return { ok: false, res: NextResponse.json({ error: 'スーパー管理者権限が必要です。' }, { status: 403 }) }
  }
  return { ok: true, userId: user.id }
}
