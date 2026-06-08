// ラーニング動画 取得・更新・削除API（管理者・service_role 経由）
// GET    /api/learning/videos/[id]
// PATCH  /api/learning/videos/[id]
// DELETE /api/learning/videos/[id]
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminContext } from '@/lib/learning/auth'
import { extractVideoId, getThumbnailUrl } from '@/lib/youtube'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const admin = await getAdminContext()
    if (!admin) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('learning_videos')
      .select('*')
      .eq('id', id)
      .eq('company_id', admin.companyId)
      .single()

    if (error) {
      const status = error.code === 'PGRST116' ? 404 : 500
      return NextResponse.json(
        { error: status === 404 ? '動画が見つかりません' : error.message },
        { status }
      )
    }

    return NextResponse.json({ video: data })
  } catch (err) {
    console.error('[Learning Video GET] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const admin = await getAdminContext()
    if (!admin) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 })
    }

    const b = body as Record<string, unknown>
    const updates: Record<string, unknown> = {}

    if (typeof b.title === 'string') {
      if (!b.title.trim()) {
        return NextResponse.json({ error: 'タイトルは空にできません' }, { status: 400 })
      }
      updates.title = b.title.trim()
    }
    if ('description' in b) {
      updates.description = typeof b.description === 'string' ? b.description.trim() || null : null
    }
    if ('category' in b) {
      updates.category = typeof b.category === 'string' ? b.category.trim() || null : null
    }
    if ('theme_id' in b) {
      // null/空 で未分類に戻す。文字列ならそのテーマへ割り当て
      updates.theme_id = typeof b.theme_id === 'string' && b.theme_id ? b.theme_id : null
    }
    if (typeof b.is_published === 'boolean') {
      updates.is_published = b.is_published
    }
    if (typeof b.duration_seconds === 'number' && b.duration_seconds > 0) {
      updates.duration_seconds = Math.round(b.duration_seconds)
    }

    // YouTube URL 変更時は動画IDを再抽出し、サムネ未指定なら再生成
    if (typeof b.youtube_url === 'string' && b.youtube_url.trim()) {
      const vid = extractVideoId(b.youtube_url)
      if (!vid) {
        return NextResponse.json(
          { error: 'YouTube URL から動画IDを抽出できませんでした' },
          { status: 400 }
        )
      }
      updates.youtube_url = b.youtube_url.trim()
      updates.youtube_video_id = vid
      if (!(typeof b.thumbnail_url === 'string' && b.thumbnail_url.trim())) {
        updates.thumbnail_url = getThumbnailUrl(vid)
      }
    }
    if (typeof b.thumbnail_url === 'string' && b.thumbnail_url.trim()) {
      updates.thumbnail_url = b.thumbnail_url.trim()
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '更新対象の項目がありません' }, { status: 400 })
    }
    updates.updated_at = new Date().toISOString()

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('learning_videos')
      .update(updates)
      .eq('id', id)
      .eq('company_id', admin.companyId) // 自社のみ
      .select()
      .single()

    if (error) {
      const status = error.code === 'PGRST116' ? 404 : 500
      return NextResponse.json(
        { error: status === 404 ? '動画が見つかりません' : error.message },
        { status }
      )
    }

    return NextResponse.json({ video: data })
  } catch (err) {
    console.error('[Learning Video PATCH] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const admin = await getAdminContext()
    if (!admin) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('learning_videos')
      .delete()
      .eq('id', id)
      .eq('company_id', admin.companyId) // 自社のみ

    if (error) {
      console.error('[Learning Video DELETE] エラー:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Learning Video DELETE] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
