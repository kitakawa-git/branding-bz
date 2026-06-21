// OAuth ログイン後のゲート（Googleログインは既存メンバー専用）
// 本人のcookieセッションで認証 → members / admin_users の有無を確認。
// どちらも無い「孤児アカウント」（=ログイン画面からGoogleで続けるを押しただけで
// 登録されていない状態）の場合は、メールアドレスを解放するため service_role で
// auth user を削除し、{ orphan: true } を返す。
// 正規メンバー / 管理者 / 承認待ち(pending members 行あり) は削除しない。
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = getSupabaseAdmin()

  // members 行（status 問わず＝承認待ちも含む）と admin_users 行の有無を確認
  const [memberRes, adminRes] = await Promise.all([
    admin.from('members').select('id').eq('auth_id', user.id).limit(1),
    admin.from('admin_users').select('id').eq('auth_id', user.id).limit(1),
  ])

  const hasMember = (memberRes.data?.length ?? 0) > 0
  const hasAdmin = (adminRes.data?.length ?? 0) > 0

  if (hasMember || hasAdmin) {
    // 正規アカウント。そのまま通す。
    return NextResponse.json({ orphan: false })
  }

  // 孤児アカウント: どの企業にも紐づかない。削除してメールを解放する。
  const { error: delError } = await admin.auth.admin.deleteUser(user.id)
  if (delError) {
    console.error('[OAuthGate] 孤児アカウント削除エラー:', delError.message)
    // 削除に失敗しても orphan 扱いにして、クライアント側でサインアウト→登録導線へ
    return NextResponse.json({ orphan: true, deleted: false })
  }

  return NextResponse.json({ orphan: true, deleted: true })
}
