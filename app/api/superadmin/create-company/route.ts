// 企業+管理者アカウント同時作成API
// POST /api/superadmin/create-company
// サービスロールキーを使用してAuth userを作成するため、サーバーサイドで実行
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { generateRandomSlug } from '@/lib/generate-slug'

export async function POST(request: NextRequest) {

  try {
    // ステップ0: サービスロールキーの確認
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey || serviceRoleKey === 'ここにコピーしたキーを貼る') {
      console.error('[CreateCompany] ステップ0失敗: SUPABASE_SERVICE_ROLE_KEY が未設定またはプレースホルダーのままです')
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY が .env.local に正しく設定されていません。Supabase ダッシュボード → Settings → API → service_role からキーをコピーして .env.local に設定してください。' },
        { status: 500 }
      )
    }

    let supabaseAdmin
    try {
      supabaseAdmin = getSupabaseAdmin()
    } catch (initErr) {
      console.error('[CreateCompany] supabaseAdmin 初期化エラー:', initErr)
      return NextResponse.json(
        { error: `Supabase管理クライアント初期化エラー: ${initErr instanceof Error ? initErr.message : String(initErr)}` },
        { status: 500 }
      )
    }

    // ステップ1: リクエストユーザーがスーパー管理者か確認
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[CreateCompany] ステップ1失敗: Authorizationヘッダーなし')
      return NextResponse.json({ error: '認証が必要です。再ログインしてください。' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // ユーザーのトークンでSupabaseクライアントを作成して認証確認
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      console.error('[CreateCompany] ステップ1失敗: 認証エラー:', authError?.message || 'ユーザーなし')
      return NextResponse.json({ error: `認証エラー: ${authError?.message || 'セッションが無効です。再ログインしてください。'}` }, { status: 401 })
    }

    // ステップ2: admin_usersからis_superadmin確認
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('auth_id', user.id)
      .single()


    if (adminError || !adminUser) {
      console.error('[CreateCompany] ステップ2失敗: admin_users取得エラー:', adminError?.message || '該当レコードなし')
      return NextResponse.json(
        { error: `管理者情報取得エラー: ${adminError?.message || 'admin_usersにレコードがありません'}` },
        { status: 403 }
      )
    }

    if (!adminUser.is_superadmin) {
      console.error('[CreateCompany] ステップ2失敗: スーパー管理者ではありません (is_superadmin=', adminUser.is_superadmin, ')')
      return NextResponse.json({ error: 'スーパー管理者権限が必要です。is_superadmin=true であることを確認してください。' }, { status: 403 })
    }

    // ステップ3: リクエストBody取得
    const body = await request.json()
    // ブランド情報（スローガン/MVV/カラー）は作成時には受け取らない。
    // 表示に使われるのは brand_guidelines / brand_visuals 側のため、
    // 作成後に管理画面「ブランド方針」「ビジュアル」で入力してもらう運用とする。
    const {
      companyName,
      websiteUrl,
      adminEmail,
      adminPassword,
    } = body


    if (!companyName || !adminEmail || !adminPassword) {
      console.error('[CreateCompany] ステップ3失敗: 必須項目不足', { companyName: !!companyName, adminEmail: !!adminEmail, adminPassword: !!adminPassword })
      return NextResponse.json(
        { error: 'ブランド名、管理者メールアドレス、パスワードは必須です' },
        { status: 400 }
      )
    }

    // ステップ4: Auth userを作成
    const { data: authData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true, // メール確認をスキップ
    })

    if (createUserError) {
      console.error('[CreateCompany] ステップ4失敗: Auth user作成エラー:', createUserError.message)
      return NextResponse.json(
        { error: `アカウント作成エラー: ${createUserError.message}` },
        { status: 400 }
      )
    }


    // ステップ5: 企業レコードを作成
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        name: companyName,
        // ブランド情報は作成時に入力しない（slogan/mvv は brand_guidelines へ一本化し companies からは廃止）
        brand_color_primary: '#1a1a1a',
        brand_color_secondary: '#666666',
        website_url: websiteUrl || '',
        // companies.approval_status の既定は 'pending'（セルフ登録は superadmin 承認制）。
        // ここは superadmin 自身が作る経路なので承認済みで作る。
        // 既定値に任せると、作った直後に自分で承認する二度手間になる
        approval_status: 'active',
      })
      .select()
      .single()

    if (companyError) {
      console.error('[CreateCompany] ステップ5失敗: 企業作成エラー:', companyError.message)
      // Auth userを削除（ロールバック）
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: `ブランド作成エラー: ${companyError.message}` },
        { status: 400 }
      )
    }


    // ステップ6: admin_usersに紐づけ
    const { error: adminInsertError } = await supabaseAdmin
      .from('admin_users')
      .insert({
        auth_id: authData.user.id,
        company_id: company.id,
        role: 'owner',
      })

    if (adminInsertError) {
      console.error('[CreateCompany] ステップ6失敗: admin_users紐づけエラー:', adminInsertError.message)
      // ロールバック
      await supabaseAdmin.from('companies').delete().eq('id', company.id)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: `管理者紐づけエラー: ${adminInsertError.message}` },
        { status: 400 }
      )
    }


    // 管理者の表示名はメールアドレスのローカル部から仮生成（ログイン後にポータルで変更可能）
    const ownerName = adminEmail.split('@')[0] || '管理者'

    // ステップ7: profiles にプロフィール作成（名刺用）
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        company_id: company.id,
        name: ownerName,
        email: adminEmail,
        slug: generateRandomSlug(),
        card_enabled: true,
      })
      .select('id')
      .single()

    if (profileError) {
      console.error('[CreateCompany] ステップ7失敗: プロフィール作成エラー:', profileError.message)
      // ロールバック: admin_users + 企業 + Auth user削除
      await supabaseAdmin.from('admin_users').delete().eq('auth_id', authData.user.id)
      await supabaseAdmin.from('companies').delete().eq('id', company.id)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: `プロフィール作成エラー: ${profileError.message}` },
        { status: 400 }
      )
    }


    // ステップ8: members に紐づけ（ポータルのアクセス権限はこのレコードで判定される）
    const { error: memberInsertError } = await supabaseAdmin
      .from('members')
      .insert({
        auth_id: authData.user.id,
        company_id: company.id,
        display_name: ownerName,
        email: adminEmail,
        profile_id: profile.id,
      })

    if (memberInsertError) {
      console.error('[CreateCompany] ステップ8失敗: members紐づけエラー:', memberInsertError.message)
      // ロールバック: profiles + admin_users + 企業 + Auth user削除
      await supabaseAdmin.from('profiles').delete().eq('id', profile.id)
      await supabaseAdmin.from('admin_users').delete().eq('auth_id', authData.user.id)
      await supabaseAdmin.from('companies').delete().eq('id', company.id)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: `メンバー紐づけエラー: ${memberInsertError.message}` },
        { status: 400 }
      )
    }


    return NextResponse.json({
      success: true,
      company: {
        id: company.id,
        name: company.name,
      },
      admin: {
        email: adminEmail,
      },
    })
  } catch (err) {
    console.error('[CreateCompany] 予期しないエラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
