'use client'

// お知らせ詳細・既読状況確認ページ（管理画面）
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../../components/AdminDataProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { ArrowLeft, Heart } from 'lucide-react'
import Link from 'next/link'

const CATEGORY_COLORS: Record<string, string> = {
  '重要': 'bg-red-100 text-red-700',
  'イベント': 'bg-blue-100 text-blue-700',
  '更新': 'bg-green-100 text-green-700',
  'その他': 'bg-gray-100 text-gray-700',
}

type Announcement = {
  id: string
  title: string
  content: string
  category: string
  images: string[]
  is_published: boolean
  created_at: string
}

type MemberReadStatus = {
  auth_id: string
  display_name: string
  photo_url: string | null
  read_at: string | null
}

type DetailCache = {
  announcement: Announcement
  members: MemberReadStatus[]
  likeCount: number
}

export default function AnnouncementDetailPage() {
  const params = useParams()
  const { companyId } = useAuth()
  const id = params.id as string
  const cacheKey = `admin-announcement-detail-${id}`
  const cached = id ? getPageCache<DetailCache>(cacheKey) : null

  const [announcement, setAnnouncement] = useState<Announcement | null>(cached?.announcement ?? null)
  const [members, setMembers] = useState<MemberReadStatus[]>(cached?.members ?? [])
  const [likeCount, setLikeCount] = useState(cached?.likeCount ?? 0)
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    if (!id || !companyId) return
    if (getPageCache<DetailCache>(cacheKey)) return

    const fetchData = async () => {
      try {
        const [announcementRes, readsRes, membersRes, likesRes] = await Promise.all([
          supabase
            .from('announcements')
            .select('id, title, content, category, images, is_published, created_at')
            .eq('id', id)
            .single(),
          supabase
            .from('announcement_reads')
            .select('user_id, read_at')
            .eq('announcement_id', id),
          supabase
            .from('members')
            .select('auth_id, display_name, profile:profiles(name, photo_url)')
            .eq('company_id', companyId),
          supabase
            .from('announcement_likes')
            .select('id')
            .eq('announcement_id', id),
        ])

        const ann = announcementRes.data
        if (!ann) return

        setAnnouncement({
          ...ann,
          images: ann.images || [],
        })

        // 既読マップ作成
        const readMap = new Map<string, string>()
        ;(readsRes.data || []).forEach(r => {
          readMap.set(r.user_id, r.read_at)
        })

        // メンバーリスト作成
        const memberList: MemberReadStatus[] = (membersRes.data || []).map((m: { auth_id: string; display_name: string; profile: { name: string; photo_url: string } | { name: string; photo_url: string }[] | null }) => {
          const profile = Array.isArray(m.profile) ? m.profile[0] : m.profile
          return {
            auth_id: m.auth_id,
            display_name: profile?.name || m.display_name || '不明',
            photo_url: profile?.photo_url || null,
            read_at: readMap.get(m.auth_id) || null,
          }
        })

        // 既読を先、未読を後
        memberList.sort((a, b) => {
          if (a.read_at && !b.read_at) return -1
          if (!a.read_at && b.read_at) return 1
          return 0
        })

        setMembers(memberList)
        setLikeCount(likesRes.data?.length || 0)

        setPageCache(cacheKey, {
          announcement: { ...ann, images: ann.images || [] },
          members: memberList,
          likeCount: likesRes.data?.length || 0,
        })
      } catch (err) {
        console.error('[AnnouncementDetail] データ取得エラー:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, companyId, cacheKey])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div>
        <Skeleton className="h-4 w-32 mb-3" />
        <Skeleton className="h-8 w-64 mb-6" />
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-6">
          <CardContent className="p-5">
            <Skeleton className="h-6 w-48 mb-3" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <Skeleton className="h-4 w-32 mb-3" />
            <Skeleton className="h-3 w-full mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-8 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32 ml-auto" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!announcement) {
    return (
      <div className="text-center p-10">
        <p className="text-muted-foreground">お知らせが見つかりません</p>
      </div>
    )
  }

  const readMembers = members.filter(m => m.read_at)
  const unreadMembers = members.filter(m => !m.read_at)
  const readRate = members.length > 0 ? Math.round((readMembers.length / members.length) * 100) : 0

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/announcements"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 no-underline mb-3"
        >
          <ArrowLeft size={14} />
          お知らせ管理に戻る
        </Link>
        <h1 className="text-2xl font-bold text-foreground">{announcement.title}</h1>
      </div>

      {/* お知らせ内容 */}
      <Link href={`/admin/announcements/${id}/edit`} className="block no-underline mb-6">
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none hover:bg-muted/50 transition-colors cursor-pointer">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${CATEGORY_COLORS[announcement.category] || ''}`}>
              {announcement.category}
            </Badge>
            <span className={`py-0.5 px-2 rounded text-xs font-bold ${announcement.is_published ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              {announcement.is_published ? '公開' : '下書き'}
            </span>
            <span className="text-xs text-muted-foreground" suppressHydrationWarning>
              {formatDate(announcement.created_at)}
            </span>
          </div>

          <p className="text-sm text-foreground whitespace-pre-wrap m-0 mb-4">{announcement.content}</p>

          {announcement.images.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {announcement.images.map((url, i) => (
                <img key={i} src={url} alt={`画像 ${i + 1}`} className="w-full h-[120px] object-cover rounded-lg border" />
              ))}
            </div>
          )}

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Heart size={12} className={likeCount > 0 ? 'text-red-500' : ''} />
            <span>いいね {likeCount}件</span>
          </div>
        </CardContent>
      </Card>
      </Link>

      {/* 既読状況 */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          <h2 className="text-sm font-bold mb-3">既読状況</h2>

          <div className="flex items-center gap-3 mb-4">
            <Progress value={readRate} className="flex-1 h-2" />
            <span className="text-sm font-semibold text-foreground whitespace-nowrap">
              {readMembers.length}/{members.length} ({readRate}%)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 既読メンバー */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-3">
                既読（{readMembers.length}名）
              </h3>
              <div className="space-y-2">
                {readMembers.map(m => (
                  <div key={m.auth_id} className="flex items-center gap-2.5">
                    <Avatar className="size-7">
                      {m.photo_url && <AvatarImage src={m.photo_url} alt={m.display_name} />}
                      <AvatarFallback className="text-[10px]">
                        {m.display_name.slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-foreground flex-1 truncate">{m.display_name}</span>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap" suppressHydrationWarning>
                      {m.read_at ? formatDate(m.read_at) : ''}
                    </span>
                  </div>
                ))}
                {readMembers.length === 0 && (
                  <p className="text-xs text-muted-foreground">まだ既読者がいません</p>
                )}
              </div>
            </div>

            {/* 未読メンバー */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-3">
                未読（{unreadMembers.length}名）
              </h3>
              <div className="space-y-2">
                {unreadMembers.map(m => (
                  <div key={m.auth_id} className="flex items-center gap-2.5">
                    <Avatar className="size-7">
                      {m.photo_url && <AvatarImage src={m.photo_url} alt={m.display_name} />}
                      <AvatarFallback className="text-[10px]">
                        {m.display_name.slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-foreground truncate">{m.display_name}</span>
                  </div>
                ))}
                {unreadMembers.length === 0 && (
                  <p className="text-xs text-muted-foreground">全員既読済みです</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
