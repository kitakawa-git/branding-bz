// ラーニング 視聴進捗更新API（ポータルメンバー・service_role 経由）
// PATCH /api/learning/views/[id]
//   body: { watched_seconds, progress_percent, completed, duration_seconds? }
//   既存値より大きい時のみ更新（巻き戻り防止）。completed は一度 true なら維持。
//   duration_seconds を受け取った場合、親動画の duration_seconds が未設定なら確定する。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getMemberContext } from '@/lib/learning/auth'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const member = await getMemberContext()
    if (!member) {
      return NextResponse.json({ error: '権限がありません' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 })
    }
    const b = body as Record<string, unknown>

    const supabase = getSupabaseAdmin()

    // 対象セッションを取得し、本人のものか確認（他人のセッションは更新不可）
    const { data: view, error: viewError } = await supabase
      .from('learning_video_views')
      .select('id, profile_id, video_id, watched_seconds, progress_percent, completed')
      .eq('id', id)
      .maybeSingle()

    if (viewError) {
      console.error('[Learning View PATCH] セッション取得エラー:', viewError.message)
      return NextResponse.json({ error: viewError.message }, { status: 500 })
    }
    if (!view || view.profile_id !== member.profileId) {
      return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 })
    }

    // 巻き戻り防止: 既存値より大きい場合のみ採用
    const incomingWatched =
      typeof b.watched_seconds === 'number' && b.watched_seconds >= 0
        ? Math.round(b.watched_seconds)
        : 0
    const incomingProgress =
      typeof b.progress_percent === 'number'
        ? Math.min(100, Math.max(0, Math.round(b.progress_percent)))
        : 0
    const incomingCompleted = b.completed === true

    const nextWatched = Math.max(view.watched_seconds, incomingWatched)
    const nextProgress = Math.max(view.progress_percent, incomingProgress)
    // 90%以上 もしくは ENDED(completed=true) で完了。一度 true なら維持。
    const nextCompleted = view.completed || incomingCompleted || nextProgress >= 90

    const { error: updateError } = await supabase
      .from('learning_video_views')
      .update({
        watched_seconds: nextWatched,
        progress_percent: nextProgress,
        completed: nextCompleted,
        last_progress_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('[Learning View PATCH] UPDATE エラー:', updateError.message)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // duration 確定（任意・軽量）: 親動画の duration_seconds が未設定なら設定
    if (typeof b.duration_seconds === 'number' && b.duration_seconds > 0) {
      const { data: video } = await supabase
        .from('learning_videos')
        .select('id, duration_seconds')
        .eq('id', view.video_id)
        .maybeSingle()
      if (video && (video.duration_seconds == null || video.duration_seconds === 0)) {
        await supabase
          .from('learning_videos')
          .update({ duration_seconds: Math.round(b.duration_seconds as number) })
          .eq('id', view.video_id)
      }
    }

    return NextResponse.json({
      success: true,
      progress_percent: nextProgress,
      completed: nextCompleted,
    })
  } catch (err) {
    console.error('[Learning View PATCH] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
