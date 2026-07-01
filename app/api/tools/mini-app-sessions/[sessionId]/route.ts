// 構築ツール共通 セッション削除API（アーカイブ）
// DELETE /api/tools/mini-app-sessions/[sessionId]?userId= — 所有者のみ。一覧から非表示（status='archived'）
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const userId = request.nextUrl.searchParams.get('userId') || ''
    if (!userId) {
      return NextResponse.json({ error: 'userId が必要です' }, { status: 400 })
    }
    const { data: session } = await supabaseAdmin
      .from('mini_app_sessions')
      .select('user_id')
      .eq('id', sessionId)
      .maybeSingle()
    if (!session) {
      return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 })
    }
    if (session.user_id !== userId) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }
    // 物理削除ではなくアーカイブ（一覧の neq('status','archived') で非表示）
    const { error: updateError } = await supabaseAdmin
      .from('mini_app_sessions')
      .update({ status: 'archived' })
      .eq('id', sessionId)
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
