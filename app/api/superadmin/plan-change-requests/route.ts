// プラン変更依頼の処理キュー（superadmin 限定）
// GET  /api/superadmin/plan-change-requests        — 未対応（status='pending'）の依頼一覧
// POST /api/superadmin/plan-change-requests        — 承認 or 却下
//        body: { requestId, action: 'approve'|'reject', note? }
// 認証は signup-requests と同方針（Bearer → auth.getUser → admin_users.is_superadmin）。
//
// 承認すると companies.plan を希望プランに書き換える。決済は自前で持たないので、
// 「入金・契約の確認は人がやり、反映だけをここでまとめて行う」という運用を前提にする。
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { SELLABLE_PLANS } from '@/lib/billing/entitlements'

async function requireSuperadmin(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: '認証が必要です' }, { status: 401 }) }
  }
  const token = authHeader.replace('Bearer ', '')
  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const {
    data: { user },
    error,
  } = await supabaseUser.auth.getUser()
  if (error || !user) {
    return { error: NextResponse.json({ error: '認証エラー' }, { status: 401 }) }
  }
  const admin = getSupabaseAdmin()
  const { data: au } = await admin
    .from('admin_users')
    .select('is_superadmin')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!au?.is_superadmin) {
    return { error: NextResponse.json({ error: 'スーパー管理者権限が必要です' }, { status: 403 }) }
  }
  return { admin, user }
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperadmin(request)
  if (auth.error) return auth.error
  const admin = auth.admin

  const { data: rows, error } = await admin
    .from('plan_change_requests')
    .select('id, company_id, current_plan, requested_plan, note, requested_by_email, created_at')
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
      company_name: nameOf.get(r.company_id as string) ?? '(削除された企業)',
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

  if (!requestId || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json({ error: 'パラメータが正しくありません' }, { status: 400 })
  }

  const { data: req } = await admin
    .from('plan_change_requests')
    .select('id, company_id, requested_plan, status')
    .eq('id', requestId)
    .maybeSingle()

  if (!req) {
    return NextResponse.json({ error: '依頼が見つかりません' }, { status: 404 })
  }
  // 別のタブで先に処理済みのものを二度反映しない
  if (req.status !== 'pending') {
    return NextResponse.json({ error: 'この依頼はすでに処理済みです' }, { status: 409 })
  }

  if (action === 'approve') {
    const plan = req.requested_plan as string
    if (!SELLABLE_PLANS.includes(plan as (typeof SELLABLE_PLANS)[number])) {
      return NextResponse.json({ error: '希望プランが不正です' }, { status: 400 })
    }
    const { error: planError } = await admin
      .from('companies')
      .update({ plan })
      .eq('id', req.company_id as string)
    if (planError) {
      // プランを変えられなかったのに依頼だけ承認済みにすると、あとで追えなくなる
      return NextResponse.json({ error: planError.message }, { status: 500 })
    }
  }

  const { error } = await admin
    .from('plan_change_requests')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
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
