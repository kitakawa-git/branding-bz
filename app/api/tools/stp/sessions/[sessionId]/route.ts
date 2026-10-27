// STP分析ツール セッション取得・更新API
// GET  /api/tools/stp/sessions/[sessionId] — セッション取得（途中復帰用）
// PATCH /api/tools/stp/sessions/[sessionId] — ステップ進行・データ保存
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireOwnToolSession } from '@/lib/auth/caller'
import { createToolSessionGet, createToolSessionPatch } from '@/lib/tools/session-handlers'

// 取得・保存の処理は lib/tools/session-handlers に共通化（3ツール共通）
const config = { appType: 'stp' as const, logTag: 'STPSessions' }

export const GET = createToolSessionGet(config)
export const PATCH = createToolSessionPatch(config)

// DELETE /api/tools/stp/sessions/[sessionId]?userId= — セッションをアーカイブ（一覧から非表示。所有者のみ）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  // 本人のセッションだけ（sessionId を知っているだけでは読ませない・書かせない）
  const own = await requireOwnToolSession(request, sessionId)
  if (own.error) return own.error
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const userId = request.nextUrl.searchParams.get('userId') || ''
    if (!userId) {
      return NextResponse.json({ error: 'userId が必要です' }, { status: 400 })
    }
    // 所有者確認
    const { data: session } = await supabaseAdmin
      .from('mini_app_sessions')
      .select('user_id')
      .eq('id', sessionId)
      .eq('app_type', 'stp')
      .maybeSingle()
    if (!session) {
      return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 })
    }
    if (session.user_id !== userId) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }
    // 物理削除ではなくアーカイブ（一覧の neq('status','archived') で非表示になる）
    const { error: updateError } = await supabaseAdmin
      .from('mini_app_sessions')
      .update({ status: 'archived' })
      .eq('id', sessionId)
      .eq('app_type', 'stp')
    if (updateError) {
      return NextResponse.json({ error: `削除エラー: ${updateError.message}` }, { status: 500 })
    }
    return NextResponse.json({ sessionId, deleted: true })
  } catch (err) {
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
