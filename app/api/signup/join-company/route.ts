// 既存企業への参加リクエスト付き登録
// POST /api/signup/join-company
// Auth user + profiles + members(status='pending') を作成
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { generateRandomSlug } from '@/lib/generate-slug'

export async function POST(request: NextRequest) {
  console.log('[SignupJoin] ===== 既存企業参加登録 開始 =====')

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

    // 企業の存在確認
    const { data: company, error: companyCheckError } = await supabaseAdmin
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .single()

    if (companyCheckError || !company) {
      return NextResponse.json({ error: '指定された企業が見つかりません' }, { status: 400 })
    }

    console.log('[SignupJoin] 参加先企業:', company.name, company.id)

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

    console.log('[SignupJoin] Auth user作成完了:', authData.user.id)

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

    console.log('[SignupJoin] プロフィール作成完了:', profile.id)

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

    console.log('[SignupJoin] ===== 参加リクエスト作成完了 =====')

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
