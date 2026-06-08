// ラーニング 階層構造API（service_role 経由）
// GET /api/learning/structure                 管理用: 全カテゴリー>テーマ>全動画（未公開含む・空テーマも返す）
// GET /api/learning/structure?published=true   ポータル用: 公開動画のみ＋自分の進捗。空テーマ/空カテゴリは除外
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminContext, getMemberContext } from '@/lib/learning/auth'
import type { LearningVideo, LearningVideoWithProgress } from '@/lib/types/learning'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const publishedOnly = searchParams.get('published') === 'true'
    const supabase = getSupabaseAdmin()

    let companyId: string
    let profileId: string | null = null
    if (publishedOnly) {
      const member = await getMemberContext()
      if (!member) return NextResponse.json({ error: '権限がありません' }, { status: 401 })
      companyId = member.companyId
      profileId = member.profileId
    } else {
      const admin = await getAdminContext()
      if (!admin) return NextResponse.json({ error: '権限がありません' }, { status: 403 })
      companyId = admin.companyId
    }

    const [catRes, themeRes, videoRes] = await Promise.all([
      supabase
        .from('learning_categories')
        .select('*')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('learning_themes')
        .select('*')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      (() => {
        let q = supabase
          .from('learning_videos')
          .select('*')
          .eq('company_id', companyId)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true })
        if (publishedOnly) q = q.eq('is_published', true)
        return q
      })(),
    ])

    if (catRes.error) return NextResponse.json({ error: catRes.error.message }, { status: 500 })
    if (themeRes.error) return NextResponse.json({ error: themeRes.error.message }, { status: 500 })
    if (videoRes.error) return NextResponse.json({ error: videoRes.error.message }, { status: 500 })

    const categories = catRes.data ?? []
    const themes = themeRes.data ?? []
    let videos: (LearningVideo | LearningVideoWithProgress)[] = (videoRes.data ?? []) as LearningVideo[]

    if (publishedOnly && profileId && videos.length > 0) {
      const { data: views } = await supabase
        .from('learning_video_views')
        .select('video_id, progress_percent, completed')
        .eq('profile_id', profileId)
        .in('video_id', videos.map((v) => v.id))
      const progressMap = new Map<string, { max: number; completed: boolean; count: number }>()
      for (const v of views ?? []) {
        const cur = progressMap.get(v.video_id) ?? { max: 0, completed: false, count: 0 }
        cur.max = Math.max(cur.max, v.progress_percent ?? 0)
        cur.completed = cur.completed || !!v.completed
        cur.count += 1
        progressMap.set(v.video_id, cur)
      }
      videos = (videos as LearningVideo[]).map((v) => {
        const p = progressMap.get(v.id)
        return {
          ...v,
          my_progress_percent: p?.max ?? 0,
          my_completed: p?.completed ?? false,
          my_view_count: p?.count ?? 0,
        } as LearningVideoWithProgress
      })
    }

    const videosByTheme = new Map<string, typeof videos>()
    const uncategorized: typeof videos = []
    for (const v of videos) {
      if (v.theme_id) {
        const arr = videosByTheme.get(v.theme_id) ?? []
        arr.push(v)
        videosByTheme.set(v.theme_id, arr)
      } else {
        uncategorized.push(v)
      }
    }

    const themesByCategory = new Map<string, typeof themes>()
    for (const t of themes) {
      const arr = themesByCategory.get(t.category_id) ?? []
      arr.push(t)
      themesByCategory.set(t.category_id, arr)
    }

    const builtCategories = categories
      .map((c) => {
        const builtThemes = (themesByCategory.get(c.id) ?? [])
          .map((t) => {
            const themeVideos = videosByTheme.get(t.id) ?? []
            return { ...t, video_count: themeVideos.length, videos: themeVideos }
          })
          .filter((t) => (publishedOnly ? t.video_count > 0 : true))
        return { ...c, themes: builtThemes }
      })
      .filter((c) => (publishedOnly ? c.themes.length > 0 : true))

    return NextResponse.json({ categories: builtCategories, uncategorized })
  } catch (err) {
    console.error('[Learning Structure GET] エラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
