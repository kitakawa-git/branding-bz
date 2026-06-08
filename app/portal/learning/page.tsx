'use client'

// ポータル ラーニング一覧: 公開動画のサムネ一覧。カテゴリ絞り込み＋自分の進捗バッジ。
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { GraduationCap, PlayCircle, CheckCircle2, Youtube } from 'lucide-react'
import type { LearningVideoWithProgress } from '@/lib/types/learning'

function ProgressBadge({ video }: { video: LearningVideoWithProgress }) {
  if (video.my_completed) {
    return (
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-50 text-green-600 gap-1">
        <CheckCircle2 size={14} />
        完了
      </Badge>
    )
  }
  if (video.my_progress_percent > 0) {
    return (
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 gap-1">
        <PlayCircle size={14} />
        視聴中 {video.my_progress_percent}%
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-500">
      未視聴
    </Badge>
  )
}

export default function PortalLearningPage() {
  const [videos, setVideos] = useState<LearningVideoWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/learning/videos?published=true')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!cancelled) setVideos(data.videos || [])
      } catch (err) {
        console.error('[PortalLearning] 取得エラー:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const categories = useMemo(
    () => Array.from(new Set(videos.map((v) => v.category).filter((c): c is string => !!c))),
    [videos]
  )

  const filtered = useMemo(
    () => (activeCategory ? videos.filter((v) => v.category === activeCategory) : videos),
    [videos, activeCategory]
  )

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-5 pt-4 pb-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (videos.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-5 pt-4 pb-6">
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-10 text-center">
            <div className="mb-3 flex justify-center text-muted-foreground">
              <GraduationCap size={40} strokeWidth={1.5} />
            </div>
            <p className="text-muted-foreground text-sm m-0">公開中の学習動画はまだありません</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-6 space-y-5">
      {/* カテゴリ絞り込み */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={activeCategory === null ? 'default' : 'outline'}
            size="sm"
            className="rounded-full h-8"
            onClick={() => setActiveCategory(null)}
          >
            すべて
          </Button>
          {categories.map((c) => (
            <Button
              key={c}
              variant={activeCategory === c ? 'default' : 'outline'}
              size="sm"
              className="rounded-full h-8"
              onClick={() => setActiveCategory(c)}
            >
              {c}
            </Button>
          ))}
        </div>
      )}

      {/* 動画グリッド */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((video) => (
          <Link
            key={video.id}
            href={`/portal/learning/${video.id}`}
            className="no-underline group"
          >
            <Card className="bg-[hsl(0_0%_97%)] border shadow-none overflow-hidden transition-all hover:shadow-md hover:scale-[1.01]">
              <div className="relative aspect-video bg-muted">
                {video.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <Youtube size={28} />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                  <PlayCircle size={44} className="text-white" strokeWidth={1.5} />
                </div>
              </div>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h3 className="text-sm font-bold text-foreground leading-snug m-0 line-clamp-2">
                    {video.title}
                  </h3>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <ProgressBadge video={video} />
                  {video.category && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700">
                      {video.category}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
