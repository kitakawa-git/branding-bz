// 構築ツール（STP / ペルソナ / パーソナリティ診断）のセッション API の共通ハンドラ。
//
// 3ツールの POST /api/tools/<tool>/sessions と GET・PATCH /api/tools/<tool>/sessions/[sessionId] は、
// app_type・初期データ・ログの文言以外がまったく同じ処理だったので、ここに1つにまとめた。
// 各 route はツール固有の値を渡して export するだけにする。
//   - カラー定義ツール（brand_colors）は brand_color_projects も読み書きするため対象外（colors の route を参照）
//   - STP だけにある一覧 GET・アーカイブ DELETE は stp の route に残している
//
// deps はテストで差し替えるための引数。本番では省略する（既定は実モジュール）。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireSelf, requireOwnToolSession } from '@/lib/auth/caller'
import {
  MONTHLY_FREE_LIMIT,
  MONTHLY_LIMIT_REACHED_MESSAGE,
  countCompletedThisMonth,
  type BuildToolAppType,
} from '@/lib/tools/free-limits'
import { can } from '@/lib/billing/entitlements'
import { fetchCompanyPlan, usageLimitResponse } from '@/lib/billing/guard'

export type ToolSessionDeps = {
  getSupabaseAdmin: typeof getSupabaseAdmin
  requireSelf: typeof requireSelf
  requireOwnToolSession: typeof requireOwnToolSession
  countCompletedThisMonth: typeof countCompletedThisMonth
  fetchCompanyPlan: typeof fetchCompanyPlan
  can: typeof can
}

const defaultDeps: ToolSessionDeps = {
  getSupabaseAdmin,
  requireSelf,
  requireOwnToolSession,
  countCompletedThisMonth,
  fetchCompanyPlan,
  can,
}

type SessionRouteContext = { params: Promise<{ sessionId: string }> }

export type ToolSessionConfig = {
  /** mini_app_sessions.app_type */
  appType: Exclude<BuildToolAppType, 'brand_colors'>
  /** ログの接頭辞（例: 'PersonaSessions'） */
  logTag: string
}

/**
 * POST /api/tools/<tool>/sessions — ログイン中のユーザーのセッション作成。
 * 進行中のセッションがあればそれを返す（forceNew 時は常に新規作成）。月次の無料上限もここで見る。
 */
export function createToolSessionPost(
  config: ToolSessionConfig & {
    /** 新規セッションの session_data */
    defaultSessionData: Record<string, unknown>
    /** 作成失敗時のログ文言（ツールごとに以前の文言を残している） */
    createFailedLog: string
  },
  deps: ToolSessionDeps = defaultDeps,
) {
  const { appType, logTag, defaultSessionData, createFailedLog } = config

  return async function POST(request: NextRequest) {
    try {
      const supabaseAdmin = deps.getSupabaseAdmin()
      const body = await request.json()
      const { userId, forceNew } = body

      // 本人のセッションだけ作る。body の userId はセッションの持ち主と一致するときだけ通す。
      // 以前あった isNewUser＋email/password による未ログインのユーザー作成は、画面から使われておらず、
      // 他人のメールアドレスで確認済みユーザーを作れたため削除した（2026-10-22）
      const self = await deps.requireSelf(request, userId)
      if (self.error) return self.error
      const authId = self.authId

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
      const unlimited = deps.can(await deps.fetchCompanyPlan(companyId), 'buildToolsUnlimited')
      const completedCount = unlimited
        ? null
        : await deps.countCompletedThisMonth(supabaseAdmin, appType, { companyId, authId })

      if (completedCount !== null && completedCount >= MONTHLY_FREE_LIMIT) {
        // 進行中のセッションがあればそれを返す（制限到達後も復帰は許可）。forceNew時は新規作成不可＝403
        const { data: inProgressSession } = forceNew ? { data: null } : await supabaseAdmin
          .from('mini_app_sessions')
          .select('id, current_step, session_data')
          .eq('user_id', authId)
          .eq('app_type', appType)
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
        .eq('app_type', appType)
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
          app_type: appType,
          status: 'in_progress',
          current_step: 1,
          company_id: companyId,
          session_data: defaultSessionData,
        })
        .select('id')
        .single()

      if (sessionError) {
        console.error(`[${logTag}] ${createFailedLog}:`, sessionError.message)
        return NextResponse.json(
          { error: `セッション作成エラー: ${sessionError.message}` },
          { status: 500 }
        )
      }

      return NextResponse.json({
        sessionId: session.id,
        currentStep: 1,
        sessionData: defaultSessionData,
        isExisting: false,
      }, { status: 201 })
    } catch (err) {
      console.error(`[${logTag}] 予期しないエラー:`, err)
      return NextResponse.json(
        { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
        { status: 500 }
      )
    }
  }
}

/** GET /api/tools/<tool>/sessions/[sessionId] — セッション取得（途中復帰用） */
export function createToolSessionGet(config: ToolSessionConfig, deps: ToolSessionDeps = defaultDeps) {
  const { appType, logTag } = config

  return async function GET(request: NextRequest, { params }: SessionRouteContext) {
    const { sessionId } = await params
    // 本人のセッションだけ（sessionId を知っているだけでは読ませない・書かせない）
    const own = await deps.requireOwnToolSession(request, sessionId)
    if (own.error) return own.error

    try {
      const supabaseAdmin = deps.getSupabaseAdmin()

      const { data: session, error: sessionError } = await supabaseAdmin
        .from('mini_app_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('app_type', appType)
        .single()

      if (sessionError || !session) {
        return NextResponse.json(
          { error: 'セッションが見つかりません' },
          { status: 404 }
        )
      }

      return NextResponse.json({ session })
    } catch (err) {
      console.error(`[${logTag} GET] エラー:`, err)
      return NextResponse.json(
        { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
        { status: 500 }
      )
    }
  }
}

/** PATCH /api/tools/<tool>/sessions/[sessionId] — ステップ進行・データ保存（session_data は部分マージ） */
export function createToolSessionPatch(config: ToolSessionConfig, deps: ToolSessionDeps = defaultDeps) {
  const { appType, logTag } = config

  return async function PATCH(request: NextRequest, { params }: SessionRouteContext) {
    const { sessionId } = await params
    // 本人のセッションだけ（sessionId を知っているだけでは読ませない・書かせない）
    const own = await deps.requireOwnToolSession(request, sessionId)
    if (own.error) return own.error

    try {
      const supabaseAdmin = deps.getSupabaseAdmin()
      const body = await request.json()
      const { step, sessionData, status } = body

      const updateData: Record<string, unknown> = {}

      // session_data更新（JSONB部分マージ）
      if (sessionData && Object.keys(sessionData).length > 0) {
        // 既存データを取得してマージ
        const { data: existing } = await supabaseAdmin
          .from('mini_app_sessions')
          .select('session_data')
          .eq('id', sessionId)
          .single()

        const mergedData = {
          ...(existing?.session_data || {}),
          ...sessionData,
        }
        updateData.session_data = mergedData
      }

      // ステップ進行
      if (step !== undefined) {
        updateData.current_step = step
      }

      // ステータス更新
      if (status) {
        updateData.status = status
        if (status === 'completed') {
          updateData.completed_at = new Date().toISOString()
          // session_data内のcompletedフラグも更新
          if (updateData.session_data) {
            ;(updateData.session_data as Record<string, unknown>).completed = true
          }
        }
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ sessionId, saved: false, message: '更新するデータがありません' })
      }

      const { error: updateError } = await supabaseAdmin
        .from('mini_app_sessions')
        .update(updateData)
        .eq('id', sessionId)
        .eq('app_type', appType)

      if (updateError) {
        console.error(`[${logTag} PATCH] 更新エラー:`, updateError.message)
        return NextResponse.json(
          { error: `データ保存エラー: ${updateError.message}` },
          { status: 500 }
        )
      }

      return NextResponse.json({
        sessionId,
        currentStep: step,
        saved: true,
      })
    } catch (err) {
      console.error(`[${logTag} PATCH] エラー:`, err)
      return NextResponse.json(
        { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
        { status: 500 }
      )
    }
  }
}
