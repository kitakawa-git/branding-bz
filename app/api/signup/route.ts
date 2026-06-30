// セルフサービス登録API
// POST /api/signup
// サービスロールキーを使用してAuth user + 企業 + admin_users + profiles を一括作成
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { generateRandomSlug } from '@/lib/generate-slug'

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
    // ステップ0: サービスロールキーの確認
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey || serviceRoleKey === 'ここにコピーしたキーを貼る') {
      console.error('[Signup] ステップ0失敗: SUPABASE_SERVICE_ROLE_KEY が未設定')
      return NextResponse.json(
        { error: 'サーバー設定エラー: サービスロールキーが設定されていません。' },
        { status: 500 }
      )
    }

    let supabaseAdmin
    try {
      supabaseAdmin = getSupabaseAdmin()
    } catch (initErr) {
      console.error('[Signup] supabaseAdmin 初期化エラー:', initErr)
      return NextResponse.json(
        { error: `サーバー初期化エラー: ${initErr instanceof Error ? initErr.message : String(initErr)}` },
        { status: 500 }
      )
    }

    // ステップ1: リクエストBody取得
    const body = await request.json()
    const {
      email,
      password,
      companyName,
      userName,
      position,
      department,
    } = body


    // バリデーション
    if (!email || !password || !companyName || !userName) {
      console.error('[Signup] ステップ1失敗: 必須項目不足')
      return NextResponse.json(
        { error: 'メールアドレス、パスワード、企業名、氏名は必須です' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'パスワードは6文字以上で入力してください' },
        { status: 400 }
      )
    }

    // ステップ2: Auth user作成
    const { data: authData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // メール確認をスキップ
    })

    if (createUserError) {
      console.error('[Signup] ステップ2失敗: Auth user作成エラー:', createUserError.message)
      // メール重複エラーのわかりやすいメッセージ
      const msg = createUserError.message.includes('already')
        ? 'このメールアドレスは既に登録されています'
        : `アカウント作成エラー: ${createUserError.message}`
      return NextResponse.json({ error: msg }, { status: 400 })
    }


    // 競合ドメイン照合（ID INC. の競合ブロックリスト）。
    // フリーメールはドメインで判定できないため competitor_flag=false のまま superadmin の人手判断に委ねる。
    const domain = email.split('@')[1]?.toLowerCase()
    let competitorFlag = false
    if (domain) {
      const { data: blocked } = await supabaseAdmin
        .from('blocked_competitor_domains')
        .select('id')
        .eq('domain', domain)
        .limit(1)
      competitorFlag = (blocked?.length ?? 0) > 0
    }

    // ステップ3: 企業レコード作成（新規owner登録は superadmin 全件承認制 → approval_status='pending'）
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        name: companyName,
        brand_color_primary: '#1a1a1a',
        brand_color_secondary: '#666666',
        website_url: '',
        approval_status: 'pending',
        competitor_flag: competitorFlag,
      })
      .select()
      .single()

    if (companyError) {
      console.error('[Signup] ステップ3失敗: 企業作成エラー:', companyError.message)
      // ロールバック: Auth user削除
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: `企業作成エラー: ${companyError.message}` },
        { status: 400 }
      )
    }


    // ステップ3.5: email_domain を設定（ドメイン認証用）
    const FREE_DOMAINS = ['gmail.com','googlemail.com','yahoo.co.jp','yahoo.com','ymail.com','outlook.com','outlook.jp','hotmail.com','hotmail.co.jp','live.com','live.jp','msn.com','icloud.com','me.com','mac.com','aol.com','protonmail.com','proton.me','zoho.com','mail.com','gmx.com']
    if (domain && !FREE_DOMAINS.includes(domain)) {
      await supabaseAdmin
        .from('companies')
        .update({ email_domain: domain })
        .eq('id', company.id)
    }

    // ステップ4: admin_usersに紐づけ
    const { error: adminInsertError } = await supabaseAdmin
      .from('admin_users')
      .insert({
        auth_id: authData.user.id,
        company_id: company.id,
        role: 'owner',
      })

    if (adminInsertError) {
      console.error('[Signup] ステップ4失敗: admin_users紐づけエラー:', adminInsertError.message)
      // ロールバック: 企業 + Auth user削除
      await supabaseAdmin.from('companies').delete().eq('id', company.id)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: `管理者紐づけエラー: ${adminInsertError.message}` },
        { status: 400 }
      )
    }


    // ステップ5: profilesにプロフィール作成
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
      console.error('[Signup] ステップ5失敗: プロフィール作成エラー:', profileError.message)
      // ロールバック: admin_user + 企業 + Auth user削除
      await supabaseAdmin.from('admin_users').delete().eq('auth_id', authData.user.id)
      await supabaseAdmin.from('companies').delete().eq('id', company.id)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: `プロフィール作成エラー: ${profileError.message}` },
        { status: 400 }
      )
    }


    // ステップ6: membersに紐づけ（ポータルのアクセス権限はこのレコードで判定される）
    // 承認制のため pending・非アクティブで作成（superadmin 承認で有効化）。
    // 行は作る＝oauth-gate が承認待ちownerを孤児と誤判定して削除しない（設計パターンA）。
    const { error: memberInsertError } = await supabaseAdmin
      .from('members')
      .insert({
        auth_id: authData.user.id,
        company_id: company.id,
        display_name: userName,
        email,
        profile_id: profile.id,
        status: 'pending',
        is_active: false,
      })

    if (memberInsertError) {
      console.error('[Signup] ステップ6失敗: members紐づけエラー:', memberInsertError.message)
      // ロールバック: profiles + admin_user + 企業 + Auth user削除
      await supabaseAdmin.from('profiles').delete().eq('id', profile.id)
      await supabaseAdmin.from('admin_users').delete().eq('auth_id', authData.user.id)
      await supabaseAdmin.from('companies').delete().eq('id', company.id)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: `メンバー紐づけエラー: ${memberInsertError.message}` },
        { status: 400 }
      )
    }


    // superadmin へ承認依頼メール（失敗しても登録は成功扱い）。競合ドメイン一致は警告。
    const resendApiKey = process.env.RESEND_API_KEY
    const devEmail = process.env.SIGNUP_NOTIFICATION_EMAIL || process.env.CONTACT_NOTIFICATION_EMAIL
    if (resendApiKey && devEmail) {
      try {
        const resend = new Resend(resendApiKey)
        const warn = competitorFlag
          ? `<p style="margin:0 0 12px;padding:10px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#b91c1c;font-weight:bold;">⚠ 競合ドメイン一致（${escapeHtml(domain || '')}）。登録目的を確認のうえ承認してください。</p>`
          : ''
        await resend.emails.send({
          from: 'branding.bz <noreply@branding.bz>',
          to: devEmail,
          subject: `【branding.bz】${competitorFlag ? '⚠競合の疑い ' : ''}新規企業の承認待ち: ${escapeHtml(companyName)}`,
          html: `
            <h2>新規企業オーナー登録が承認待ちです</h2>
            ${warn}
            <p>承認するまで、このアカウントはログインできません。</p>
            <table style="border-collapse:collapse;">
              <tr><td style="padding:8px;font-weight:bold;">企業名</td><td style="padding:8px;">${escapeHtml(companyName)}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;">氏名</td><td style="padding:8px;">${escapeHtml(userName)}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;">メール</td><td style="padding:8px;">${escapeHtml(email)}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;">役職</td><td style="padding:8px;">${escapeHtml(position || '未入力')}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;">部署</td><td style="padding:8px;">${escapeHtml(department || '未入力')}</td></tr>
            </table>
            <p style="margin-top:24px;">
              <a href="https://branding.bz/superadmin/signup-requests" style="display:inline-block;padding:10px 20px;background:#1e3a5f;color:#fff;text-decoration:none;border-radius:9999px;font-weight:bold;">承認画面を開く</a>
            </p>
            <p style="color:#666;font-size:12px;margin-top:16px;">https://branding.bz/superadmin/signup-requests</p>
          `,
        })
      } catch (emailError) {
        console.error('[Signup] 承認依頼メール送信エラー:', emailError)
      }
    }

    return NextResponse.json({
      success: true,
      status: 'pending',
      company: {
        id: company.id,
        name: company.name,
      },
      admin: {
        email,
      },
      message: 'ご登録ありがとうございます。ID INC. が内容を確認し、承認されるとログインできるようになります。承認結果はメールでお知らせします。',
    })
  } catch (err) {
    console.error('[Signup] 予期しないエラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
