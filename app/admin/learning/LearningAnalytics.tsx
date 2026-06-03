'use client'

// ラーニング 視聴分析タブ
// 動画別カード（視聴人数 / 完了率 / 平均進捗 / 総再生回数）＋ 完了率バー（recharts）
// メンバー別マトリクス（メンバー × 動画：最大進捗％・完了マーク・最終視聴日時）
import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Users, CheckCircle2, BarChart3, PlayCircle } from 'lucide-react'
import type { LearningAnalytics as Analytics } from '@/lib/types/learning'

const chartConfig = {
  completion_rate: { label: '完了率', color: '#1785F3' },
} satisfies ChartConfig

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export function LearningAnalytics() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/learning/analytics')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as Analytics
        if (!cancelled) setData(json)
      } catch (err) {
        console.error('[LearningAnalytics] 取得エラー:', err)
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
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!data || data.videos.length === 0) {
    return (
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-10 text-center">
          <p className="text-muted-foreground text-sm">分析できる動画がまだありません</p>
        </CardContent>
      </Card>
    )
  }

  const chartData = data.videos.map((v) => ({
    label: v.title.length > 14 ? v.title.slice(0, 14) + '…' : v.title,
    completion_rate: v.completion_rate,
  }))

  return (
    <div className="space-y-6">
      {/* 動画別カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.videos.map((v) => (
          <Card key={v.video_id} className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <h3 className="text-sm font-bold text-foreground leading-snug m-0">{v.title}</h3>
                <Badge
                  variant="secondary"
                  className={`shrink-0 text-[10px] px-1.5 py-0 ${
                    v.is_published ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                  }`}
                >
                  {v.is_published ? '公開' : '非公開'}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-muted-foreground shrink-0" />
                  <div className="leading-tight">
                    <div className="text-base font-bold text-foreground">{v.viewer_count}</div>
                    <div className="text-[10px] text-muted-foreground">視聴人数</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-muted-foreground shrink-0" />
                  <div className="leading-tight">
                    <div className="text-base font-bold text-foreground">
                      {v.completion_rate}
                      <span className="text-xs font-normal">%</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">完了率（{v.completed_count}人）</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <BarChart3 size={16} className="text-muted-foreground shrink-0" />
                  <div className="leading-tight">
                    <div className="text-base font-bold text-foreground">
                      {v.avg_progress}
                      <span className="text-xs font-normal">%</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">平均進捗</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <PlayCircle size={16} className="text-muted-foreground shrink-0" />
                  <div className="leading-tight">
                    <div className="text-base font-bold text-foreground">{v.total_view_count}</div>
                    <div className="text-[10px] text-muted-foreground">総再生回数</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 完了率バー */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={18} className="text-foreground" />
            <h3 className="text-sm font-semibold text-foreground m-0">動画別 完了率</h3>
          </div>
          <ChartContainer config={chartConfig} className="aspect-auto h-[260px] w-full">
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} domain={[0, 100]} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="completion_rate" fill="var(--color-completion_rate)" radius={[4, 4, 0, 0]} barSize={36} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* メンバー別マトリクス */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-0">
          <div className="px-5 pt-5 pb-3">
            <h3 className="text-sm font-semibold text-foreground m-0">メンバー別 視聴状況</h3>
            <p className="text-[11px] text-muted-foreground mt-1 m-0">
              各セル＝最大到達度。チェックは完了。括弧内は最終視聴日。
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium sticky left-0 bg-[hsl(0_0%_97%)]">メンバー</th>
                  {data.videoHeaders.map((h) => (
                    <th key={h.id} className="px-3 py-3 font-medium whitespace-nowrap">
                      {h.title.length > 12 ? h.title.slice(0, 12) + '…' : h.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.members.map((m) => (
                  <tr key={m.profile_id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-foreground sticky left-0 bg-[hsl(0_0%_97%)]">
                      {m.name}
                    </td>
                    {m.cells.map((c) => (
                      <td key={c.video_id} className="px-3 py-3">
                        {c.view_count === 0 ? (
                          <span className="text-xs text-muted-foreground/50">未視聴</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {c.completed ? (
                              <CheckCircle2 size={14} className="text-green-600 shrink-0" />
                            ) : null}
                            <span
                              className={`text-xs font-semibold ${
                                c.completed ? 'text-green-600' : 'text-foreground'
                              }`}
                            >
                              {c.max_progress_percent}%
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              ({formatDate(c.last_viewed_at)})
                            </span>
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
