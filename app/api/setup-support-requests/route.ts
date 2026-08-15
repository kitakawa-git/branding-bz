// 入力サポート（オンライン相談）の依頼（契約者側）
// GET  /api/setup-support-requests — 自社の pending な依頼を返す（無ければ null）
// POST /api/setup-support-requests — 相談を申し込む  body: { preferredSlots, note? }
//
// カレンダー連携はしないので、ここは「希望を受け取る」までを担う。
// 日程の確定は画面の外（担当者が連絡して調整）で行う。
// 依頼の受け口はスーパー管理（/api/superadmin/setup-support-requests）。
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { fetchCompanyIdForAuth } from '@/lib/billing/guard'
import { computeOnboardingStatus } from '@/lib/onboarding/status'
import { buildOnboardingView } from '@/lib/onboarding/steps'
import { detailTable, escapeHtml, notifySuperadmin } from '@/lib/mail/superadmin-notify'

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
      .from('setup_support_requests')
      .select('id, preferred_slots, note, created_at')
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

    // 案内を出しているのは管理者だけ。UI 側でも一般メンバーには出していないが、
    // 表示を消すのは「見せない」であって「させない」ではないのでここで塞ぐ
    const admin = getSupabaseAdmin()
    const { data: adminUser } = await admin
      .from('admin_users')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle()
    if (!adminUser) {
      return NextResponse.json(
        { error: '入力サポートの相談は管理者のみ申し込めます' },
        { status: 403 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const preferredSlots = String(body.preferredSlots ?? '').trim().slice(0, 1000)
    const note = body.note ? String(body.note).slice(0, 2000) : null

    if (!preferredSlots) {
      return NextResponse.json({ error: '希望日時を入力してください' }, { status: 400 })
    }

    // 依頼時点の進捗を控える。担当者が相談前に「どこで詰まったか」を見られるようにする。
    // クライアントから受け取らずサーバで数え直すのは、あとで見る人が値を信じられるようにするため
    const [company, status] = await Promise.all([
      admin
        .from('companies')
        .select('name, plan, plan_expires_at')
        .eq('id', companyId)
        .maybeSingle()
        .then((r) => r.data),
      computeOnboardingStatus(companyId),
    ])
    const view = buildOnboardingView(company, status)

    // 1社1件。気が変わって出し直したときは上書きする
    // （部分ユニーク索引 setup_support_requests_one_pending_per_company と対で効かせる）
    const { data: existing } = await admin
      .from('setup_support_requests')
      .select('id')
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .maybeSingle()

    const payload = {
      company_id: companyId,
      progress_done: view.doneCount,
      progress_total: view.total,
      preferred_slots: preferredSlots,
      note,
      requested_by: user.id,
      requested_by_email: user.email ?? null,
      status: 'pending',
      updated_at: new Date().toISOString(),
    }

    const { error } = existing
      ? await admin.from('setup_support_requests').update(payload).eq('id', existing.id)
      : await admin.from('setup_support_requests').insert(payload)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 保存できてから通知する。バッジはスーパー管理画面を開くまで気づけないので、
    // 詰まっている人を待たせないためにメールでも知らせる
    const companyName = (company as { name?: string } | null)?.name ?? '(不明な企業)'
    await notifySuperadmin({
      subject: `【branding.bz】入力サポートの相談${existing ? '（申し込み直し）' : ''}: ${companyName}`,
      html: `
        <h2>入力サポートの相談が届きました</h2>
        ${detailTable([
          ['会社名', escapeHtml(companyName)],
          ['申込者', escapeHtml(user.email ?? '(不明)')],
          ['セットアップ進捗', `${view.doneCount} / ${view.total}`],
          ['ご希望の日時', escapeHtml(preferredSlots)],
          ['相談したいこと', escapeHtml(note ?? '(未入力)')],
        ])}
        <hr />
        <p><a href="https://branding.bz/superadmin/support-requests">スーパー管理で確認する</a></p>
      `,
    })

    return NextResponse.json({ ok: true, replaced: existing !== null })
  } catch (e) {
    const message = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
