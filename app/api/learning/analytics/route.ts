// ラーニング 視聴分析API（管理者・service_role 経由）
// GET /api/learning/analytics
//   動画別集計（視聴人数・完了人数・完了率・平均進捗・総再生回数）
//   メンバー別集計（各動画の最大進捗・完了・最終視聴日時・回数）
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminContext } from '@/lib/learning/auth'
import type {
  LearningAnalytics,
  VideoAnalytics,
  MemberAnalytics,
  MemberVideoCell,
} from '@/lib/types/learning'

export async function GET(_request: NextRequest) {
  try {
    const admin = await getAdminContext()
    if (!admin) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const supabase = getSupabaseAdmin()
    const companyId = admin.companyId

    // 動画一覧・視聴セッション・メンバーを並列取得
    const [videosRes, viewsRes, membersRes] = await Promise.all([
      supabase
        .from('learning_videos')
        .select('id, title, category, is_published, sort_order')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('learning_video_views')
        .select('video_id, profile_id, progress_percent, completed, started_at')
        .eq('company_id', companyId),
      supabase
        .from('members')
        .select('profile_id, display_name')
        .eq('company_id', companyId)
        .eq('is_active', true),
    ])

    if (videosRes.error) {
      return NextResponse.json({ error: videosRes.error.message }, { status: 500 })
    }
    if (viewsRes.error) {
      return NextResponse.json({ error: viewsRes.error.message }, { status: 500 })
    }

    const videos = videosRes.data ?? []
    const views = viewsRes.data ?? []
    const memberRows = (membersRes.data ?? []).filter((m) => m.profile_id)

    // ── プロフィール名の解決（members + views に出現する profile_id の和集合）──
    const displayNameMap = new Map<string, string>()
    for (const m of memberRows) {
      if (m.profile_id) displayNameMap.set(m.profile_id, m.display_name || '')
    }
    const profileIdSet = new Set<string>()
    for (const m of memberRows) if (m.profile_id) profileIdSet.add(m.profile_id)
    for (const v of views) if (v.profile_id) profileIdSet.add(v.profile_id)
    const profileIds = [...profileIdSet]

    const nameMap = new Map<string, string>()
    if (profileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', profileIds)
      for (const p of profiles ?? []) {
        if (p.name) nameMap.set(p.id, p.name)
      }
    }
    const resolveName = (pid: string) =>
      nameMap.get(pid) || displayNameMap.get(pid) || '（名称未設定）'

    // ── (profile_id, video_id) ごとに最大進捗・完了・最終視聴・回数を集計 ──
    type Agg = { maxProgress: number; completed: boolean; lastViewedAt: string | null; count: number }
    const cellMap = new Map<string, Agg>() // key = `${profileId}__${videoId}`
    const key = (pid: string, vid: string) => `${pid}__${vid}`

    for (const v of views) {
      const k = key(v.profile_id, v.video_id)
      const cur = cellMap.get(k) ?? { maxProgress: 0, completed: false, lastViewedAt: null, count: 0 }
      cur.maxProgress = Math.max(cur.maxProgress, v.progress_percent ?? 0)
      cur.completed = cur.completed || !!v.completed
      cur.count += 1
      if (v.started_at && (!cur.lastViewedAt || v.started_at > cur.lastViewedAt)) {
        cur.lastViewedAt = v.started_at
      }
      cellMap.set(k, cur)
    }

    // ── 動画別集計 ──
    const videoAnalytics: VideoAnalytics[] = videos.map((video) => {
      const videoViews = views.filter((v) => v.video_id === video.id)
      const viewerIds = new Set(videoViews.map((v) => v.profile_id))
      const viewerCount = viewerIds.size

      let completedCount = 0
      let progressSum = 0
      for (const pid of viewerIds) {
        const agg = cellMap.get(key(pid, video.id))
        if (agg) {
          if (agg.completed) completedCount += 1
          progressSum += agg.maxProgress
        }
      }

      return {
        video_id: video.id,
        title: video.title,
        category: video.category,
        is_published: video.is_published,
        viewer_count: viewerCount,
        completed_count: completedCount,
        completion_rate: viewerCount > 0 ? Math.round((completedCount / viewerCount) * 100) : 0,
        avg_progress: viewerCount > 0 ? Math.round(progressSum / viewerCount) : 0,
        total_view_count: videoViews.length,
      }
    })

    // ── メンバー別集計（全動画分のセルを生成）──
    const memberAnalytics: MemberAnalytics[] = profileIds.map((pid) => {
      const cells: MemberVideoCell[] = videos.map((video) => {
        const agg = cellMap.get(key(pid, video.id))
        return {
          video_id: video.id,
          max_progress_percent: agg?.maxProgress ?? 0,
          completed: agg?.completed ?? false,
          last_viewed_at: agg?.lastViewedAt ?? null,
          view_count: agg?.count ?? 0,
        }
      })
      return { profile_id: pid, name: resolveName(pid), cells }
    })

    // 視聴のある人を上に、その後は名前順
    memberAnalytics.sort((a, b) => {
      const aViewed = a.cells.some((c) => c.view_count > 0)
      const bViewed = b.cells.some((c) => c.view_count > 0)
      if (aViewed !== bViewed) return aViewed ? -1 : 1
      return a.name.localeCompare(b.name, 'ja')
    })

    const result: LearningAnalytics = {
      videos: videoAnalytics,
      members: memberAnalytics,
      videoHeaders: videos.map((v) => ({ id: v.id, title: v.title })),
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[Learning Analytics GET] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
