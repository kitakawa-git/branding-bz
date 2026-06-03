'use client'

// ポータル 動画視聴ページ: YouTubePlayer 埋め込み + タイトル・説明。視聴で進捗が記録される。
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, CheckCircle2, PlayCircle } from 'lucide-react'
import { YouTubePlayer } from '@/components/learning/YouTubePlayer'
import type { LearningVideoWithProgress } from '@/lib/types/learning'

export default function PortalLearningWatchPage() {
  const params = useParams()
  const videoId = params.id as string

  const [video, setVideo] = useState<LearningVideoWithProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // ライブ進捗（プレイヤーから更新）
  const [liveProgress, setLiveProgress] = useState(0)
  const [liveCompleted, setLiveCompleted] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/learning/videos?published=true')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        const found = (data.videos || []).find(
          (v: LearningVideoWithProgress) => v.id === videoId
        )
        if (cancelled) return
        if (!found) {
          setNotFound(true)
        } else {
          setVideo(found)
          setLiveProgress(found.my_progress_percent || 0)
          setLiveCompleted(found.my_completed || false)
        }
      } catch (err) {
        console.error('[PortalLearningWatch] 取得エラー:', err)
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [videoId])

  return (
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-6 space-y-4">
      <Link
        href="/portal/learning"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors no-underline"
      >
        <ChevronLeft size={16} />
        ラーニング一覧へ戻る
      </Link>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="w-full rounded-xl" style={{ aspectRatio: '16 / 9' }} />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : notFound || !video ? (
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-10 text-center">
            <p className="text-muted-foreground text-sm m-0">動画が見つかりませんでした</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* プレイヤー */}
          <YouTubePlayer
            youtubeVideoId={video.youtube_video_id}
            dbVideoId={video.id}
            durationKnown={!!video.duration_seconds}
            onProgress={(p, c) => {
              setLiveProgress((prev) => Math.max(prev, p))
              if (c) setLiveCompleted(true)
            }}
          />

          {/* タイトル・進捗・カテゴリ */}
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-lg font-bold text-foreground leading-snug m-0">{video.title}</h1>
              {liveCompleted ? (
                <Badge variant="secondary" className="shrink-0 text-[11px] px-2 py-0.5 bg-green-50 text-green-600 gap-1">
                  <CheckCircle2 size={12} />
                  完了
                </Badge>
              ) : liveProgress > 0 ? (
                <Badge variant="secondary" className="shrink-0 text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 gap-1">
                  <PlayCircle size={12} />
                  {liveProgress}%
                </Badge>
              ) : null}
            </div>
            {video.category && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700">
                {video.category}
              </Badge>
            )}
          </div>

          {/* 説明 */}
          {video.description && (
            <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
              <CardContent className="p-5">
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap m-0">
                  {video.description}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
