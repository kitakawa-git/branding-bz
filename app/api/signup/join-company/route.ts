// 既存企業への参加リクエスト付き登録
// POST /api/signup/join-company
// Auth user + profiles + members(status='pending') を作成
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { generateRandomSlug } from '@/lib/generate-slug'
import { isFreeEmailDomain, FREE_EMAIL_REJECTION_MESSAGE } from '@/lib/constants/free-email-domains'

// HTMLエスケープ（XSS対策）
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function POST(request: NextRequest) {

  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey || serviceRoleKey === 'ここにコピーしたキーを貼る') {
      return NextResponse.json(
        { error: 'サーバー設定エラー: サービスロールキーが設定されていません。' },
        { status: 500 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { email, password, companyId, userName, position, department } = body

    if (!email || !password || !companyId || !userName) {
      return NextResponse.json(
        { error: 'メールアドレス、パスワード、企業ID、氏名は必須です' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'パスワードは6文字以上で入力してください' },
        { status: 400 }
      )
    }

    // フリーメール（Gmail等の非企業ドメイン）は登録拒否。会社のメールアドレスのみ受け入れる。
    if (isFreeEmailDomain(email)) {
      return NextResponse.json(
        { error: FREE_EMAIL_REJECTION_MESSAGE },
        { status: 400 }
      )
    }

    // 企業の存在確認
    const { data: company, error: companyCheckError } = await supabaseAdmin
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .single()

    if (companyCheckError || !company) {
      return NextResponse.json({ error: '指定された企業が見つかりません' }, { status: 400 })
    }


    // ステップ1: Auth user作成
    const { data: authData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createUserError) {
      const msg = createUserError.message.includes('already')
        ? 'このメールアドレスは既に登録されています'
        : `アカウント作成エラー: ${createUserError.message}`
      return NextResponse.json({ error: msg }, { status: 400 })
    }


    // ステップ2: profiles作成
    const slug = generateRandomSlug()
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        name: userName,
        position: position || '',
        department: department || '',
        slug,
        email,
        company_id: company.id,
        bio: '',
        phone: '',
        photo_url: '',
      })
      .select('id')
      .single()

    if (profileError) {
      console.error('[SignupJoin] プロフィール作成エラー:', profileError.message)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: `プロフィール作成エラー: ${profileError.message}` },
        { status: 400 }
      )
    }


    // ステップ3: members作成（status='pending' で承認待ち）
    const { error: memberError } = await supabaseAdmin
      .from('members')
      .insert({
        auth_id: authData.user.id,
        company_id: company.id,
        profile_id: profile.id,
        display_name: userName,
        email,
        status: 'pending',
        is_active: false,
      })

    if (memberError) {
      console.error('[SignupJoin] メンバー作成エラー:', memberError.message)
      await supabaseAdmin.from('profiles').delete().eq('id', profile.id)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: `メンバー登録エラー: ${memberError.message}` },
        { status: 400 }
      )
    }


    // 管理者へメール通知（失敗してもリクエスト作成は成功扱い）
    const resendApiKey = process.env.RESEND_API_KEY
    if (resendApiKey) {
      try {
        const { data: admins } = await supabaseAdmin
          .from('admin_users')
          .select('auth_id')
          .eq('company_id', company.id)

        const adminEmails: string[] = []
        for (const admin of admins || []) {
          if (!admin.auth_id) continue
          const { data: adminUser } = await supabaseAdmin.auth.admin.getUserById(admin.auth_id)
          if (adminUser?.user?.email) {
            adminEmails.push(adminUser.user.email)
          }
        }

        if (adminEmails.length > 0) {
          const resend = new Resend(resendApiKey)
          const approvalUrl = 'https://branding.bz/admin/members'
          await resend.emails.send({
            from: 'branding.bz <noreply@branding.bz>',
            to: adminEmails,
            subject: `【branding.bz】${company.name} への参加リクエストが届きました`,
            html: `
              <h2>新しい参加リクエストが届きました</h2>
              <p>${escapeHtml(company.name)} への参加リクエストが届きました。</p>
              <table style="border-collapse:collapse;">
                <tr><td style="padding:8px;font-weight:bold;">氏名</td><td style="padding:8px;">${escapeHtml(userName)}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;">メール</td><td style="padding:8px;">${escapeHtml(email)}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;">部署</td><td style="padding:8px;">${escapeHtml(department || '未入力')}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;">役職</td><td style="padding:8px;">${escapeHtml(position || '未入力')}</td></tr>
              </table>
              <p style="margin-top:24px;">
                <a href="${approvalUrl}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:9999px;font-weight:bold;">管理画面で承認する</a>
              </p>
              <p style="color:#666;font-size:12px;margin-top:16px;">${approvalUrl}</p>
            `,
          })
        } else {
          console.warn('[SignupJoin] 通知先の管理者メールが見つかりませんでした')
        }
      } catch (emailError) {
        console.error('[SignupJoin] 通知メール送信エラー:', emailError)
      }
    }

    return NextResponse.json({
      success: true,
      status: 'pending',
      company: { id: company.id, name: company.name },
      message: `${company.name} への参加リクエストを送信しました。管理者の承認をお待ちください。`,
    })
  } catch (err) {
    console.error('[SignupJoin] 予期しないエラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
