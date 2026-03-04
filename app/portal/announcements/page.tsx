'use client'

// ポータル お知らせ一覧ページ
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { usePortalAuth } from '../components/PortalAuthProvider'
import { getRelativeTime } from '@/lib/time-utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { Heart } from 'lucide-react'

const CATEGORY_COLORS: Record<string, string> = {
  '重要': 'bg-red-100 text-red-700',
  'イベント': 'bg-blue-100 text-blue-700',
  '更新': 'bg-green-100 text-green-700',
  'その他': 'bg-gray-100 text-gray-700',
}

const CATEGORIES = ['すべて', '重要', 'イベント', '更新', 'その他']

type AnnouncementItem = {
  id: string
  title: string
  content: string
  category: string
  created_at: string
  like_count: number
  is_read: boolean
}

type ListCache = {
  announcements: AnnouncementItem[]
}

export default function PortalAnnouncementsPage() {
  const { companyId, user } = usePortalAuth()
  const cacheKey = `portal-announcements-${companyId}-${user?.id}`
  const cached = companyId && user?.id ? getPageCache<ListCache>(cacheKey) : null
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(cached?.announcements ?? [])
  const [loading, setLoading] = useState(!cached)
  const [selectedCategory, setSelectedCategory] = useState('すべて')

  useEffect(() => {
    if (!companyId || !user?.id) return
    if (getPageCache<ListCache>(cacheKey)) return

    const fetchData = async () => {
      try {
        const [announcementsRes, readsRes, likesRes] = await Promise.all([
          supabase
            .from('announcements')
            .select('id, title, content, category, created_at')
            .eq('company_id', companyId)
            .eq('is_published', true)
            .order('created_at', { ascending: false }),
          supabase
            .from('announcement_reads')
            .select('announcement_id')
            .eq('user_id', user.id)
            .eq('company_id', companyId),
          supabase
            .from('announcement_likes')
            .select('announcement_id')
            .eq('company_id', companyId),
        ])

        const items = announcementsRes.data || []
        const readIds = new Set((readsRes.data || []).map(r => r.announcement_id))

        // いいね数マップ
        const likeCountMap = new Map<string, number>()
        ;(likesRes.data || []).forEach(l => {
          likeCountMap.set(l.announcement_id, (likeCountMap.get(l.announcement_id) || 0) + 1)
        })

        const announcementItems: AnnouncementItem[] = items.map(a => ({
          id: a.id,
          title: a.title,
          content: a.content,
          category: a.category,
          created_at: a.created_at,
          like_count: likeCountMap.get(a.id) || 0,
          is_read: readIds.has(a.id),
        }))

        setAnnouncements(announcementItems)
        setPageCache(cacheKey, { announcements: announcementItems })
      } catch (err) {
        console.error('[PortalAnnouncements] データ取得エラー:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, user?.id, cacheKey])

  const filtered = selectedCategory === 'すべて'
    ? announcements
    : announcements.filter(a => a.category === selectedCategory)

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-5 pt-4 pb-8">
        <Skeleton className="h-8 w-32 mb-6" />
        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8 w-16 rounded-full" />)}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="border shadow-none">
              <CardContent className="p-4">
                <Skeleton className="h-4 w-16 mb-2" />
                <Skeleton className="h-5 w-64 mb-2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4 mt-1" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-5 pt-4 pb-8">
      <h1 className="text-2xl font-bold text-foreground mb-6">お知らせ</h1>

      {/* カテゴリフィルタ */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedCategory === cat
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* お知らせリスト */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          お知らせはありません
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => (
            <Link
              key={a.id}
              href={`/portal/announcements/${a.id}`}
              className="no-underline block"
            >
              <Card className={`border shadow-none hover:shadow-sm transition-shadow ${!a.is_read ? 'bg-blue-50/50' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-2.5">
                    {/* 未読ドット */}
                    <div className="pt-2 shrink-0">
                      {!a.is_read ? (
                        <div className="size-2 rounded-full bg-blue-500" />
                      ) : (
                        <div className="size-2" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${CATEGORY_COLORS[a.category] || CATEGORY_COLORS['その他']}`}>
                          {a.category}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground" suppressHydrationWarning>
                          {getRelativeTime(a.created_at)}
                        </span>
                      </div>

                      <h3 className="text-sm font-semibold text-foreground mb-1 m-0">
                        {a.title}
                      </h3>

                      <p className="text-xs text-muted-foreground line-clamp-3 m-0 whitespace-pre-wrap">
                        {a.content}
                      </p>

                      {a.like_count > 0 && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <Heart size={12} className="text-red-500" />
                          {a.like_count}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
