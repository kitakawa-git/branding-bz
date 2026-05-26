// 孤立した auth.users を削除する管理者専用API
// POST /api/members/cleanup-orphan
// body: { email: string }
// members テーブルに存在しないが auth.users には残っているアカウントを削除
// （削除処理が auth.users 段階で失敗した時の復旧用）
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { supabase } from '@/lib/supabase'

async function getAdminCompanyId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null

  const supabaseAdmin = getSupabaseAdmin()
  const { data: admin } = await supabaseAdmin
    .from('admin_users')
    .select('company_id')
    .eq('auth_id', user.id)
    .single()

  return admin?.company_id || null
}

export async function POST(request: NextRequest) {
  try {
    const companyId = await getAdminCompanyId(request)
    if (!companyId) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const { email } = await request.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email が必要です' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // 1) members に該当 email がまだ残っているなら拒否（誤操作防止）
    const { data: existingMembers } = await supabaseAdmin
      .from('members')
      .select('id, company_id, email')
      .eq('email', email)

    if (existingMembers && existingMembers.length > 0) {
      return NextResponse.json(
        {
          error: 'このメールアドレスはまだ members に存在しています。先に通常の削除を実行してください。',
          members: existingMembers,
        },
        { status: 409 }
      )
    }

    // 2) auth.users 一覧から該当 email を探す
    // listUsers はページネーション付き。500件まで読む（小規模運用前提）
    let targetAuthId: string | null = null
    let page = 1
    while (page <= 5) {
      const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 100,
      })
      if (listError) {
        return NextResponse.json(
          { error: `auth.users 取得エラー: ${listError.message}` },
          { status: 500 }
        )
      }
      const found = listData.users.find(u => u.email === email)
      if (found) {
        targetAuthId = found.id
        break
      }
      if (listData.users.length < 100) break
      page++
    }

    if (!targetAuthId) {
      return NextResponse.json(
        { error: 'auth.users にもこのメールアドレスは存在しません' },
        { status: 404 }
      )
    }

    // 3) 関連 profiles も残っていれば削除（email 一致）
    await supabaseAdmin.from('profiles').delete().eq('email', email)

    // 4) auth.users 削除
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetAuthId)
    if (deleteError) {
      console.error('[CleanupOrphan] auth.users削除エラー:', deleteError.message)
      return NextResponse.json(
        { error: `auth.users 削除に失敗: ${deleteError.message}`, authId: targetAuthId },
        { status: 500 }
      )
    }

    console.log('[CleanupOrphan] 孤立 auth.users 削除完了:', email, targetAuthId)
    return NextResponse.json({ success: true, email, authId: targetAuthId })
  } catch (err) {
    console.error('[CleanupOrphan] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
