// セルフサービス登録API
// POST /api/signup
// サービスロールキーを使用してAuth user + 企業 + admin_users + profiles を一括作成
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { generateRandomSlug } from '@/lib/generate-slug'

export async function POST(request: NextRequest) {
  console.log('[Signup] ===== API呼び出し開始 =====')

  try {
    // ステップ0: サービスロールキーの確認
    console.log('[Signup] ステップ0: SUPABASE_SERVICE_ROLE_KEY確認中...')
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey || serviceRoleKey === 'ここにコピーしたキーを貼る') {
      console.error('[Signup] ステップ0失敗: SUPABASE_SERVICE_ROLE_KEY が未設定')
      return NextResponse.json(
        { error: 'サーバー設定エラー: サービスロールキーが設定されていません。' },
        { status: 500 }
      )
    }
    console.log('[Signup] ステップ0完了: SERVICE_ROLE_KEY設定済み')

    let supabaseAdmin
    try {
      supabaseAdmin = getSupabaseAdmin()
      console.log('[Signup] supabaseAdmin クライアント作成成功')
    } catch (initErr) {
      console.error('[Signup] supabaseAdmin 初期化エラー:', initErr)
      return NextResponse.json(
        { error: `サーバー初期化エラー: ${initErr instanceof Error ? initErr.message : String(initErr)}` },
        { status: 500 }
      )
    }

    // ステップ1: リクエストBody取得
    console.log('[Signup] ステップ1: リクエストBody解析中...')
    const body = await request.json()
    const {
      email,
      password,
      companyName,
      userName,
      position,
      department,
    } = body

    console.log('[Signup] ステップ1: email=', email, '企業名=', companyName, '氏名=', userName)

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
    console.log('[Signup] ステップ2: Auth user作成中... email=', email)
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

    console.log('[Signup] ステップ2完了: Auth user作成成功 id=', authData.user.id)

    // ステップ3: 企業レコード作成
    console.log('[Signup] ステップ3: 企業レコード作成中...')
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        name: companyName,
        slogan: '',
        mvv: '',
        brand_color_primary: '#1a1a1a',
        brand_color_secondary: '#666666',
        website_url: '',
      })
      .select()
      .single()

    if (companyError) {
      console.error('[Signup] ステップ3失敗: 企業作成エラー:', companyError.message)
      // ロールバック: Auth user削除
      console.log('[Signup] ロールバック: Auth user削除中...')
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: `企業作成エラー: ${companyError.message}` },
        { status: 400 }
      )
    }

    console.log('[Signup] ステップ3完了: 企業作成成功 id=', company.id)

    // ステップ3.5: email_domain を設定（ドメイン認証用）
    const domain = email.split('@')[1]?.toLowerCase()
    const FREE_DOMAINS = ['gmail.com','googlemail.com','yahoo.co.jp','yahoo.com','ymail.com','outlook.com','outlook.jp','hotmail.com','hotmail.co.jp','live.com','live.jp','msn.com','icloud.com','me.com','mac.com','aol.com','protonmail.com','proton.me','zoho.com','mail.com','gmx.com']
    if (domain && !FREE_DOMAINS.includes(domain)) {
      await supabaseAdmin
        .from('companies')
        .update({ email_domain: domain })
        .eq('id', company.id)
      console.log('[Signup] email_domain設定:', domain)
    }

    // ステップ4: admin_usersに紐づけ
    console.log('[Signup] ステップ4: admin_users紐づけ中...')
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
      console.log('[Signup] ロールバック: 企業 + Auth user削除中...')
      await supabaseAdmin.from('companies').delete().eq('id', company.id)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: `管理者紐づけエラー: ${adminInsertError.message}` },
        { status: 400 }
      )
    }

    console.log('[Signup] ステップ4完了: admin_users紐づけ成功')

    // ステップ5: profilesにプロフィール作成
    console.log('[Signup] ステップ5: プロフィール作成中...')
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
      console.log('[Signup] ロールバック: admin_user + 企業 + Auth user削除中...')
      await supabaseAdmin.from('admin_users').delete().eq('auth_id', authData.user.id)
      await supabaseAdmin.from('companies').delete().eq('id', company.id)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: `プロフィール作成エラー: ${profileError.message}` },
        { status: 400 }
      )
    }

    console.log('[Signup] ステップ5完了: プロフィール作成成功 slug=', slug)

    // ステップ6: membersに紐づけ（ポータルのアクセス権限はこのレコードで判定される）
    console.log('[Signup] ステップ6: members紐づけ中...')
    const { error: memberInsertError } = await supabaseAdmin
      .from('members')
      .insert({
        auth_id: authData.user.id,
        company_id: company.id,
        display_name: userName,
        email,
        profile_id: profile.id,
      })

    if (memberInsertError) {
      console.error('[Signup] ステップ6失敗: members紐づけエラー:', memberInsertError.message)
      // ロールバック: profiles + admin_user + 企業 + Auth user削除
      console.log('[Signup] ロールバック: profiles + admin_user + 企業 + Auth user削除中...')
      await supabaseAdmin.from('profiles').delete().eq('id', profile.id)
      await supabaseAdmin.from('admin_users').delete().eq('auth_id', authData.user.id)
      await supabaseAdmin.from('companies').delete().eq('id', company.id)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: `メンバー紐づけエラー: ${memberInsertError.message}` },
        { status: 400 }
      )
    }

    console.log('[Signup] ステップ6完了: members紐づけ成功')
    console.log('[Signup] ===== 全ステップ完了 ===== company_id=', company.id, 'auth_id=', authData.user.id)

    return NextResponse.json({
      success: true,
      company: {
        id: company.id,
        name: company.name,
      },
      admin: {
        email,
      },
    })
  } catch (err) {
    console.error('[Signup] 予期しないエラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
