// セッション作成API
// POST /api/tools/colors/sessions
// 新規ユーザー作成 or 既存ユーザーのセッション作成
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  console.log('[ColorSessions] ===== API呼び出し開始 =====')

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { userId, email, password, isNewUser } = body

    let authId = userId

    // 新規ユーザー作成フロー
    if (isNewUser && email && password) {
      console.log('[ColorSessions] ステップ1: 新規ユーザー作成中... email=', email)

      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

      if (createError) {
        console.error('[ColorSessions] ステップ1失敗:', createError.message)
        const msg = createError.message.includes('already')
          ? 'このメールアドレスは既に登録されています。ログインをお試しください。'
          : `アカウント作成エラー: ${createError.message}`
        return NextResponse.json({ error: msg }, { status: 400 })
      }

      authId = authData.user.id
      console.log('[ColorSessions] ステップ1完了: Auth user作成成功 id=', authId)
    }

    if (!authId) {
      return NextResponse.json({ error: 'userId が必要です' }, { status: 400 })
    }

    // 進行中のセッションがあればそれを返す
    console.log('[ColorSessions] ステップ2: 既存セッション検索中...')
    const { data: existingSession } = await supabaseAdmin
      .from('mini_app_sessions')
      .select('id, current_step, status')
      .eq('user_id', authId)
      .eq('app_type', 'brand_colors')
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingSession) {
      console.log('[ColorSessions] ステップ2: 既存セッション発見 id=', existingSession.id)
      return NextResponse.json({
        sessionId: existingSession.id,
        currentStep: existingSession.current_step,
        isExisting: true,
      })
    }

    // 既存のbranding.bzアカウントか確認（company_id取得）
    let companyId: string | null = null
    const { data: adminUser } = await supabaseAdmin
      .from('admin_users')
      .select('company_id')
      .eq('auth_id', authId)
      .maybeSingle()

    if (adminUser) {
      companyId = adminUser.company_id
      console.log('[ColorSessions] branding.bz本体アカウント検出: company_id=', companyId)
    }

    // 新規セッション作成
    console.log('[ColorSessions] ステップ3: 新規セッション作成中...')
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('mini_app_sessions')
      .insert({
        user_id: authId,
        app_type: 'brand_colors',
        status: 'in_progress',
        current_step: 1,
        company_id: companyId,
      })
      .select('id')
      .single()

    if (sessionError) {
      console.error('[ColorSessions] ステップ3失敗:', sessionError.message)
      return NextResponse.json(
        { error: `セッション作成エラー: ${sessionError.message}` },
        { status: 500 }
      )
    }

    console.log('[ColorSessions] ステップ3完了: セッション作成成功 id=', session.id)

    // プロジェクト作成
    console.log('[ColorSessions] ステップ4: プロジェクト作成中...')
    const { error: projectError } = await supabaseAdmin
      .from('brand_color_projects')
      .insert({
        session_id: session.id,
      })

    if (projectError) {
      console.error('[ColorSessions] ステップ4失敗:', projectError.message)
      // ロールバック: セッション削除
      await supabaseAdmin.from('mini_app_sessions').delete().eq('id', session.id)
      return NextResponse.json(
        { error: `プロジェクト作成エラー: ${projectError.message}` },
        { status: 500 }
      )
    }

    console.log('[ColorSessions] ===== 全ステップ完了 ===== sessionId=', session.id)

    return NextResponse.json({
      sessionId: session.id,
      currentStep: 1,
      isExisting: false,
    }, { status: 201 })
  } catch (err) {
    console.error('[ColorSessions] 予期しないエラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
