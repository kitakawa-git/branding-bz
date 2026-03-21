// ペルソナビルダー セッション作成API
// POST /api/tools/persona/sessions
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// ペルソナセッションのデフォルトデータ
const DEFAULT_SESSION_DATA = {
  current_step: 1,
  basic_info: {},
  target_info: {},
  demographics: {},
  goals: {},
  journey_map: {},
  completed: false,
}

// フリーミアム制限: 完了済みセッション数
const FREE_LIMIT = 3

export async function POST(request: NextRequest) {
  console.log('[PersonaSessions] ===== API呼び出し開始 =====')

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { userId, email, password, isNewUser } = body

    let authId = userId

    // 新規ユーザー作成フロー
    if (isNewUser && email && password) {
      console.log('[PersonaSessions] ステップ1: 新規ユーザー作成中... email=', email)

      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

      if (createError) {
        console.error('[PersonaSessions] ステップ1失敗:', createError.message)
        const msg = createError.message.includes('already')
          ? 'このメールアドレスは既に登録されています。ログインをお試しください。'
          : `アカウント作成エラー: ${createError.message}`
        return NextResponse.json({ error: msg }, { status: 400 })
      }

      authId = authData.user.id
      console.log('[PersonaSessions] ステップ1完了: Auth user作成成功 id=', authId)
    }

    if (!authId) {
      return NextResponse.json({ error: 'userId が必要です' }, { status: 400 })
    }

    // フリーミアム制限チェック: 完了済みセッション数
    const { count: completedCount } = await supabaseAdmin
      .from('mini_app_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', authId)
      .eq('app_type', 'persona')
      .eq('status', 'completed')

    if (completedCount !== null && completedCount >= FREE_LIMIT) {
      // 進行中のセッションがあればそれを返す
      const { data: inProgressSession } = await supabaseAdmin
        .from('mini_app_sessions')
        .select('id, current_step, session_data')
        .eq('user_id', authId)
        .eq('app_type', 'persona')
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (inProgressSession) {
        return NextResponse.json({
          sessionId: inProgressSession.id,
          currentStep: inProgressSession.current_step,
          sessionData: inProgressSession.session_data,
          isExisting: true,
        })
      }

      return NextResponse.json(
        { error: `無料プランの上限（${FREE_LIMIT}回）に達しました。有料プランへのアップグレードをご検討ください。` },
        { status: 403 }
      )
    }

    // 進行中のセッションがあればそれを返す
    console.log('[PersonaSessions] ステップ2: 既存セッション検索中...')
    const { data: existingSession } = await supabaseAdmin
      .from('mini_app_sessions')
      .select('id, current_step, session_data')
      .eq('user_id', authId)
      .eq('app_type', 'persona')
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingSession) {
      console.log('[PersonaSessions] ステップ2: 既存セッション発見 id=', existingSession.id)
      return NextResponse.json({
        sessionId: existingSession.id,
        currentStep: existingSession.current_step,
        sessionData: existingSession.session_data,
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
      console.log('[PersonaSessions] branding.bz本体アカウント検出: company_id=', companyId)
    }

    // 新規セッション作成
    console.log('[PersonaSessions] ステップ3: 新規セッション作成中...')
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('mini_app_sessions')
      .insert({
        user_id: authId,
        app_type: 'persona',
        status: 'in_progress',
        current_step: 1,
        company_id: companyId,
        session_data: DEFAULT_SESSION_DATA,
      })
      .select('id')
      .single()

    if (sessionError) {
      console.error('[PersonaSessions] ステップ3失敗:', sessionError.message)
      return NextResponse.json(
        { error: `セッション作成エラー: ${sessionError.message}` },
        { status: 500 }
      )
    }

    console.log('[PersonaSessions] ===== 全ステップ完了 ===== sessionId=', session.id)

    return NextResponse.json({
      sessionId: session.id,
      currentStep: 1,
      sessionData: DEFAULT_SESSION_DATA,
      isExisting: false,
    }, { status: 201 })
  } catch (err) {
    console.error('[PersonaSessions] 予期しないエラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
