'use client'

// タイムライン ダッシュボード（管理画面）
import { useEffect, useState, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  FileText,
  Users,
  Heart,
  MessageCircle,
  BarChart3,
  PieChart as PieChartIcon,
  Trophy,
  Star,
} from 'lucide-react'

// ============================================
// Types
// ============================================

type PostRow = {
  id: string
  user_id: string
  category: string
  created_at: string
}

type LikeRow = {
  id: string
  post_id: string
  created_at: string
}

type CommentRow = {
  id: string
  created_at: string
}

type MemberRow = {
  id: string
  auth_id: string
  display_name: string
  profile: { name: string; photo_url: string | null } | { name: string; photo_url: string | null }[] | null
}

type RankingItem = {
  userId: string
  name: string
  photoUrl: string | null
  postCount: number
  likeCount: number
}

type StreakItem = {
  userId: string
  name: string
  photoUrl: string | null
  streak: number
}

type MonthlyData = { month: string; label: string; count: number }
type CategoryData = { category: string; count: number }

type PeriodFilter = 'all' | '90d' | '30d' | 'month'

type DashboardCache = {
  posts: PostRow[]
  likes: LikeRow[]
  comments: CommentRow[]
  members: MemberRow[]
  actionGuidelineCategories: string[]
}

// ============================================
// Constants
// ============================================

const CATEGORY_COLORS = [
  '#F87E0C',
  '#A90CF8',
  '#1785F3',
  '#EDD600',
  '#F41189',
  '#47C95C',
]

const trendChartConfig = {
  count: {
    label: '投稿数',
    color: '#1785F3',
  },
} satisfies ChartConfig

const PERIOD_FILTERS: { value: PeriodFilter; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: '90d', label: '90日間' },
  { value: '30d', label: '30日間' },
  { value: 'month', label: '今月' },
]

// ============================================
// Helpers
// ============================================

function calculateMaxStreaks(
  posts: PostRow[],
  ninetyDaysAgo: Date
): Map<string, number> {
  const recentPosts = posts.filter(p => new Date(p.created_at) >= ninetyDaysAgo)

  const userDates = new Map<string, Set<string>>()
  recentPosts.forEach(p => {
    const dateKey = p.created_at.slice(0, 10)
    if (!userDates.has(p.user_id)) userDates.set(p.user_id, new Set())
    userDates.get(p.user_id)!.add(dateKey)
  })

  const maxStreaks = new Map<string, number>()
  userDates.forEach((dateSet, userId) => {
    const dates = [...dateSet].sort()
    let maxStreak = 1
    let currentStreak = 1
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1])
      const curr = new Date(dates[i])
      const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
      if (Math.round(diffDays) === 1) {
        currentStreak++
        maxStreak = Math.max(maxStreak, currentStreak)
      } else {
        currentStreak = 1
      }
    }
    maxStreaks.set(userId, maxStreak)
  })

  return maxStreaks
}

function resolveProfile(member: MemberRow): { name: string; photoUrl: string | null } {
  const raw = member.profile
  const profile = Array.isArray(raw) ? raw[0] ?? null : raw
  return {
    name: profile?.name || member.display_name || '不明',
    photoUrl: profile?.photo_url || null,
  }
}

// ============================================
// Component
// ============================================

const dashboardTabs = [
  { label: 'スコア', href: '/admin/brand-score' },
  { label: 'タイムライン投稿', href: '/admin/dashboard' },
  { label: 'スマート名刺', href: '/admin/analytics' },
]

export default function DashboardPage() {
  const { companyId } = useAuth()
  const pathname = usePathname()
  const cacheKey = `dashboard-v2-${companyId}`
  const cached = companyId ? getPageCache<DashboardCache>(cacheKey) : null
  const [loading, setLoading] = useState(!cached)

  // Period filter
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all')

  // Raw data
  const [rawPosts, setRawPosts] = useState<PostRow[]>(cached?.posts ?? [])
  const [rawLikes, setRawLikes] = useState<LikeRow[]>(cached?.likes ?? [])
  const [rawComments, setRawComments] = useState<CommentRow[]>(cached?.comments ?? [])
  const [rawMembers, setRawMembers] = useState<MemberRow[]>(cached?.members ?? [])
  const [actionGuidelineCategories, setActionGuidelineCategories] = useState<string[]>(cached?.actionGuidelineCategories ?? [])

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<DashboardCache>(cacheKey)) return

    const fetchDashboard = async () => {
      try {
        const [postsRes, likesRes, commentsRes, membersRes, personasRes] = await Promise.allSettled([
          supabase
            .from('timeline_posts')
            .select('id, user_id, category, created_at')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false }),
          supabase
            .from('timeline_likes')
            .select('id, post_id, created_at')
            .eq('company_id', companyId),
          supabase
            .from('timeline_comments')
            .select('id, created_at')
            .eq('company_id', companyId),
          supabase
            .from('members')
            .select('id, auth_id, display_name, profile:profiles(name, photo_url)')
            .eq('company_id', companyId)
            .eq('is_active', true),
          supabase
            .from('brand_personas')
            .select('action_guidelines')
            .eq('company_id', companyId)
            .order('sort_order')
            .limit(1),
        ])

        const posts: PostRow[] = postsRes.status === 'fulfilled' ? postsRes.value.data || [] : []
        const likes: LikeRow[] = likesRes.status === 'fulfilled' ? likesRes.value.data || [] : []
        const comments: CommentRow[] = commentsRes.status === 'fulfilled' ? commentsRes.value.data || [] : []
        const members: MemberRow[] = membersRes.status === 'fulfilled' ? membersRes.value.data || [] : []
        const personasData = personasRes.status === 'fulfilled' ? personasRes.value.data : null

        const categories: string[] = []
        if (personasData && personasData.length > 0) {
          const guidelines = personasData[0].action_guidelines as { title: string }[] | null
          if (guidelines) guidelines.forEach(g => categories.push(g.title))
        }

        setRawPosts(posts)
        setRawLikes(likes)
        setRawComments(comments)
        setRawMembers(members)
        setActionGuidelineCategories(categories)

        setPageCache(cacheKey, {
          posts,
          likes,
          comments,
          members,
          actionGuidelineCategories: categories,
        })
      } catch (err) {
        console.error('[Dashboard] データ取得エラー:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [companyId, cacheKey])

  // Profile map: auth_id -> {name, photoUrl}
  const profileMap = useMemo(() => {
    const map = new Map<string, { name: string; photoUrl: string | null }>()
    rawMembers.forEach(m => map.set(m.auth_id, resolveProfile(m)))
    return map
  }, [rawMembers])

  // ============================================
  // Computed data (reactive to periodFilter)
  // ============================================

  const {
    periodPosts, postsMoM, utilizationRate, postedUsersCount, totalMembersCount,
    periodLikes, periodComments, monthlyTrendData, categoryData, ranking, streakRanking,
  } = useMemo(() => {
    const now = new Date()

    // --- Period start ---
    let periodStart: Date | null = null
    switch (periodFilter) {
      case 'month':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case '30d':
        periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        periodStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case 'all':
        periodStart = null
        break
    }
    const periodStartISO = periodStart?.toISOString() ?? ''

    // --- Filter by period ---
    const filteredPosts = periodStart
      ? rawPosts.filter(p => p.created_at >= periodStartISO)
      : rawPosts
    const filteredLikes = periodStart
      ? rawLikes.filter(l => l.created_at >= periodStartISO)
      : rawLikes
    const filteredComments = periodStart
      ? rawComments.filter(c => c.created_at >= periodStartISO)
      : rawComments

    // --- Summary ---
    const periodPosts = filteredPosts.length
    const periodLikes = filteredLikes.length
    const periodComments = filteredComments.length

    // MoM（「今月」選択時のみ）
    let postsMoM: number | null = null
    if (periodFilter === 'month') {
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
      const prevStartISO = prevMonthStart.toISOString()
      const prevEndISO = prevMonthEnd.toISOString()
      const prevMonthPosts = rawPosts.filter(p => p.created_at >= prevStartISO && p.created_at <= prevEndISO)
      postsMoM = prevMonthPosts.length > 0
        ? ((periodPosts - prevMonthPosts.length) / prevMonthPosts.length) * 100
        : null
    }

    // --- Utilization ---
    const postedUserIds = new Set(filteredPosts.map(p => p.user_id))
    const totalMembersCount = rawMembers.length
    const postedUsersCount = postedUserIds.size
    const utilizationRate = totalMembersCount > 0 ? (postedUsersCount / totalMembersCount) * 100 : 0

    // --- Monthly Trend (always 6 months, unaffected by filter) ---
    const monthlyMap = new Map<string, number>()
    const monthLabels = new Map<string, string>()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthlyMap.set(key, 0)
      monthLabels.set(key, `${d.getMonth() + 1}月`)
    }
    rawPosts.forEach(p => {
      const d = new Date(p.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (monthlyMap.has(key)) monthlyMap.set(key, monthlyMap.get(key)! + 1)
    })
    const monthlyTrendData: MonthlyData[] = []
    monthlyMap.forEach((count, month) => {
      monthlyTrendData.push({ month, label: monthLabels.get(month) || month, count })
    })

    // --- Category Distribution (filtered) ---
    const catMap = new Map<string, number>()
    actionGuidelineCategories.forEach(cat => catMap.set(cat, 0))
    filteredPosts.forEach(p => catMap.set(p.category, (catMap.get(p.category) || 0) + 1))
    const categoryData: CategoryData[] = []
    catMap.forEach((count, category) => categoryData.push({ category, count }))
    categoryData.sort((a, b) => b.count - a.count)

    // --- Individual Ranking (filtered) ---
    const userPostCount = new Map<string, number>()
    filteredPosts.forEach(p => userPostCount.set(p.user_id, (userPostCount.get(p.user_id) || 0) + 1))

    const postOwnerMap = new Map<string, string>()
    rawPosts.forEach(p => postOwnerMap.set(p.id, p.user_id))

    const userLikeReceived = new Map<string, number>()
    filteredLikes.forEach(l => {
      const ownerId = postOwnerMap.get(l.post_id)
      if (ownerId) userLikeReceived.set(ownerId, (userLikeReceived.get(ownerId) || 0) + 1)
    })

    const allUserIds = new Set([...userPostCount.keys(), ...userLikeReceived.keys()])
    const ranking: RankingItem[] = [...allUserIds].map(uid => ({
      userId: uid,
      name: profileMap.get(uid)?.name || '不明',
      photoUrl: profileMap.get(uid)?.photoUrl || null,
      postCount: userPostCount.get(uid) || 0,
      likeCount: userLikeReceived.get(uid) || 0,
    }))
    ranking.sort((a, b) => (b.postCount + b.likeCount) - (a.postCount + a.likeCount))

    // --- Streak Ranking (always 90 days, unaffected by filter) ---
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    const maxStreaks = calculateMaxStreaks(rawPosts, ninetyDaysAgo)
    const streakRanking: StreakItem[] = [...maxStreaks.entries()]
      .map(([userId, streak]) => ({
        userId,
        name: profileMap.get(userId)?.name || '不明',
        photoUrl: profileMap.get(userId)?.photoUrl || null,
        streak,
      }))
      .sort((a, b) => b.streak - a.streak)
      .slice(0, 5)

    return {
      periodPosts, postsMoM, utilizationRate, postedUsersCount, totalMembersCount,
      periodLikes, periodComments, monthlyTrendData, categoryData,
      ranking: ranking.slice(0, 10), streakRanking,
    }
  }, [rawPosts, rawLikes, rawComments, rawMembers, actionGuidelineCategories, periodFilter, profileMap])

  // Period label for card titles
  const periodLabel = periodFilter === 'month' ? '今月の'
    : periodFilter === '30d' ? '30日間の'
    : periodFilter === '90d' ? '90日間の'
    : ''

  // ============================================
  // Render
  // ============================================

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
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-9 w-16 mx-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5">
              <Skeleton className="h-4 w-40 mb-4" />
              <Skeleton className="h-48 w-full rounded-lg" />
            </CardContent>
          </Card>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5">
              <Skeleton className="h-4 w-36 mb-4" />
              <Skeleton className="h-48 w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <Skeleton className="h-4 w-32 mb-4" />
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

  // Dynamic chart config for categories
  const categoryChartConfig: ChartConfig = {}
  categoryData.forEach((item, i) => {
    categoryChartConfig[item.category] = {
      label: item.category,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }
  })

  const utilizationChartConfig = {
    active: { label: '利用中', color: '#47C95C' },
    inactive: { label: '未利用', color: 'hsl(215, 20%, 90%)' },
  } satisfies ChartConfig

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

      {/* === 期間フィルター === */}
      <div className="flex gap-2 mb-4">
        {PERIOD_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setPeriodFilter(f.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              periodFilter === f.value
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* === サマリーカード === */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 mb-3">
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={18} className="text-foreground" />
              <h3 className="text-sm font-semibold text-foreground m-0">{periodLabel}投稿数</h3>
            </div>
            <p className="text-3xl font-bold text-foreground m-0 text-center">
              {periodPosts.toLocaleString()}
            </p>
            {postsMoM !== null && (
              <p className={`text-xs font-medium mt-1 text-center ${postsMoM >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {postsMoM >= 0 ? '↑' : '↓'} {Math.abs(postsMoM).toFixed(1)}% 前月比
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <Users size={18} className="text-foreground" />
              <h3 className="text-sm font-semibold text-foreground m-0">利用率</h3>
            </div>
            <p className="text-3xl font-bold text-foreground m-0 text-center">
              {utilizationRate.toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1 text-center">
              {postedUsersCount}/{totalMembersCount}人
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <Heart size={18} className="text-foreground" />
              <h3 className="text-sm font-semibold text-foreground m-0">{periodLabel}いいね</h3>
            </div>
            <p className="text-3xl font-bold text-foreground m-0 text-center">
              {periodLikes.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle size={18} className="text-foreground" />
              <h3 className="text-sm font-semibold text-foreground m-0">{periodLabel}コメント</h3>
            </div>
            <p className="text-3xl font-bold text-foreground m-0 text-center">
              {periodComments.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* === 月別投稿数の推移 === */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-3">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={18} className="text-foreground" />
            <h3 className="text-sm font-semibold text-foreground m-0">月別投稿数の推移</h3>
          </div>
          {monthlyTrendData.every(d => d.count === 0) ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              まだ投稿データがありません
            </p>
          ) : (
            <ChartContainer config={trendChartConfig} className="aspect-auto h-[250px] w-full">
              <BarChart
                data={monthlyTrendData}
                margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
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
                      labelFormatter={(_, payload) => {
                        if (payload && payload.length > 0) {
                          const item = payload[0].payload as MonthlyData
                          const [y, m] = item.month.split('-')
                          return `${y}年${parseInt(m)}月`
                        }
                        return String(_)
                      }}
                    />
                  }
                />
                <Bar
                  dataKey="count"
                  fill="var(--color-count)"
                  radius={[4, 4, 0, 0]}
                  barSize={32}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* === カテゴリ分布 + 利用率 === */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(360px,1fr))] gap-3 mb-3">
        {/* カテゴリ分布 */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <PieChartIcon size={18} className="text-foreground" />
              <h3 className="text-sm font-semibold text-foreground m-0">行動指針別の投稿数</h3>
            </div>
            {categoryData.length === 0 || categoryData.every(d => d.count === 0) ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                まだ投稿データがありません
              </p>
            ) : (
              <div>
                <ChartContainer config={categoryChartConfig} className="aspect-square h-[220px] w-full">
                  <PieChart>
                    <Pie
                      data={categoryData.filter(d => d.count > 0)}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="count"
                      nameKey="category"
                      label={({ category, count }) => `${category}: ${count}`}
                      labelLine={false}
                    >
                      {categoryData.filter(d => d.count > 0).map((_, i) => (
                        <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
                <div className="flex flex-wrap gap-3 mt-4 justify-center">
                  {categoryData.filter(d => d.count > 0).map((item, i) => (
                    <div key={item.category} className="flex items-center gap-1.5 text-xs">
                      <div
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                      />
                      <span className="text-muted-foreground">{item.category}</span>
                      <span className="font-semibold text-foreground">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 利用率ドーナツ */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users size={18} className="text-foreground" />
              <h3 className="text-sm font-semibold text-foreground m-0">利用率</h3>
            </div>
            <div className="relative">
              <ChartContainer config={utilizationChartConfig} className="aspect-square h-[220px] w-full">
                <PieChart>
                  <Pie
                    data={[
                      { name: '利用中', value: postedUsersCount },
                      { name: '未利用', value: Math.max(0, totalMembersCount - postedUsersCount) },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                  >
                    <Cell fill="#47C95C" />
                    <Cell fill="hsl(215, 20%, 90%)" />
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-3xl font-bold text-foreground">{utilizationRate.toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground">{postedUsersCount}/{totalMembersCount}人</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* === 個人別投稿ランキング + ストリーク === */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(360px,1fr))] gap-3">
        {/* 個人別ランキング */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Trophy size={18} className="text-foreground" />
              <h3 className="text-sm font-semibold text-foreground m-0">個人投稿数ランキング</h3>
            </div>
            {ranking.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                まだ投稿データがありません
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>名前</TableHead>
                    <TableHead className="text-right w-20">投稿</TableHead>
                    <TableHead className="text-right w-20">いいね</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranking.map((item, i) => (
                    <TableRow key={item.userId}>
                      <TableCell
                        className="font-bold text-foreground"
                      >
                        {i + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-7 shrink-0">
                            {item.photoUrl && <AvatarImage src={item.photoUrl} alt={item.name} />}
                            <AvatarFallback className="text-[10px]">
                              {item.name.slice(0, 1)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{item.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground">
                        {item.postCount}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground">
                        {item.likeCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 連続投稿ランキング */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Star size={18} className="text-foreground" />
              <h3 className="text-sm font-semibold text-foreground m-0">連続投稿ランキング</h3>
            </div>
            {streakRanking.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                まだ投稿データがありません
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {streakRanking.map((item, i) => {
                  const maxStreak = streakRanking[0]?.streak || 1
                  const barWidth = (item.streak / maxStreak) * 100
                  return (
                    <div key={item.userId}>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block w-6 font-bold text-sm text-foreground"
                          >
                            {i + 1}.
                          </span>
                          <Avatar className="size-6 shrink-0">
                            {item.photoUrl && <AvatarImage src={item.photoUrl} alt={item.name} />}
                            <AvatarFallback className="text-[9px]">
                              {item.name.slice(0, 1)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-foreground">{item.name}</span>
                        </div>
                        <span className="text-sm font-bold text-foreground">
                          {item.streak}日
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded overflow-hidden ml-8">
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
      </div>
    </div>
  )
}
