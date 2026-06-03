// STP分析ツール セッション取得・更新API
// GET  /api/tools/stp/sessions/[sessionId] — セッション取得（途中復帰用）
// PATCH /api/tools/stp/sessions/[sessionId] — ステップ進行・データ保存
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params

  try {
    const supabaseAdmin = getSupabaseAdmin()

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('mini_app_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('app_type', 'stp')
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      )
    }

    return NextResponse.json({ session })
  } catch (err) {
    console.error('[STPSessions GET] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params

  try {
    const supabaseAdmin = getSupabaseAdmin()
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
      .eq('app_type', 'stp')

    if (updateError) {
      console.error('[STPSessions PATCH] 更新エラー:', updateError.message)
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
    console.error('[STPSessions PATCH] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
