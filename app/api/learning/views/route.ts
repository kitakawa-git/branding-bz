// ラーニング 視聴セッション開始API（ポータルメンバー・service_role 経由）
// POST /api/learning/views   body: { video_id }
// profile_id / company_id はセッションから解決。新規セッション行を INSERT し view_id を返す。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getMemberContext } from '@/lib/learning/auth'
import { guardCompanyFeature } from '@/lib/billing/guard'

export async function POST(request: NextRequest) {
  try {
    const member = await getMemberContext()
    if (!member) {
      return NextResponse.json({ error: '権限がありません' }, { status: 401 })
    }
    const denied = await guardCompanyFeature(member.companyId, 'videoLearning')
    if (denied) return denied

    const body = await request.json().catch(() => null)
    const videoId = body && typeof body.video_id === 'string' ? body.video_id : null
    if (!videoId) {
      return NextResponse.json({ error: 'video_id is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // 動画の存在・公開・所属企業を確認（不正な video_id でのセッション作成を防ぐ）
    const { data: video, error: videoError } = await supabase
      .from('learning_videos')
      .select('id, company_id, is_published')
      .eq('id', videoId)
      .maybeSingle()

    if (videoError) {
      console.error('[Learning Views POST] 動画取得エラー:', videoError.message)
      return NextResponse.json({ error: videoError.message }, { status: 500 })
    }
    if (!video || video.company_id !== member.companyId || !video.is_published) {
      return NextResponse.json({ error: '動画が見つかりません' }, { status: 404 })
    }

    const { data: view, error: insertError } = await supabase
      .from('learning_video_views')
      .insert({
        company_id: member.companyId,
        video_id: videoId,
        profile_id: member.profileId,
        watched_seconds: 0,
        progress_percent: 0,
        completed: false,
        last_progress_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[Learning Views POST] INSERT エラー:', insertError.message)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ view_id: view.id }, { status: 201 })
  } catch (err) {
    console.error('[Learning Views POST] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
