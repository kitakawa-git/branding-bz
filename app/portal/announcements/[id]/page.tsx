'use client'

// ポータル お知らせ詳細ページ（既読自動記録 + いいね機能）
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { usePortalAuth } from '../../components/PortalAuthProvider'
import { getRelativeTime } from '@/lib/time-utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
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
  created_at: string
  author_name: string | null
}

export default function PortalAnnouncementDetailPage() {
  const params = useParams()
  const { companyId, user } = usePortalAuth()
  const id = params.id as string

  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [loading, setLoading] = useState(true)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null)
  const [readMarked, setReadMarked] = useState(false)

  // データ取得
  useEffect(() => {
    if (!id || !companyId || !user?.id) return

    const fetchData = async () => {
      try {
        const [announcementRes, likesRes, myLikeRes] = await Promise.all([
          supabase
            .from('announcements')
            .select('id, title, content, category, images, created_at, author_id')
            .eq('id', id)
            .single(),
          supabase
            .from('announcement_likes')
            .select('id')
            .eq('announcement_id', id),
          supabase
            .from('announcement_likes')
            .select('id')
            .eq('announcement_id', id)
            .eq('user_id', user.id),
        ])

        if (announcementRes.data) {
          const ann = announcementRes.data

          // 投稿者名を取得
          let authorName: string | null = null
          if (ann.author_id) {
            const { data: memberData } = await supabase
              .from('members')
              .select('display_name, profile:profiles(name)')
              .eq('auth_id', ann.author_id)
              .eq('company_id', companyId)
              .single()
            if (memberData) {
              const profile = Array.isArray(memberData.profile) ? memberData.profile[0] : memberData.profile
              authorName = (profile as { name: string } | null)?.name || memberData.display_name || null
            }
          }

          setAnnouncement({
            ...ann,
            images: ann.images || [],
            author_name: authorName,
          })
        }

        setLikeCount(likesRes.data?.length || 0)
        setLiked((myLikeRes.data?.length || 0) > 0)
      } catch (err) {
        console.error('[AnnouncementDetail] データ取得エラー:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id, companyId, user?.id])

  // 既読自動記録
  useEffect(() => {
    if (!id || !user?.id || !companyId || readMarked) return

    const markAsRead = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token || ''
        await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/announcement_reads`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
              'Authorization': `Bearer ${token}`,
              'Prefer': 'return=minimal,resolution=ignore-duplicates',
            },
            body: JSON.stringify({
              announcement_id: id,
              user_id: user.id,
              company_id: companyId,
            }),
          }
        )
        setReadMarked(true)
      } catch {
        // 既読記録はサイレントに失敗してよい
      }
    }

    markAsRead()
  }, [id, user?.id, companyId, readMarked])

  // いいねトグル
  const toggleLike = async () => {
    if (!user?.id || !companyId) return

    const prevLiked = liked
    const prevCount = likeCount

    // 楽観的更新
    setLiked(!liked)
    setLikeCount(liked ? likeCount - 1 : likeCount + 1)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        'Authorization': `Bearer ${token}`,
        'Prefer': 'return=minimal',
      }

      const res = prevLiked
        ? await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/announcement_likes?announcement_id=eq.${id}&user_id=eq.${user.id}`,
            { method: 'DELETE', headers }
          )
        : await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/announcement_likes`,
            {
              method: 'POST',
              headers,
              body: JSON.stringify({
                announcement_id: id,
                user_id: user.id,
                company_id: companyId,
              }),
            }
          )

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
    } catch {
      // ロールバック
      setLiked(prevLiked)
      setLikeCount(prevCount)
      toast.error('操作に失敗しました')
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-5 pt-4 pb-8">
        <Skeleton className="h-4 w-32 mb-6" />
        <Skeleton className="h-5 w-24 mb-3" />
        <Skeleton className="h-8 w-3/4 mb-4" />
        <Card className="border shadow-none">
          <CardContent className="p-5">
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!announcement) {
    return (
      <div className="max-w-3xl mx-auto px-5 pt-4 pb-8 text-center">
        <p className="text-muted-foreground">お知らせが見つかりません</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-5 pt-4 pb-8">
      {/* 戻るリンク */}
      <Link
        href="/portal/announcements"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 no-underline mb-6"
      >
        <ArrowLeft size={14} />
        お知らせ一覧に戻る
      </Link>

      {/* ヘッダー */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${CATEGORY_COLORS[announcement.category] || CATEGORY_COLORS['その他']}`}>
            {announcement.category}
          </Badge>
          <span className="text-xs text-muted-foreground" suppressHydrationWarning>
            {getRelativeTime(announcement.created_at)}
          </span>
          {announcement.author_name && (
            <span className="text-xs text-muted-foreground">
              · {announcement.author_name}
            </span>
          )}
        </div>
        <h1 className="text-xl font-bold text-foreground">{announcement.title}</h1>
      </div>

      {/* 本文 */}
      <Card className="border shadow-none mb-4">
        <CardContent className="p-5">
          <p className="text-sm text-foreground whitespace-pre-wrap m-0 leading-relaxed">
            {announcement.content}
          </p>
        </CardContent>
      </Card>

      {/* 画像 */}
      {announcement.images.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {announcement.images.map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`画像 ${i + 1}`}
              className="w-full h-[140px] object-cover rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setEnlargedImage(url)}
            />
          ))}
        </div>
      )}

      {/* いいねボタン */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLike}
          className={`gap-1.5 ${liked ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground'}`}
        >
          <Heart size={16} className={liked ? 'fill-current' : ''} />
          {likeCount > 0 ? likeCount : 'いいね'}
        </Button>
      </div>

      {/* 画像拡大ダイアログ */}
      <Dialog open={!!enlargedImage} onOpenChange={() => setEnlargedImage(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">画像プレビュー</DialogTitle>
          {enlargedImage && (
            <img
              src={enlargedImage}
              alt="拡大画像"
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
