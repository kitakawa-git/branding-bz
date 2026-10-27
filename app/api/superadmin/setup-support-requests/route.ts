// 入力サポート相談の処理キュー（superadmin 限定）
// GET  /api/superadmin/setup-support-requests — 未対応（status='pending'）の依頼一覧
// POST /api/superadmin/setup-support-requests — 対応済み or 取り下げ
//        body: { requestId, action: 'done'|'cancel', note? }
// 認証は plan-change-requests と同方針（Bearer → auth.getUser → admin_users.is_superadmin）。
//
// カレンダー連携はしないので、日程調整そのものはこの画面の外（メール・電話）で行う。
// ここは「誰から相談が来ていて、まだ返していないのはどれか」を落とさないための箱。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireSuperadmin as requireSuperadminCaller } from '@/lib/auth/caller'

async function requireSuperadmin(request: NextRequest) {
  // 判定は lib/auth/caller に一本化（Bearer と cookie の両方を受ける）。呼び出し側の互換のため戻り値の形は以前のまま
  const caller = await requireSuperadminCaller(request)
  if (caller.error) return { error: caller.error }
  return { admin: getSupabaseAdmin(), user: { id: caller.authId } }
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperadmin(request)
  if (auth.error) return auth.error
  const admin = auth.admin

  const { data: rows, error } = await admin
    .from('setup_support_requests')
    .select(
      'id, company_id, progress_done, progress_total, preferred_slots, note, requested_by_email, created_at',
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 会社名は依頼行に持たせていない（改名に追随させたいため）。まとめて1回で引く
  const companyIds = [...new Set((rows ?? []).map((r) => r.company_id as string))]
  const nameOf = new Map<string, string>()
  if (companyIds.length > 0) {
    const { data: companies } = await admin
      .from('companies')
      .select('id, name')
      .in('id', companyIds)
    for (const c of companies ?? []) nameOf.set(c.id as string, c.name as string)
  }

  return NextResponse.json({
    requests: (rows ?? []).map((r) => ({
      ...r,
      company_name: nameOf.get(r.company_id as string) ?? '(削除されたブランド)',
    })),
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperadmin(request)
  if (auth.error) return auth.error
  const { admin, user } = auth

  const body = await request.json().catch(() => ({}))
  const requestId = String(body.requestId ?? '')
  const action = String(body.action ?? '')
  const handledNote = body.note ? String(body.note).slice(0, 1000) : null

  if (!requestId || (action !== 'done' && action !== 'cancel')) {
    return NextResponse.json({ error: 'パラメータが正しくありません' }, { status: 400 })
  }

  const { data: req } = await admin
    .from('setup_support_requests')
    .select('id, status')
    .eq('id', requestId)
    .maybeSingle()

  if (!req) {
    return NextResponse.json({ error: '依頼が見つかりません' }, { status: 404 })
  }
  // 別のタブで先に処理済みのものを二度触らない
  if (req.status !== 'pending') {
    return NextResponse.json({ error: 'この依頼はすでに処理済みです' }, { status: 409 })
  }

  const { error } = await admin
    .from('setup_support_requests')
    .update({
      status: action === 'done' ? 'done' : 'cancelled',
      handled_note: handledNote,
      handled_at: new Date().toISOString(),
      handled_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
