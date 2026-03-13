'use client'

// アクセス解析ページ
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Eye, CalendarDays, CalendarClock, BarChart3, Trophy, Clock } from 'lucide-react'

type ViewRecord = {
  id: string
  profile_id: string
  viewed_at: string
  ip_address: string | null
  country: string | null
  city: string | null
  profiles: {
    name: string
    slug: string
  } | null
}

type MemberRanking = {
  name: string
  slug: string
  count: number
}

type DailyCount = {
  date: string
  count: number
}

type AnalyticsCache = {
  totalViews: number
  monthViews: number
  weekViews: number
  ranking: MemberRanking[]
  dailyCounts: DailyCount[]
  recentViews: ViewRecord[]
}

const chartConfig = {
  count: {
    label: 'アクセス数',
    color: '#1785F3',
  },
} satisfies ChartConfig

const dashboardTabs = [
  { label: 'スコア', href: '/admin/brand-score' },
  { label: 'タイムライン投稿', href: '/admin/dashboard' },
  { label: 'スマート名刺', href: '/admin/analytics' },
]

export default function AnalyticsPage() {
  const { companyId } = useAuth()
  const pathname = usePathname()
  const cacheKey = `analytics-${companyId}`
  const cached = companyId ? getPageCache<AnalyticsCache>(cacheKey) : null
  const [loading, setLoading] = useState(!cached)
  const [totalViews, setTotalViews] = useState(cached?.totalViews ?? 0)
  const [monthViews, setMonthViews] = useState(cached?.monthViews ?? 0)
  const [weekViews, setWeekViews] = useState(cached?.weekViews ?? 0)
  const [ranking, setRanking] = useState<MemberRanking[]>(cached?.ranking ?? [])
  const [dailyCounts, setDailyCounts] = useState<DailyCount[]>(cached?.dailyCounts ?? [])
  const [recentViews, setRecentViews] = useState<ViewRecord[]>(cached?.recentViews ?? [])

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<AnalyticsCache>(cacheKey)) return

    const fetchAnalytics = async () => {
      try {
        // まず自社の社員IDを取得
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, slug')
          .eq('company_id', companyId)

        if (!profiles || profiles.length === 0) {
          setLoading(false)
          return
        }

        const profileIds = profiles.map(p => p.id)
        const profileMap = new Map(profiles.map(p => [p.id, p]))

        // 全アクセスデータ取得
        const { data: allViews } = await supabase
          .from('card_views')
          .select('id, profile_id, viewed_at, ip_address, country, city')
          .in('profile_id', profileIds)
          .order('viewed_at', { ascending: false })

        const views = allViews || []

        // 総閲覧数
        const computedTotalViews = views.length
        setTotalViews(computedTotalViews)

        // 今月の閲覧数
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        const computedMonthViews = views.filter(v => v.viewed_at >= monthStart).length
        setMonthViews(computedMonthViews)

        // 今週の閲覧数（月曜始まり）
        const today = new Date()
        const dayOfWeek = today.getDay()
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - diff)
        weekStart.setHours(0, 0, 0, 0)
        const computedWeekViews = views.filter(v => new Date(v.viewed_at) >= weekStart).length
        setWeekViews(computedWeekViews)

        // 社員別ランキング
        const countByProfile = new Map<string, number>()
        views.forEach(v => {
          countByProfile.set(v.profile_id, (countByProfile.get(v.profile_id) || 0) + 1)
        })
        const rankingData: MemberRanking[] = []
        countByProfile.forEach((count, profileId) => {
          const p = profileMap.get(profileId)
          if (p) {
            rankingData.push({ name: p.name, slug: p.slug, count })
          }
        })
        rankingData.sort((a, b) => b.count - a.count)
        setRanking(rankingData)

        // 日別推移（過去30日）
        const dailyMap = new Map<string, number>()
        for (let i = 29; i >= 0; i--) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          const key = d.toISOString().slice(0, 10) // YYYY-MM-DD
          dailyMap.set(key, 0)
        }
        views.forEach(v => {
          const key = v.viewed_at.slice(0, 10)
          if (dailyMap.has(key)) {
            dailyMap.set(key, dailyMap.get(key)! + 1)
          }
        })
        const dailyData: DailyCount[] = []
        dailyMap.forEach((count, date) => {
          dailyData.push({ date, count })
        })
        setDailyCounts(dailyData)

        // 最近のアクセス（10件）
        const recentData = views.slice(0, 10).map(v => ({
          ...v,
          profiles: profileMap.get(v.profile_id)
            ? { name: profileMap.get(v.profile_id)!.name, slug: profileMap.get(v.profile_id)!.slug }
            : null,
        }))
        setRecentViews(recentData)

        setPageCache(cacheKey, {
          totalViews: computedTotalViews,
          monthViews: computedMonthViews,
          weekViews: computedWeekViews,
          ranking: rankingData,
          dailyCounts: dailyData,
          recentViews: recentData,
        })
      } catch (err) {
        console.error('[Analytics] データ取得エラー:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [companyId, cacheKey])

  if (loading) {
    return (
      <div>
        <div className="flex gap-6 border-b mb-6">
          <Skeleton className="h-5 w-32 mb-2" />
          <Skeleton className="h-5 w-28 mb-2" />
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 mb-3">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="bg-[hsl(0_0%_97%)] border shadow-none">
              <CardContent className="p-5 pb-3">
                <div className="flex items-center gap-2 mb-3">
                  <Skeleton className="size-[18px] rounded" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-9 w-16 mx-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-3">
          <CardContent className="p-5">
            <Skeleton className="h-4 w-36 mb-4" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </CardContent>
        </Card>
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <Skeleton className="h-4 w-28 mb-4" />
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                <Skeleton className="h-4 w-6" />
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-4 w-28 flex-1" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <div className="flex gap-6 border-b mb-6">
        {dashboardTabs.map(tab => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`pb-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              pathname === tab.href
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* === 全体サマリー === */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 mb-3">
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <Eye size={18} className="text-foreground" />
              <h3 className="text-sm font-semibold text-foreground m-0">総閲覧数</h3>
            </div>
            <p className="text-3xl font-bold text-foreground m-0 text-center">
              {totalViews.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays size={18} className="text-foreground" />
              <h3 className="text-sm font-semibold text-foreground m-0">今月の閲覧数</h3>
            </div>
            <p className="text-3xl font-bold text-foreground m-0 text-center">
              {monthViews.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock size={18} className="text-foreground" />
              <h3 className="text-sm font-semibold text-foreground m-0">今週の閲覧数</h3>
            </div>
            <p className="text-3xl font-bold text-foreground m-0 text-center">
              {weekViews.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* === 日別推移（過去30日） === */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-3">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={18} className="text-foreground" />
            <h3 className="text-sm font-semibold text-foreground m-0">日別推移</h3>
          </div>
          <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
            <BarChart
              data={dailyCounts}
              margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={(value: string) => {
                  const [, m, d] = value.split('-')
                  return `${parseInt(m)}/${parseInt(d)}`
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                allowDecimals={false}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => {
                      const str = String(value)
                      const [y, m, d] = str.split('-')
                      return `${y}年${parseInt(m)}月${parseInt(d)}日`
                    }}
                  />
                }
              />
              <Bar
                dataKey="count"
                fill="var(--color-count)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* 2カラム: ランキング + 最近のアクセス */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(360px,1fr))] gap-3">
        {/* === 社員別ランキング === */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Trophy size={18} className="text-foreground" />
              <h3 className="text-sm font-semibold text-foreground m-0">アクセスランキング</h3>
            </div>
            {ranking.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                まだアクセスデータがありません
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {ranking.map((member, i) => {
                  const maxCount = ranking[0]?.count || 1
                  const barWidth = (member.count / maxCount) * 100
                  return (
                    <div key={member.slug}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-foreground">
                          <span
                            className="inline-block w-6 font-bold text-foreground"
                          >
                            {i + 1}.
                          </span>
                          {member.name}
                        </span>
                        <span className="text-sm font-bold text-foreground">
                          {member.count}件
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded overflow-hidden">
                        <div
                          className="h-full rounded transition-[width] duration-500"
                          style={{
                            width: `${barWidth}%`,
                            backgroundColor: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : '#2563eb',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* === 最近のアクセス === */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={18} className="text-foreground" />
              <h3 className="text-sm font-semibold text-foreground m-0">最近のアクセス</h3>
            </div>
            {recentViews.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                まだアクセスデータがありません
              </p>
            ) : (
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">日時</th>
                    <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">名前</th>
                    <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">地域</th>
                  </tr>
                </thead>
                <tbody>
                  {recentViews.map((view) => {
                    const dt = new Date(view.viewed_at)
                    const dateStr = `${(dt.getMonth() + 1).toString().padStart(2, '0')}/${dt.getDate().toString().padStart(2, '0')} ${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`
                    const location = [view.city, view.country].filter(Boolean).join(', ') || '—'
                    return (
                      <tr key={view.id}>
                        <td className="px-4 py-3 border-b border-border text-foreground whitespace-nowrap text-xs">
                          {dateStr}
                        </td>
                        <td className="px-4 py-3 border-b border-border text-foreground font-semibold">
                          {view.profiles?.name || '—'}
                        </td>
                        <td className="px-4 py-3 border-b border-border text-muted-foreground text-xs">
                          {location}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
