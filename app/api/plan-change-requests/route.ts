// プラン変更の依頼（契約者側）
// GET  /api/plan-change-requests — 自社の pending な依頼を返す（無ければ null）
// POST /api/plan-change-requests — 希望プランを出す  body: { requestedPlan, note? }
//
// 決済を自前で持たないので、ここは「希望を受け取る」までを担う。
// 実際にプランを変えるのはスーパー管理側（/api/superadmin/plan-change-requests）。
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { fetchCompanyIdForAuth } from '@/lib/billing/guard'
import { getEffectivePlan, SELLABLE_PLANS } from '@/lib/billing/entitlements'

/** ログイン中のユーザーと所属会社。どちらか欠けたら 401 */
async function resolveCaller() {
  const supabaseUser = await createServerSupabase()
  const {
    data: { user },
  } = await supabaseUser.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: '認証が必要です' }, { status: 401 }) }

  const companyId = await fetchCompanyIdForAuth(user.id)
  if (!companyId) {
    return { error: NextResponse.json({ error: '所属会社が見つかりません' }, { status: 403 }) }
  }
  return { user, companyId }
}

export async function GET() {
  try {
    const caller = await resolveCaller()
    if (caller.error) return caller.error

    const admin = getSupabaseAdmin()
    const { data } = await admin
      .from('plan_change_requests')
      .select('id, requested_plan, note, created_at')
      .eq('company_id', caller.companyId)
      .eq('status', 'pending')
      .maybeSingle()

    return NextResponse.json({ pending: data ?? null })
  } catch (e) {
    const message = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await resolveCaller()
    if (caller.error) return caller.error
    const { user, companyId } = caller

    // 契約に関わる依頼なので管理者だけ。
    // UI 側でも一般メンバーには依頼ボタンを出していないが、
    // 表示を消すのは「見せない」であって「させない」ではないのでここで塞ぐ。
    // 判定元はポータルの isAdmin と同じ admin_users
    const { data: adminUser } = await getSupabaseAdmin()
      .from('admin_users')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle()
    if (!adminUser) {
      return NextResponse.json(
        { error: 'プラン変更の依頼は管理者のみ行えます' },
        { status: 403 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const requestedPlan = String(body.requestedPlan ?? '')
    const note = body.note ? String(body.note).slice(0, 1000) : null

    if (!SELLABLE_PLANS.includes(requestedPlan as (typeof SELLABLE_PLANS)[number])) {
      return NextResponse.json({ error: 'プランの指定が正しくありません' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    const { data: company } = await admin
      .from('companies')
      .select('plan, plan_expires_at')
      .eq('id', companyId)
      .maybeSingle()

    // 期限切れの premium は free 扱い。依頼の文脈としては実効プランのほうが正しい
    const currentPlan = getEffectivePlan(company)
    if (currentPlan === requestedPlan) {
      return NextResponse.json({ error: 'すでにこのプランです' }, { status: 400 })
    }

    // 1社1件。気が変わって出し直したときは上書きする
    // （部分ユニーク索引 plan_change_requests_one_pending_per_company と対で効かせる）
    const { data: existing } = await admin
      .from('plan_change_requests')
      .select('id')
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .maybeSingle()

    const payload = {
      company_id: companyId,
      current_plan: currentPlan,
      requested_plan: requestedPlan,
      note,
      requested_by: user.id,
      requested_by_email: user.email ?? null,
      status: 'pending',
      updated_at: new Date().toISOString(),
    }

    const { error } = existing
      ? await admin.from('plan_change_requests').update(payload).eq('id', existing.id)
      : await admin.from('plan_change_requests').insert(payload)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, replaced: existing !== null })
  } catch (e) {
    const message = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
