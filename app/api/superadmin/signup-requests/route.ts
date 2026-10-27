// 新規owner登録の superadmin 承認キュー
// GET  /api/superadmin/signup-requests        — 承認待ち（approval_status='pending'）の企業一覧
// POST /api/superadmin/signup-requests         — 承認 or 却下  body: { companyId, action: 'approve'|'reject' }
// 認証: 本人の Bearer トークンで is_superadmin を確認。実処理は service_role。
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { escapeHtml } from '@/lib/mail/escape-html'
import { requireSuperadmin as requireSuperadminCaller } from '@/lib/auth/caller'

export const runtime = 'nodejs'

// Bearer トークン → superadmin 検証。OK なら admin クライアントを返す。
async function requireSuperadmin(request: NextRequest) {
  // 判定は lib/auth/caller に一本化（Bearer と cookie の両方を受ける）。呼び出し側の互換のため戻り値の形は以前のまま
  const caller = await requireSuperadminCaller(request)
  if (caller.error) return { error: caller.error }
  return { admin: getSupabaseAdmin() }
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperadmin(request)
  if (auth.error) return auth.error
  const admin = auth.admin

  // 承認待ちの企業
  const { data: companies, error } = await admin
    .from('companies')
    .select('id, name, competitor_flag, email_domain, created_at')
    .eq('approval_status', 'pending')
    .order('created_at', { ascending: false })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 各企業の登録者（members）情報を付与
  const ids = (companies ?? []).map((c) => c.id)
  const ownersByCompany: Record<string, { email: string; name: string }> = {}
  if (ids.length > 0) {
    const { data: members } = await admin
      .from('members')
      .select('company_id, email, display_name')
      .in('company_id', ids)
    for (const m of members ?? []) {
      if (!ownersByCompany[m.company_id]) {
        ownersByCompany[m.company_id] = { email: m.email ?? '', name: m.display_name ?? '' }
      }
    }
  }

  const requests = (companies ?? []).map((c) => ({
    companyId: c.id,
    companyName: c.name,
    competitorFlag: c.competitor_flag === true,
    emailDomain: c.email_domain ?? null,
    createdAt: c.created_at,
    owner: ownersByCompany[c.id] ?? { email: '', name: '' },
  }))

  return NextResponse.json({ requests })
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperadmin(request)
  if (auth.error) return auth.error
  const admin = auth.admin

  let body: { companyId?: string; action?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  }
  const { companyId, action } = body
  if (!companyId || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json({ error: 'companyId と action(approve|reject) は必須です' }, { status: 400 })
  }

  // 対象企業が本当に pending か確認
  const { data: company } = await admin
    .from('companies')
    .select('id, name, approval_status')
    .eq('id', companyId)
    .maybeSingle()
  if (!company || company.approval_status !== 'pending') {
    return NextResponse.json({ error: '対象の承認待ちブランドが見つかりません' }, { status: 404 })
  }

  // 登録者（通知用）と auth_id を取得
  const { data: members } = await admin
    .from('members')
    .select('auth_id, email, display_name')
    .eq('company_id', companyId)
  const owner = members?.[0]
  const resendApiKey = process.env.RESEND_API_KEY
  const resend = resendApiKey ? new Resend(resendApiKey) : null

  if (action === 'approve') {
    const { error: cErr } = await admin
      .from('companies')
      .update({ approval_status: 'active' })
      .eq('id', companyId)
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
    await admin
      .from('members')
      .update({ status: 'active', is_active: true })
      .eq('company_id', companyId)

    if (resend && owner?.email) {
      try {
        const { error: sendError } = await resend.emails.send({
          from: 'branding.bz <noreply@branding.bz>',
          to: owner.email,
          subject: `【branding.bz】アカウントが承認されました`,
          html: `
            <h2>アカウントが承認されました</h2>
            <p>${escapeHtml(owner.display_name || '')} 様</p>
            <p>「${escapeHtml(company.name)}」のご登録が承認されました。ログインしてご利用いただけます。</p>
            <p style="margin-top:24px;">
              <a href="https://branding.bz/admin/login" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:9999px;font-weight:bold;">ログインする</a>
            </p>
          `,
        })
        // Resend は送信失敗でも例外を投げず error を返すので、catch で記録されるよう投げ直す
        if (sendError) throw sendError
      } catch (e) {
        console.error('[SignupRequests] 承認通知メールエラー:', e)
      }
    }
    return NextResponse.json({ ok: true, action: 'approved' })
  }

  // reject: 先に却下通知 → その後 関連レコード＋auth user を削除
  if (resend && owner?.email) {
    try {
      const { error: sendError } = await resend.emails.send({
        from: 'branding.bz <noreply@branding.bz>',
        to: owner.email,
        subject: `【branding.bz】ご登録について`,
        html: `
          <h2>ご登録を承認できませんでした</h2>
          <p>${escapeHtml(owner.display_name || '')} 様</p>
          <p>このたびは branding.bz へご登録いただきありがとうございました。
          内容を確認した結果、今回はご登録を承認できませんでした。
          ご不明な点がございましたらお問い合わせください。</p>
        `,
      })
      // Resend は送信失敗でも例外を投げず error を返すので、catch で記録されるよう投げ直す
      if (sendError) throw sendError
    } catch (e) {
      console.error('[SignupRequests] 却下通知メールエラー:', e)
    }
  }

  // 削除（members → profiles → admin_users → companies → auth user）
  await admin.from('members').delete().eq('company_id', companyId)
  await admin.from('profiles').delete().eq('company_id', companyId)
  await admin.from('admin_users').delete().eq('company_id', companyId)
  await admin.from('companies').delete().eq('id', companyId)
  for (const m of members ?? []) {
    if (m.auth_id) {
      try {
        await admin.auth.admin.deleteUser(m.auth_id)
      } catch (e) {
        console.error('[SignupRequests] auth user 削除エラー:', e)
      }
    }
  }
  return NextResponse.json({ ok: true, action: 'rejected' })
}
