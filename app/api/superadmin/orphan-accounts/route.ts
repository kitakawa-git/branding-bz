// スーパー管理: 孤立した auth ユーザーの一覧と削除（superadmin限定）
// GET    /api/superadmin/orphan-accounts        一覧
// DELETE /api/superadmin/orphan-accounts?id=... 1件削除
//
// 「孤立」＝ auth.users には居るが members にも admin_users にも居ない状態。
// この人が再登録しようとすると「既に登録されています」で弾かれるため、
// 消せる手段が要る。
//
// 以前は管理画面（/admin/members）に置いていたが、2つ問題があった:
//  1. 認可が「どこかの会社の管理者か」だけで、削除時の profiles の消し込みに
//     会社の絞り込みが無く、他社の名刺プロフィールを消せてしまった
//  2. 内部状態の復旧作業を、原因も分からない契約者に削除ボタンとして渡していた
// superadmin 限定に移し、対象は「孤立している auth ユーザー」に閉じている。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireSuperadmin as requireSuperadminCaller } from '@/lib/auth/caller'

/** superadmin 認証。判定は lib/auth/caller に一本化（通れば null） */
async function requireSuperadmin(request: NextRequest): Promise<NextResponse | null> {
  const caller = await requireSuperadminCaller(request)
  return caller.error ?? null
}

/**
 * 孤立している auth ユーザーを集める。
 * listUsers はページ送りなので、上限を決めて回す（小規模運用前提）。
 */
async function fetchOrphans() {
  const admin = getSupabaseAdmin()

  const [{ data: members }, { data: admins }] = await Promise.all([
    admin.from('members').select('auth_id'),
    admin.from('admin_users').select('auth_id'),
  ])
  const linked = new Set(
    [...(members ?? []), ...(admins ?? [])]
      .map((r) => (r as { auth_id: string | null }).auth_id)
      .filter((v): v is string => !!v),
  )

  const orphans: { id: string; email: string | null; createdAt: string; lastSignInAt: string | null }[] = []
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw new Error(error.message)
    for (const u of data.users) {
      if (!linked.has(u.id)) {
        orphans.push({
          id: u.id,
          email: u.email ?? null,
          createdAt: u.created_at,
          lastSignInAt: u.last_sign_in_at ?? null,
        })
      }
    }
    if (data.users.length < 100) break
  }
  orphans.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return orphans
}

export async function GET(request: NextRequest) {
  const denied = await requireSuperadmin(request)
  if (denied) return denied
  try {
    return NextResponse.json({ orphans: await fetchOrphans() })
  } catch (e) {
    const message = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const denied = await requireSuperadmin(request)
  if (denied) return denied
  try {
    const authId = new URL(request.url).searchParams.get('id')
    if (!authId) {
      return NextResponse.json({ error: 'id は必須です' }, { status: 400 })
    }

    // 一覧を取り直して、いまも孤立しているものだけを消す。
    // 画面を開いてから時間が経って、その間に紐づいた場合に消さないため
    const orphans = await fetchOrphans()
    const target = orphans.find((o) => o.id === authId)
    if (!target) {
      return NextResponse.json(
        { error: 'このアカウントは孤立していません（すでに削除済みか、会社に紐づきました）' },
        { status: 409 },
      )
    }

    const { error } = await getSupabaseAdmin().auth.admin.deleteUser(authId)
    if (error) {
      return NextResponse.json({ error: `削除に失敗: ${error.message}` }, { status: 500 })
    }
    return NextResponse.json({ ok: true, email: target.email })
  } catch (e) {
    const message = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
