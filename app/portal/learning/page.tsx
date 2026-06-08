'use client'

// ポータル ラーニング一覧: カテゴリー > テーマ > 動画 の階層表示。
// 各テーマに「○本」バッジ、各動画に自分の進捗バッジ。未分類の公開動画は末尾「その他」。
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { GraduationCap, PlayCircle, CheckCircle2, Youtube, FolderOpen } from 'lucide-react'
import type { LearningVideoWithProgress } from '@/lib/types/learning'

type ThemeNode = {
  id: string
  name: string
  description: string | null
  video_count: number
  videos: LearningVideoWithProgress[]
}
type CategoryNode = { id: string; name: string; themes: ThemeNode[] }
type Structure = { categories: CategoryNode[]; uncategorized: LearningVideoWithProgress[] }

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

function VideoCard({ video }: { video: LearningVideoWithProgress }) {
  return (
    <Link key={video.id} href={`/portal/learning/${video.id}`} className="no-underline group">
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
          <h3 className="text-sm font-bold text-foreground leading-snug m-0 line-clamp-2 mb-1.5">{video.title}</h3>
          <ProgressBadge video={video} />
        </CardContent>
      </Card>
    </Link>
  )
}

export default function PortalLearningPage() {
  const [structure, setStructure] = useState<Structure | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/learning/structure?published=true')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!cancelled) setStructure({ categories: data.categories || [], uncategorized: data.uncategorized || [] })
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

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-5 pt-4 pb-10 space-y-6">
        <Skeleton className="h-5 w-40" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const hasContent =
    structure && (structure.categories.length > 0 || structure.uncategorized.length > 0)

  if (!hasContent) {
    return (
      <div className="max-w-4xl mx-auto px-5 pt-4 pb-10">
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
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-10 space-y-8">
      {/* カテゴリー > テーマ > 動画 */}
      {structure!.categories.map((cat) => (
        <section key={cat.id} className="space-y-4">
          <div className="flex items-center gap-2 border-b pb-2">
            <FolderOpen size={18} className="text-foreground" />
            <h2 className="text-base font-bold text-foreground m-0">{cat.name}</h2>
          </div>
          {cat.themes.map((theme) => (
            <div key={theme.id} className="space-y-2">
              <div className="flex items-baseline gap-2">
                <h3 className="text-sm font-bold text-foreground m-0">{theme.name}</h3>
                <span className="text-xs font-semibold text-muted-foreground">{theme.video_count}本</span>
              </div>
              {theme.description && (
                <p className="text-xs text-muted-foreground m-0 leading-relaxed">{theme.description}</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {theme.videos.map((v) => (
                  <VideoCard key={v.id} video={v} />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}

      {/* 未分類（その他） */}
      {structure!.uncategorized.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b pb-2">
            <FolderOpen size={18} className="text-muted-foreground" />
            <h2 className="text-base font-bold text-muted-foreground m-0">その他</h2>
            <span className="text-xs font-semibold text-muted-foreground">{structure!.uncategorized.length}本</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {structure!.uncategorized.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
