// ブランドパーソナリティ診断 セッション作成API
// POST /api/tools/personality/sessions
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { MONTHLY_FREE_LIMIT, MONTHLY_LIMIT_REACHED_MESSAGE, getCurrentMonthStartUtcIso } from '@/lib/tools/free-limits'
import { can } from '@/lib/billing/entitlements'
import { fetchCompanyPlan, usageLimitResponse } from '@/lib/billing/guard'

// パーソナリティ診断セッションのデフォルトデータ
const DEFAULT_SESSION_DATA = {
  current_step: 1,
  basic_info: {},
  framework: '', // 'aaker' | 'archetype'（Step 1 で選択）
  answers: {},
  diagnosis: {},
  completed: false,
}

// フリーミアム制限は lib/tools/free-limits.ts に集約（4ツール共通・月次リセット）

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { userId, email, password, isNewUser, forceNew } = body

    let authId = userId

    // 新規ユーザー作成フロー
    if (isNewUser && email && password) {
      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

      if (createError) {
        console.error('[PersonalitySessions] ユーザー作成失敗:', createError.message)
        const msg = createError.message.includes('already')
          ? 'このメールアドレスは既に登録されています。ログインをお試しください。'
          : `アカウント作成エラー: ${createError.message}`
        return NextResponse.json({ error: msg }, { status: 400 })
      }

      authId = authData.user.id
    }

    if (!authId) {
      return NextResponse.json({ error: 'userId が必要です' }, { status: 400 })
    }

    // 会社の実効プランで月次上限を飛ばすか決めるので、上限チェックより先に company_id を引く
    let companyId: string | null = null
    const { data: adminUserForPlan } = await supabaseAdmin
      .from('admin_users')
      .select('company_id')
      .eq('auth_id', authId)
      .maybeSingle()
    if (adminUserForPlan) companyId = adminUserForPlan.company_id

    // フリーミアム制限チェック: 当月(JST)の完了セッション数（1-1=B / 1-2=JST / 1-3=完了月）。
    // standard 以上（buildToolsUnlimited）は上限なしなので数えない。
    // 未ログイン・会社なしは free 相当として従来どおり上限をかける。
    const unlimited = can(await fetchCompanyPlan(companyId), 'buildToolsUnlimited')
    const monthStart = getCurrentMonthStartUtcIso()
    const { count: completedCount } = unlimited ? { count: null } : await supabaseAdmin
      .from('mini_app_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', authId)
      .eq('app_type', 'personality')
      .eq('status', 'completed')
      .gte('updated_at', monthStart)

    if (completedCount !== null && completedCount >= MONTHLY_FREE_LIMIT) {
      // 進行中のセッションがあればそれを返す（forceNew時は新規作成不可＝403）
      const { data: inProgressSession } = forceNew ? { data: null } : await supabaseAdmin
        .from('mini_app_sessions')
        .select('id, current_step, session_data')
        .eq('user_id', authId)
        .eq('app_type', 'personality')
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

      return usageLimitResponse(MONTHLY_LIMIT_REACHED_MESSAGE)
    }

    // 進行中のセッションがあればそれを返す（forceNew時はスキップして常に新規作成）
    const { data: existingSession } = forceNew ? { data: null } : await supabaseAdmin
      .from('mini_app_sessions')
      .select('id, current_step, session_data')
      .eq('user_id', authId)
      .eq('app_type', 'personality')
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingSession) {
      return NextResponse.json({
        sessionId: existingSession.id,
        currentStep: existingSession.current_step,
        sessionData: existingSession.session_data,
        isExisting: true,
      })
    }

    // 新規セッション作成
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('mini_app_sessions')
      .insert({
        user_id: authId,
        app_type: 'personality',
        status: 'in_progress',
        current_step: 1,
        company_id: companyId,
        session_data: DEFAULT_SESSION_DATA,
      })
      .select('id')
      .single()

    if (sessionError) {
      console.error('[PersonalitySessions] セッション作成失敗:', sessionError.message)
      return NextResponse.json(
        { error: `セッション作成エラー: ${sessionError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      sessionId: session.id,
      currentStep: 1,
      sessionData: DEFAULT_SESSION_DATA,
      isExisting: false,
    }, { status: 201 })
  } catch (err) {
    console.error('[PersonalitySessions] 予期しないエラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
