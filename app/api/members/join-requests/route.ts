// 参加リクエスト管理API
// GET  /api/members/join-requests — pendingメンバー一覧取得
// POST /api/members/join-requests — 承認 or 拒否
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { supabase } from '@/lib/supabase'
import { checkMemberCapacity, memberLimitResponse } from '@/lib/billing/guard'
import { addToActiveSurveys } from '@/lib/brand-score/survey-participants'

// HTMLエスケープ（XSS対策）
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// 管理者の company_id を取得
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

// GET: pending状態のメンバー一覧
export async function GET(request: NextRequest) {
  try {
    const companyId = await getAdminCompanyId(request)
    if (!companyId) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: pendingMembers, error } = await supabaseAdmin
      .from('members')
      .select('id, auth_id, display_name, email, created_at, profile_id')
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[JoinRequests] 取得エラー:', error.message)
      return NextResponse.json({ error: 'データ取得に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ requests: pendingMembers || [] })
  } catch (err) {
    console.error('[JoinRequests] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}

// POST: 承認 or 拒否
export async function POST(request: NextRequest) {
  try {
    const companyId = await getAdminCompanyId(request)
    if (!companyId) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const { memberId, action } = await request.json()

    if (!memberId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'memberId と action (approve/reject) が必要です' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // 対象メンバーの確認（同じ企業かつpending状態）
    const { data: member, error: memberError } = await supabaseAdmin
      .from('members')
      .select('id, auth_id, profile_id, display_name, email')
      .eq('id', memberId)
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .single()

    if (memberError || !member) {
      return NextResponse.json({ error: '対象のリクエストが見つかりません' }, { status: 404 })
    }

    if (action === 'approve') {
      // 参加申請中は席を使っていない。承認するとここで1席増えるので上限を見る
      const capacity = await checkMemberCapacity(companyId)
      if (!capacity.ok) return memberLimitResponse(capacity)

      // 承認: status → active, is_active → true
      const { error: updateError } = await supabaseAdmin
        .from('members')
        .update({ status: 'active', is_active: true })
        .eq('id', memberId)

      if (updateError) {
        return NextResponse.json({ error: `承認に失敗しました: ${updateError.message}` }, { status: 500 })
      }


      // 承認でここから席を使い始めるので、配信中のサーベイの参加者にも足す。
      // 申請中（pending）のうちは対象にしない＝まだ社員として数えていないため
      if (member.profile_id) {
        await addToActiveSurveys(companyId, [member.profile_id as string])
      }

      // 申請者本人へ承認完了メール通知（失敗しても承認自体は成功扱い）
      const resendApiKey = process.env.RESEND_API_KEY
      if (resendApiKey && member.email) {
        try {
          const { data: company } = await supabaseAdmin
            .from('companies')
            .select('name')
            .eq('id', companyId)
            .single()

          const companyName = company?.name || ''
          const loginUrl = 'https://branding.bz/portal/auth'
          const resend = new Resend(resendApiKey)
          await resend.emails.send({
            from: 'branding.bz <noreply@branding.bz>',
            to: member.email,
            subject: `【branding.bz】${companyName} への参加が承認されました`,
            html: `
              <h2>参加リクエストが承認されました</h2>
              <p>${escapeHtml(member.display_name || '')} 様</p>
              <p>${escapeHtml(companyName)} への参加リクエストが承認されました。<br/>下のボタンからログインして、branding.bz をご利用ください。</p>
              <p style="margin-top:24px;">
                <a href="${loginUrl}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:9999px;font-weight:bold;">ログインする</a>
              </p>
              <p style="color:#666;font-size:12px;margin-top:16px;">${loginUrl}</p>
              <hr style="margin-top:32px;border:none;border-top:1px solid #eee;" />
              <p style="color:#999;font-size:12px;">このメールは branding.bz の参加リクエスト承認時に自動送信されています。</p>
            `,
          })
        } catch (emailError) {
          console.error('[JoinRequests] 承認通知メール送信エラー:', emailError)
        }
      }

      return NextResponse.json({
        success: true,
        action: 'approved',
        member: { id: member.id, name: member.display_name, email: member.email },
      })
    } else {
      // 拒否: メンバー・プロフィール・Auth userを削除
      await supabaseAdmin.from('members').delete().eq('id', memberId)
      if (member.profile_id) {
        await supabaseAdmin.from('profiles').delete().eq('id', member.profile_id)
      }
      if (member.auth_id) {
        await supabaseAdmin.auth.admin.deleteUser(member.auth_id)
      }

      return NextResponse.json({
        success: true,
        action: 'rejected',
        member: { id: member.id, name: member.display_name, email: member.email },
      })
    }
  } catch (err) {
    console.error('[JoinRequests] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
