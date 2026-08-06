// 管理者権限の取得・付与・剥奪
// GET    /api/admin/members/admin-role                    → 自社の管理者の auth_id 一覧
// POST   /api/admin/members/admin-role  body: { auth_id } → 管理者にする
// DELETE /api/admin/members/admin-role?auth_id=xxx        → 管理者から外す
//
// ⚠ admin_users は RLS で「自分の行」しか読めない（スーパー管理者を除く）。
//   クライアントから select すると他人の管理者状態が取れず、全員 OFF に見える。
//   一覧は必ずこの GET（service_role）を通すこと。
//
// 管理者かどうかは admin_users に行があるかで決まる。これまで行が作られるのは
// 新規登録した本人（会社を作った人）だけで、画面から増やす手段が無かった。
//
// 対象の会社は呼び出した管理者の company_id で確定させる（body では受けない）。
// 他社のメンバーを管理者にできてしまうため。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { supabase } from '@/lib/supabase'

/** 呼び出し元が管理者ならその company_id、そうでなければ null */
async function getAdminContext(
  req: NextRequest
): Promise<{ companyId: string; authId: string } | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null

  const token = authHeader.replace('Bearer ', '')
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)
  if (error || !user) return null

  const { data: admin } = await getSupabaseAdmin()
    .from('admin_users')
    .select('company_id')
    .eq('auth_id', user.id)
    .single()

  if (!admin?.company_id) return null
  return { companyId: admin.company_id as string, authId: user.id }
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAdminContext(request)
    if (!ctx) {
      return NextResponse.json({ error: '管理者のみ操作できます' }, { status: 403 })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('admin_users')
      .select('auth_id')
      .eq('company_id', ctx.companyId)

    if (error) {
      console.error('[AdminRole GET] エラー:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ auth_ids: (data ?? []).map((a) => a.auth_id as string) })
  } catch (err) {
    console.error('[AdminRole GET] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAdminContext(request)
    if (!ctx) {
      return NextResponse.json({ error: '管理者のみ操作できます' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const targetAuthId = body?.auth_id
    if (typeof targetAuthId !== 'string' || !targetAuthId) {
      return NextResponse.json({ error: 'auth_id は必須です' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()

    // 自社のメンバーであることを確かめる。auth_id だけで受けると他社の
    // ユーザーを自社の管理者に登録できてしまう
    const { data: member } = await admin
      .from('members')
      .select('id')
      .eq('auth_id', targetAuthId)
      .eq('company_id', ctx.companyId)
      .maybeSingle()

    if (!member) {
      return NextResponse.json(
        { error: 'この会社のメンバーではありません' },
        { status: 400 }
      )
    }

    const { error } = await admin
      .from('admin_users')
      .upsert({ auth_id: targetAuthId, company_id: ctx.companyId, role: 'owner' }, {
        onConflict: 'auth_id',
      })

    if (error) {
      console.error('[AdminRole POST] エラー:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[AdminRole POST] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await getAdminContext(request)
    if (!ctx) {
      return NextResponse.json({ error: '管理者のみ操作できます' }, { status: 403 })
    }

    const targetAuthId = request.nextUrl.searchParams.get('auth_id')
    if (!targetAuthId) {
      return NextResponse.json({ error: 'auth_id は必須です' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()

    // 最後の1人を外すと、その会社は誰も管理画面に入れなくなる。
    // 復旧にはDBの直接操作が要るので、ここで止める
    const { count } = await admin
      .from('admin_users')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', ctx.companyId)

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: '管理者が1人だけです。外すと誰も管理画面に入れなくなります' },
        { status: 400 }
      )
    }

    const { error } = await admin
      .from('admin_users')
      .delete()
      .eq('auth_id', targetAuthId)
      .eq('company_id', ctx.companyId)

    if (error) {
      console.error('[AdminRole DELETE] エラー:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[AdminRole DELETE] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
