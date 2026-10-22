// STP分析ツール セッション作成API
// POST /api/tools/stp/sessions
// ログイン中のユーザーのセッション作成（進行中があればそれを返す）
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireSelf } from '@/lib/auth/caller'
import { MONTHLY_FREE_LIMIT, MONTHLY_LIMIT_REACHED_MESSAGE, countCompletedThisMonth } from '@/lib/tools/free-limits'
import { can } from '@/lib/billing/entitlements'
import { fetchCompanyPlan, usageLimitResponse } from '@/lib/billing/guard'

// STPセッションのデフォルトデータ
const DEFAULT_SESSION_DATA = {
  current_step: 1,
  basic_info: {
    company_name: '',
    industry_category: '',
    industry_subcategory: '',
    business_descriptions: [] as Array<{ title: string; description: string }>,
    target_segments: [] as Array<{ name: string; description: string }>,
    competitors: [] as Array<{ name: string; url: string }>,
  },
  segmentation: {
    mode: 'ai',
    variables: [],
  },
  targeting: {
    evaluations: [],
    main_target: '',
    sub_targets: [],
    target_description: '',
  },
  positioning: {
    x_axis: { left: '', right: '' },
    y_axis: { bottom: '', top: '' },
    items: [],
  },
  completed: false,
}

// フリーミアム制限は lib/tools/free-limits.ts に集約（4ツール共通・月次リセット）

// GET /api/tools/stp/sessions?userId= — ユーザーのSTPセッション一覧（履歴選択UI用）
export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const self = await requireSelf(request, request.nextUrl.searchParams.get('userId'))
    if (self.error) return self.error
    const userId = self.authId
    const { data, error } = await supabaseAdmin
      .from('mini_app_sessions')
      .select('id, status, current_step, session_data, created_at, updated_at')
      .eq('user_id', userId)
      .eq('app_type', 'stp')
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(50)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const sessions = (data || []).map((s) => {
      const sd = (s.session_data || {}) as {
        basic_info?: { company_name?: string }
        targeting?: { main_target?: string }
      }
      return {
        id: s.id,
        status: s.status,
        current_step: s.current_step,
        company_name: sd.basic_info?.company_name || '',
        main_target: sd.targeting?.main_target || '',
        created_at: s.created_at,
        updated_at: s.updated_at,
      }
    })
    return NextResponse.json({ sessions })
  } catch (err) {
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { userId, forceNew } = body

    // 本人のセッションだけ作る。body の userId はセッションの持ち主と一致するときだけ通す。
    // 以前あった isNewUser＋email/password による未ログインのユーザー作成は、画面から使われておらず、
    // 他人のメールアドレスで確認済みユーザーを作れたため削除した（2026-10-22）
    const self = await requireSelf(request, userId)
    if (self.error) return self.error
    const authId = self.authId

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
    // 261006_v1 以降、カウント単位は会社。会社なし（未ログイン等）は user_id で従来どおり。
    const unlimited = can(await fetchCompanyPlan(companyId), 'buildToolsUnlimited')
    const completedCount = unlimited
      ? null
      : await countCompletedThisMonth(supabaseAdmin, 'stp', { companyId, authId })

    if (completedCount !== null && completedCount >= MONTHLY_FREE_LIMIT) {
      // 進行中のセッションがあればそれを返す（制限到達後も復帰は許可）。forceNew時は新規作成不可＝403
      const { data: inProgressSession } = forceNew ? { data: null } : await supabaseAdmin
        .from('mini_app_sessions')
        .select('id, current_step, session_data')
        .eq('user_id', authId)
        .eq('app_type', 'stp')
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
      .eq('app_type', 'stp')
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
        app_type: 'stp',
        status: 'in_progress',
        current_step: 1,
        company_id: companyId,
        session_data: DEFAULT_SESSION_DATA,
      })
      .select('id')
      .single()

    if (sessionError) {
      console.error('[STPSessions] ステップ3失敗:', sessionError.message)
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
    console.error('[STPSessions] 予期しないエラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
