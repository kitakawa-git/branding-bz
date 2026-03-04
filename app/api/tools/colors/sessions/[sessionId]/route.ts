// セッション取得・更新API
// GET  /api/tools/colors/sessions/[sessionId] — セッション取得（途中復帰用）
// PATCH /api/tools/colors/sessions/[sessionId] — ステップ進行・データ保存
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params

  try {
    const supabaseAdmin = getSupabaseAdmin()

    // セッション + プロジェクト取得
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('mini_app_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      )
    }

    const { data: project, error: projectError } = await supabaseAdmin
      .from('brand_color_projects')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'プロジェクトが見つかりません' },
        { status: 404 }
      )
    }

    return NextResponse.json({ session, project })
  } catch (err) {
    console.error('[ColorSessions GET] エラー:', err)
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
    const { step, data, status } = body

    console.log('[ColorSessions PATCH] sessionId=', sessionId, 'step=', step)

    // プロジェクト更新
    if (data && Object.keys(data).length > 0) {
      const { error: projectError } = await supabaseAdmin
        .from('brand_color_projects')
        .update(data)
        .eq('session_id', sessionId)

      if (projectError) {
        console.error('[ColorSessions PATCH] プロジェクト更新エラー:', projectError.message)
        return NextResponse.json(
          { error: `データ保存エラー: ${projectError.message}` },
          { status: 500 }
        )
      }
    }

    // ステップ進行 / ステータス更新
    if (step !== undefined || status) {
      const updateData: Record<string, unknown> = {}
      if (step !== undefined) updateData.current_step = step
      if (status) {
        updateData.status = status
        if (status === 'completed') updateData.completed_at = new Date().toISOString()
      }

      const { error: sessionError } = await supabaseAdmin
        .from('mini_app_sessions')
        .update(updateData)
        .eq('id', sessionId)

      if (sessionError) {
        console.error('[ColorSessions PATCH] セッション更新エラー:', sessionError.message)
        return NextResponse.json(
          { error: `ステップ更新エラー: ${sessionError.message}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      sessionId,
      currentStep: step,
      saved: true,
    })
  } catch (err) {
    console.error('[ColorSessions PATCH] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
