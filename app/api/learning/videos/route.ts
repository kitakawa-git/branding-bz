// ラーニング動画 一覧取得・新規作成API（すべて service_role 経由）
// GET  /api/learning/videos            管理用: 自社の全動画（sort_order順）
// GET  /api/learning/videos?published=true  ポータル用: 公開動画＋自分の進捗
// POST /api/learning/videos            動画作成（管理者）
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminContext, getMemberContext } from '@/lib/learning/auth'
import { resolveCategoryTheme } from '@/lib/learning/resolve'
import { extractVideoId, getThumbnailUrl } from '@/lib/youtube'
import { notifyLearningVideoPublished } from '@/lib/learning/notify'
import type { LearningVideo, LearningVideoWithProgress } from '@/lib/types/learning'

// お知らせ作成＋web-push（VAPID）のため Node ランタイム必須
export const runtime = 'nodejs'

// YouTube oEmbed からタイトルを取得（API キー不要・失敗時 null）
async function fetchOEmbedTitle(youtubeUrl: string): Promise<string | null> {
  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeUrl)}&format=json`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(endpoint, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    const data = (await res.json()) as { title?: string }
    return data.title?.trim() || null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const publishedOnly = searchParams.get('published') === 'true'
    const supabase = getSupabaseAdmin()

    if (publishedOnly) {
      // ── ポータル用: 公開動画 + ログイン中メンバーの進捗 ──
      const member = await getMemberContext()
      if (!member) {
        return NextResponse.json({ error: '権限がありません' }, { status: 401 })
      }

      const { data: videos, error } = await supabase
        .from('learning_videos')
        .select('*')
        .eq('company_id', member.companyId)
        .eq('is_published', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) {
        console.error('[Learning Videos GET portal] クエリエラー:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const list = (videos ?? []) as LearningVideo[]
      if (list.length === 0) {
        return NextResponse.json({ videos: [] })
      }

      // 自分の視聴セッションを取得して動画別に集計
      const { data: views, error: viewsError } = await supabase
        .from('learning_video_views')
        .select('video_id, progress_percent, completed')
        .eq('profile_id', member.profileId)
        .in(
          'video_id',
          list.map((v) => v.id)
        )

      if (viewsError) {
        console.error('[Learning Videos GET portal] views エラー:', viewsError.message)
        return NextResponse.json({ error: viewsError.message }, { status: 500 })
      }

      const progressMap = new Map<string, { max: number; completed: boolean; count: number }>()
      for (const v of views ?? []) {
        const cur = progressMap.get(v.video_id) ?? { max: 0, completed: false, count: 0 }
        cur.max = Math.max(cur.max, v.progress_percent ?? 0)
        cur.completed = cur.completed || !!v.completed
        cur.count += 1
        progressMap.set(v.video_id, cur)
      }

      const withProgress: LearningVideoWithProgress[] = list.map((v) => {
        const p = progressMap.get(v.id)
        return {
          ...v,
          my_progress_percent: p?.max ?? 0,
          my_completed: p?.completed ?? false,
          my_view_count: p?.count ?? 0,
        }
      })

      return NextResponse.json({ videos: withProgress })
    }

    // ── 管理用: 自社の全動画 ──
    const admin = await getAdminContext()
    if (!admin) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const { data: videos, error } = await supabase
      .from('learning_videos')
      .select('*')
      .eq('company_id', admin.companyId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[Learning Videos GET admin] クエリエラー:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ videos: videos ?? [] })
  } catch (err) {
    console.error('[Learning Videos GET] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminContext()
    if (!admin) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 })
    }

    const {
      title,
      description,
      youtube_url,
      category,
      category_id,
      theme_id,
      is_published,
      thumbnail_url,
    } = body as Record<string, unknown>

    if (typeof youtube_url !== 'string' || !youtube_url.trim()) {
      return NextResponse.json({ error: 'YouTube URL を入力してください' }, { status: 400 })
    }

    const videoId = extractVideoId(youtube_url)
    if (!videoId) {
      return NextResponse.json(
        { error: 'YouTube URL から動画IDを抽出できませんでした' },
        { status: 400 }
      )
    }

    // タイトル: 未指定なら oEmbed から取得、それも失敗なら汎用フォールバック
    let finalTitle = typeof title === 'string' ? title.trim() : ''
    if (!finalTitle) {
      finalTitle = (await fetchOEmbedTitle(youtube_url)) || '無題の動画'
    }

    const supabase = getSupabaseAdmin()

    // sort_order: 自社内の最大 + 1
    const { data: maxRow } = await supabase
      .from('learning_videos')
      .select('sort_order')
      .eq('company_id', admin.companyId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextSortOrder = (maxRow?.sort_order ?? 0) + 1

    const finalThumb =
      typeof thumbnail_url === 'string' && thumbnail_url.trim()
        ? thumbnail_url.trim()
        : getThumbnailUrl(videoId)

    // カテゴリー/テーマ解決: テーマ指定時はそのテーマのカテゴリーを採用。テーマ無し＝カテゴリー単独可
    const resolved = await resolveCategoryTheme(supabase, admin.companyId, category_id, theme_id)
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    }

    const { data: video, error: insertError } = await supabase
      .from('learning_videos')
      .insert({
        company_id: admin.companyId,
        title: finalTitle,
        description: typeof description === 'string' ? description.trim() || null : null,
        youtube_video_id: videoId,
        youtube_url: youtube_url.trim(),
        thumbnail_url: finalThumb,
        category: typeof category === 'string' ? category.trim() || null : null,
        category_id: resolved.category_id,
        theme_id: resolved.theme_id,
        is_published: typeof is_published === 'boolean' ? is_published : false,
        sort_order: nextSortOrder,
        created_by: admin.authId,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[Learning Videos POST] INSERT エラー:', insertError.message)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // 公開で登録された場合: お知らせ作成＋プッシュ通知（失敗しても作成は成功扱い）
    if (video.is_published) {
      await notifyLearningVideoPublished(admin.companyId, admin.authId, video)
    }

    return NextResponse.json({ video }, { status: 201 })
  } catch (err) {
    console.error('[Learning Videos POST] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
