'use client'

// ポータルダッシュボード: ミッション + KPI + 個人サマリー + 投稿フィード
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { usePortalAuth } from './components/PortalAuthProvider'
import { getRelativeTime } from '@/lib/time-utils'
import { PieChart, Pie, Cell } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import {
  type ChartConfig,
  ChartContainer,
} from '@/components/ui/chart'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { toast } from 'sonner'
import {
  FileText,
  Heart,
  Star,
  ArrowRight,
  MessageCircle,
  PieChart as PieChartIcon,
  PenSquare,
  Users,
  Bell,
  Target,
} from 'lucide-react'

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

// ============================================
// Types
// ============================================

type StatsPeriod = 'month' | '30d' | '90d' | 'all'

type UserPostRaw = {
  id: string
  category: string
  created_at: string
}

type PersonalStats = {
  monthlyPosts: number
  monthlyLikesReceived: number
  currentStreak: number
  categoryDistribution: { category: string; count: number }[]
}

type DashboardPost = {
  id: string
  content: string
  category: string
  created_at: string
  is_anonymous: boolean
  like_count: number
  comment_count: number
  display_name: string | null
}

// ============================================
// Helpers
// ============================================

function calculateCurrentStreak(posts: { created_at: string }[]): number {
  const dateSet = new Set(posts.map(p => p.created_at.slice(0, 10)))
  const sortedDates = [...dateSet].sort().reverse()

  if (sortedDates.length === 0) return 0

  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  if (sortedDates[0] !== today && sortedDates[0] !== yesterday) return 0

  let streak = 1
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1])
    const curr = new Date(sortedDates[i])
    const diffDays = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24)
    if (Math.round(diffDays) === 1) {
      streak++
    } else {
      break
    }
  }
  return streak
}

// ============================================
// Sub-component: DashboardPostCard
// ============================================

function DashboardPostCard({
  post,
  showAuthor,
}: {
  post: DashboardPost
  showAuthor?: boolean
}) {
  return (
    <Link href="/portal/timeline" className="no-underline block">
      <Card className="border shadow-none hover:shadow-sm transition-shadow">
        <CardContent className="p-3">
          {showAuthor && !post.is_anonymous && post.display_name && (
            <p className="text-xs font-semibold text-foreground mb-1 m-0">
              {post.display_name}
            </p>
          )}
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {post.category}
            </Badge>
            <span
              className="text-[11px] text-muted-foreground"
              suppressHydrationWarning
            >
              {getRelativeTime(post.created_at)}
            </span>
          </div>
          <p className="text-sm text-foreground line-clamp-2 m-0 whitespace-pre-wrap">
            {post.content}
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Heart
                size={12}
                className={post.like_count > 0 ? 'text-red-500' : ''}
              />
              {post.like_count > 0 && post.like_count}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle size={12} />
              {post.comment_count > 0 && post.comment_count}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

// ============================================
// Main Component
// ============================================

type AnnouncementSummary = {
  id: string
  title: string
  category: string
  created_at: string
  content: string
}

const ANNOUNCEMENT_CATEGORY_COLORS: Record<string, string> = {
  '重要': 'bg-red-100 text-red-700',
  'イベント': 'bg-blue-100 text-blue-700',
  '更新': 'bg-green-100 text-green-700',
  'その他': 'bg-gray-100 text-gray-700',
}

type KpiItemSummary = {
  id: string
  title: string
  progress: number
  weight: number
  status: string
  deadline: string | null
}

type DashboardCache = {
  mission: string | null
  personalStats: PersonalStats | null
  allUserPostsRaw: UserPostRaw[]
  allLikePostIds: string[]
  myRecentPosts: DashboardPost[]
  companyRecentPosts: DashboardPost[]
  latestAnnouncements: AnnouncementSummary[]
  kpiGoals: KpiItemSummary[]
  hasGoals: boolean
  goalTitle: string | null
  goalPeriodType: string | null
  showGoalBanner: boolean
  showReviewBanner: boolean
}

export default function PortalTopPage() {
  const { companyId, user, member, slogan } = usePortalAuth()
  const cacheKey = `portal-dashboard-${companyId}-${user?.id}`
  const cached = companyId && user?.id ? getPageCache<DashboardCache>(cacheKey) : null
  const [loading, setLoading] = useState(!cached)
  const [mission, setMission] = useState<string | null>(cached?.mission ?? null)
  const [personalStats, setPersonalStats] = useState<PersonalStats | null>(cached?.personalStats ?? null)
  const [allUserPostsRaw, setAllUserPostsRaw] = useState<UserPostRaw[]>(cached?.allUserPostsRaw ?? [])
  const [allLikePostIds, setAllLikePostIds] = useState<string[]>(cached?.allLikePostIds ?? [])
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>('all')
  const [myRecentPosts, setMyRecentPosts] = useState<DashboardPost[]>(cached?.myRecentPosts ?? [])
  const [companyRecentPosts, setCompanyRecentPosts] = useState<DashboardPost[]>(cached?.companyRecentPosts ?? [])
  const [latestAnnouncements, setLatestAnnouncements] = useState<AnnouncementSummary[]>(cached?.latestAnnouncements ?? [])
  const [kpiGoals, setKpiGoals] = useState<KpiItemSummary[]>(cached?.kpiGoals ?? [])
  const [hasGoals, setHasGoals] = useState<boolean>(cached?.hasGoals ?? false)
  const [goalTitle, setGoalTitle] = useState<string | null>(cached?.goalTitle ?? null)
  const [goalPeriodType, setGoalPeriodType] = useState<string | null>(cached?.goalPeriodType ?? null)
  const [showGoalBanner, setShowGoalBanner] = useState<boolean>(cached?.showGoalBanner ?? true)
  const [showReviewBanner, setShowReviewBanner] = useState<boolean>(cached?.showReviewBanner ?? true)
  const [chartKey, setChartKey] = useState(0)

  // フィルタ期間に基づく統計計算
  const filteredStats = useMemo(() => {
    let filteredPosts = allUserPostsRaw
    const now = new Date()

    if (statsPeriod === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      filteredPosts = allUserPostsRaw.filter(p => p.created_at >= monthStart)
    } else if (statsPeriod === '30d') {
      const d30ago = new Date(now.getTime() - 30 * 86400000).toISOString()
      filteredPosts = allUserPostsRaw.filter(p => p.created_at >= d30ago)
    } else if (statsPeriod === '90d') {
      const d90ago = new Date(now.getTime() - 90 * 86400000).toISOString()
      filteredPosts = allUserPostsRaw.filter(p => p.created_at >= d90ago)
    }
    // 'all' — フィルタなし

    const filteredPostIds = new Set(filteredPosts.map(p => p.id))
    const filteredLikeCount = allLikePostIds.filter(pid => filteredPostIds.has(pid)).length

    // Category distribution
    const catMap = new Map<string, number>()
    filteredPosts.forEach(p => {
      catMap.set(p.category, (catMap.get(p.category) || 0) + 1)
    })
    const categoryDistribution = [...catMap.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)

    return {
      postCount: filteredPosts.length,
      likeCount: filteredLikeCount,
      categoryDistribution,
    }
  }, [allUserPostsRaw, allLikePostIds, statsPeriod])

  const handlePeriodChange = (period: StatsPeriod) => {
    setStatsPeriod(period)
    setChartKey(prev => prev + 1)
  }

  // 自己評価ポップアップ
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewProgress, setReviewProgress] = useState<Record<string, number>>({})
  const [reviewSaving, setReviewSaving] = useState(false)

  const openReviewDialog = () => {
    const initial: Record<string, number> = {}
    kpiGoals.forEach(k => { initial[k.id] = k.progress })
    setReviewProgress(initial)
    setReviewOpen(true)
  }

  const handleReviewSave = async () => {
    if (!companyId || !user?.id) return
    setReviewSaving(true)
    try {
      const updates = Object.entries(reviewProgress).map(([id, progress]) =>
        supabase.from('goal_kpis').update({ progress, updated_at: new Date().toISOString() }).eq('id', id)
      )
      await Promise.all(updates)
      // ローカルstateを即時更新
      setKpiGoals(prev => prev.map(k => reviewProgress[k.id] !== undefined ? { ...k, progress: reviewProgress[k.id] } : k))
      toast.success('進捗を更新しました')
      setReviewOpen(false)
    } catch {
      toast.error('更新に失敗しました')
    } finally {
      setReviewSaving(false)
    }
  }

  useEffect(() => {
    if (!companyId || !user?.id) {
      setLoading(false)
      return
    }

    const fetchAll = async () => {
      try {
        // === Group 1: base queries (parallel) ===
        const [missionRes, allUserPostsRes, userRecent3Res, companyRecent3Res, announcementsRes, kpiGoalsRes, goalPeriodRes, goalPeriodsRes] =
          await Promise.allSettled([
            supabase
              .from('brand_guidelines')
              .select('mission')
              .eq('company_id', companyId)
              .single(),
            supabase
              .from('timeline_posts')
              .select('id, category, created_at')
              .eq('company_id', companyId)
              .eq('user_id', user.id)
              .order('created_at', { ascending: false }),
            supabase
              .from('timeline_posts')
              .select('id, content, category, created_at, is_anonymous')
              .eq('company_id', companyId)
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(3),
            supabase
              .from('timeline_posts')
              .select('id, user_id, content, category, created_at, is_anonymous')
              .eq('company_id', companyId)
              .order('created_at', { ascending: false })
              .limit(3),
            supabase
              .from('announcements')
              .select('id, title, category, created_at, content')
              .eq('company_id', companyId)
              .eq('is_published', true)
              .order('created_at', { ascending: false })
              .limit(3),
            supabase
              .from('goal_kpis')
              .select('id, goal_id, title, progress, weight, status, deadline')
              .eq('company_id', companyId)
              .eq('user_id', user.id)
              .order('created_at', { ascending: false }),
            supabase
              .from('companies')
              .select('goal_period')
              .eq('id', companyId)
              .single(),
            supabase
              .from('goal_periods')
              .select('id')
              .eq('company_id', companyId)
              .eq('is_current', true)
              .eq('status', 'active')
              .limit(1)
              .maybeSingle(),
          ])

        // Extract results
        const missionData =
          missionRes.status === 'fulfilled' ? missionRes.value.data : null
        if (missionData?.mission) {
          setMission(missionData.mission)
        }

        const allUserPosts: UserPostRaw[] =
          allUserPostsRes.status === 'fulfilled'
            ? (allUserPostsRes.value.data || []) as UserPostRaw[]
            : []
        const myRecentData =
          userRecent3Res.status === 'fulfilled'
            ? userRecent3Res.value.data || []
            : []
        const companyRecentData =
          companyRecent3Res.status === 'fulfilled'
            ? companyRecent3Res.value.data || []
            : []

        // --- Announcements ---
        const latestAnnouncementsData: AnnouncementSummary[] =
          announcementsRes.status === 'fulfilled'
            ? (announcementsRes.value.data || []).map((a: { id: string; title: string; category: string; created_at: string; content: string }) => ({
                id: a.id,
                title: a.title,
                category: a.category,
                created_at: a.created_at,
                content: a.content,
              }))
            : []
        setLatestAnnouncements(latestAnnouncementsData)

        // --- Current period ID ---
        const currentPeriodId = goalPeriodsRes.status === 'fulfilled' ? goalPeriodsRes.value.data?.id || null : null

        // Check if user has any goals (personal_goals) + get title — filtered by current period
        let goalQuery = supabase
          .from('personal_goals')
          .select('id, title')
          .eq('company_id', companyId)
          .eq('user_id', user.id)
        if (currentPeriodId) {
          goalQuery = goalQuery.eq('goal_period_id', currentPeriodId)
        } else {
          goalQuery = goalQuery.is('goal_period_id', null)
        }
        const { data: goalData } = await goalQuery.limit(1).maybeSingle()
        const hasGoalsData = !!goalData
        const goalTitleData = goalData?.title || null
        const currentGoalId = goalData?.id || null
        setHasGoals(hasGoalsData)
        setGoalTitle(goalTitleData)

        // --- KPI Items (from goal_kpis) — filtered to current period's goal ---
        const allKpis = kpiGoalsRes.status === 'fulfilled' ? (kpiGoalsRes.value.data || []) : []
        const kpiGoalsData: KpiItemSummary[] = allKpis
          .filter((g: { goal_id: string }) => !currentGoalId || g.goal_id === currentGoalId)
          .map((g: { id: string; title: string; progress: number; weight: number; status: string; deadline: string | null }) => ({
            id: g.id,
            title: g.title,
            progress: g.progress,
            weight: g.weight,
            status: g.status,
            deadline: g.deadline,
          }))
        setKpiGoals(kpiGoalsData)

        // --- Goal period ---
        const goalPeriodData = goalPeriodRes.status === 'fulfilled' ? goalPeriodRes.value.data?.goal_period : null
        const goalPeriodTypeData = (goalPeriodData as { type?: string } | null)?.type || null
        setGoalPeriodType(goalPeriodTypeData)
        const showGoalBannerData = (goalPeriodData as { show_goal_banner?: boolean } | null)?.show_goal_banner ?? true
        const showReviewBannerData = (goalPeriodData as { show_review_banner?: boolean } | null)?.show_review_banner ?? true
        setShowGoalBanner(showGoalBannerData)
        setShowReviewBanner(showReviewBannerData)

        // --- Personal stats ---
        const currentStreak = calculateCurrentStreak(allUserPosts)

        // Category distribution (全期間)
        const catMap = new Map<string, number>()
        allUserPosts.forEach((p) => {
          catMap.set(p.category, (catMap.get(p.category) || 0) + 1)
        })
        const categoryDistribution = [...catMap.entries()]
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count)

        // 生データを保持（フィルタ切り替え用）
        setAllUserPostsRaw(allUserPosts)

        // === Group 2: dependent queries (parallel) ===
        const myPostIds = allUserPosts.map((p) => p.id)
        const myRecentIds = myRecentData.map((p) => p.id)
        const companyRecentIds = companyRecentData.map((p) => p.id)
        const allRecentIds = [...new Set([...myRecentIds, ...companyRecentIds])]
        const companyUserIds = [
          ...new Set(companyRecentData.map((p) => p.user_id)),
        ]

        const [monthlyLikesRes, recentLikesRes, recentCommentsRes, membersRes] =
          await Promise.allSettled([
            // [0] Likes on my posts (全期間、post_id付き)
            myPostIds.length > 0
              ? supabase
                  .from('timeline_likes')
                  .select('post_id')
                  .in('post_id', myPostIds)
              : Promise.resolve({ data: [] as { post_id: string }[] }),
            // [1] Likes on all recent posts
            allRecentIds.length > 0
              ? supabase
                  .from('timeline_likes')
                  .select('post_id')
                  .in('post_id', allRecentIds)
              : Promise.resolve({ data: [] as { post_id: string }[] }),
            // [2] Comments on all recent posts
            allRecentIds.length > 0
              ? supabase
                  .from('timeline_comments')
                  .select('post_id')
                  .in('post_id', allRecentIds)
              : Promise.resolve({ data: [] as { post_id: string }[] }),
            // [3] Member profiles for company posts
            companyUserIds.length > 0
              ? supabase
                  .from('members')
                  .select('auth_id, display_name, profile:profiles(name)')
                  .in('auth_id', companyUserIds)
                  .eq('company_id', companyId)
              : Promise.resolve({ data: [] as { auth_id: string; display_name: string; profile: { name: string } | { name: string }[] | null }[] }),
          ])

        // Likes received — post_id付きで保持（フィルタ切り替え用）
        let allLikePostIdsData: string[] = []
        if (monthlyLikesRes.status === 'fulfilled') {
          const res = monthlyLikesRes.value as { data: { post_id: string }[] | null }
          allLikePostIdsData = (res.data || []).map(l => l.post_id)
        }
        setAllLikePostIds(allLikePostIdsData)

        const likesReceived = allLikePostIdsData.length

        setPersonalStats({
          monthlyPosts: allUserPosts.length,
          monthlyLikesReceived: likesReceived,
          currentStreak,
          categoryDistribution,
        })

        // Like count map for recent posts
        const likeCountMap = new Map<string, number>()
        if (recentLikesRes.status === 'fulfilled') {
          const res = recentLikesRes.value as {
            data: { post_id: string }[] | null
          }
          res.data?.forEach((l) => {
            likeCountMap.set(l.post_id, (likeCountMap.get(l.post_id) || 0) + 1)
          })
        }

        // Comment count map for recent posts
        const commentCountMap = new Map<string, number>()
        if (recentCommentsRes.status === 'fulfilled') {
          const res = recentCommentsRes.value as {
            data: { post_id: string }[] | null
          }
          res.data?.forEach((c) => {
            commentCountMap.set(
              c.post_id,
              (commentCountMap.get(c.post_id) || 0) + 1
            )
          })
        }

        // Profile map for company posts
        const profileMap = new Map<string, string>()
        if (membersRes.status === 'fulfilled') {
          const res = membersRes.value as {
            data:
              | {
                  auth_id: string
                  display_name: string
                  profile:
                    | { name: string }
                    | { name: string }[]
                    | null
                }[]
              | null
          }
          res.data?.forEach((m) => {
            const profile = Array.isArray(m.profile)
              ? m.profile[0]
              : m.profile
            profileMap.set(
              m.auth_id,
              profile?.name || m.display_name || '不明'
            )
          })
        }

        // Build my recent posts
        const myRecentPostsFinal = myRecentData.map((p) => ({
          id: p.id,
          content: p.content,
          category: p.category,
          created_at: p.created_at,
          is_anonymous: p.is_anonymous ?? false,
          like_count: likeCountMap.get(p.id) || 0,
          comment_count: commentCountMap.get(p.id) || 0,
          display_name: null,
        }))
        setMyRecentPosts(myRecentPostsFinal)

        // Build company recent posts
        const companyRecentPostsFinal = companyRecentData.map((p) => ({
          id: p.id,
          content: p.content,
          category: p.category,
          created_at: p.created_at,
          is_anonymous: p.is_anonymous ?? false,
          like_count: likeCountMap.get(p.id) || 0,
          comment_count: commentCountMap.get(p.id) || 0,
          display_name: profileMap.get(p.user_id) || null,
        }))
        setCompanyRecentPosts(companyRecentPostsFinal)

        // Cache all dashboard data
        setPageCache(cacheKey, {
          mission: missionData?.mission || null,
          personalStats: {
            monthlyPosts: allUserPosts.length,
            monthlyLikesReceived: likesReceived,
            currentStreak,
            categoryDistribution,
          },
          allUserPostsRaw: allUserPosts,
          allLikePostIds: allLikePostIdsData,
          myRecentPosts: myRecentPostsFinal,
          companyRecentPosts: companyRecentPostsFinal,
          latestAnnouncements: latestAnnouncementsData,
          kpiGoals: kpiGoalsData,
          hasGoals: hasGoalsData,
          goalTitle: goalTitleData,
          goalPeriodType: goalPeriodTypeData,
          showGoalBanner: showGoalBannerData,
          showReviewBanner: showReviewBannerData,
        })
      } catch (err) {
        console.error('[PortalTop] データ取得エラー:', err)
      } finally {
        setLoading(false)
        setChartKey(prev => prev + 1)
      }
    }

    fetchAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, user?.id, cacheKey])

  // ============================================
  // Loading state
  // ============================================

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-5 py-10 space-y-6">
        <Skeleton className="h-8 w-48 mx-auto" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-[hsl(0_0%_97%)] border shadow-none">
              <CardContent className="p-4 flex flex-col items-center">
                <Skeleton className="h-4 w-8 mb-2" />
                <Skeleton className="h-8 w-12 mb-1" />
                <Skeleton className="h-3 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  // Chart config for category pie chart (フィルタ済みデータから生成)
  const categoryChartConfig: ChartConfig =
    filteredStats.categoryDistribution.reduce<ChartConfig>((acc, item, i) => {
      acc[item.category] = {
        label: item.category,
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      }
      return acc
    }, {})

  return (
    <div className="max-w-4xl mx-auto px-5 pb-10">
      {/* ===== 1. スローガン ===== */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-foreground">
          {slogan || 'ダッシュボード'}
        </h1>
        {member && (
          <p className="text-sm text-muted-foreground m-0 mt-1">
            ようこそ、{member.display_name} さん
          </p>
        )}
      </div>

      {/* ===== 1.5. 最新のお知らせ ===== */}
      {latestAnnouncements.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-foreground" />
              <h2 className="text-sm font-bold text-foreground tracking-wide m-0">
                最新のお知らせ
              </h2>
            </div>
            <Link
              href="/portal/announcements"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1 no-underline"
            >
              すべて見る <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-2">
            {latestAnnouncements.map(a => (
              <Link key={a.id} href={`/portal/announcements/${a.id}`} className="no-underline block">
                <Card className="border shadow-none hover:shadow-sm transition-shadow">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${ANNOUNCEMENT_CATEGORY_COLORS[a.category] || ANNOUNCEMENT_CATEGORY_COLORS['その他']}`}>
                        {a.category}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground" suppressHydrationWarning>
                        {getRelativeTime(a.created_at)}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-foreground m-0 mb-0.5">
                      {a.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 m-0 whitespace-pre-wrap">
                      {a.content}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ===== 2. ミッションカード ===== */}
      {mission && (
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-6">
          <CardContent className="p-5">
            <Link
              href="/portal/guidelines"
              className="no-underline flex items-center justify-between mb-3"
            >
              <h2 className="text-sm font-bold text-foreground tracking-wide m-0">
                私たちのミッション
              </h2>
              <ArrowRight size={16} className="text-muted-foreground" />
            </Link>
            <p className="text-2xl font-bold text-foreground mb-4 m-0 leading-relaxed">
              {mission}
            </p>
            <p className="text-sm text-foreground/80 leading-[1.8] whitespace-pre-wrap m-0">
              デザインにおいてもブランディングにおいても日々の積み重ねと寄り添う気持ちが大切です。仕事の中での発見を綴り、一日一投稿を心がけましょう！
            </p>
          </CardContent>
        </Card>
      )}

      {/* ===== 2.5. KPIバナー / サマリー ===== */}
      {!hasGoals && showGoalBanner && (
        <Link href="/portal/kpi?setup=true" className="no-underline block mb-8">
          <div className="rounded-full bg-[#F41189] px-6 py-4 flex items-center justify-between hover:opacity-90 transition-opacity">
            <p className="text-white text-base font-semibold m-0">
              {goalPeriodType === 'year' ? '年間' : goalPeriodType === 'half' ? '半年間' : goalPeriodType === 'quarter' ? '３ヶ月間' : ''}目標とKPIを決めましょう！
            </p>
            <ArrowRight size={18} className="text-white shrink-0 ml-3" />
          </div>
        </Link>
      )}
      {hasGoals && (() => {
        const STATUS_LABELS: Record<string, string> = { not_started: '未着手', in_progress: '進行中', completed: '達成' }
        const STATUS_COLORS: Record<string, string> = { not_started: 'bg-gray-100 text-gray-600', in_progress: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700' }
        let totalWeight = 0, weightedSum = 0
        kpiGoals.forEach(k => { const w = k.weight || 0; weightedSum += k.progress * w; totalWeight += w })
        const overallProgress = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0
        const displayKpis = kpiGoals.slice(0, 3)

        return (
          <div className="mb-8">
            <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-foreground tracking-wide m-0">
                    あなたの目標・KPI
                  </h2>
                  <Link href="/portal/kpi" className="text-xs text-muted-foreground hover:text-foreground no-underline flex items-center gap-0.5">
                    すべての目標を見る <ArrowRight size={12} />
                  </Link>
                </div>
                {goalTitle && (
                  <p className="text-2xl font-semibold text-foreground m-0 mb-3 leading-relaxed">{goalTitle}</p>
                )}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">KPI 総合進捗率</span>
                  <span className="text-2xl font-bold text-foreground">{overallProgress}%</span>
                </div>
                <Progress value={overallProgress} className="h-2 mb-4" animate />
                {displayKpis.length > 0 && (
                  <div className="space-y-2">
                    {displayKpis.map(k => (
                      <div key={k.id} className="flex items-center gap-3">
                        <span className="text-sm font-bold text-foreground flex-1 truncate">{k.title}</span>
                        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 shrink-0 ${STATUS_COLORS[k.status] || ''}`}>
                          {STATUS_LABELS[k.status] || k.status}
                        </Badge>
                        <span className="text-sm font-semibold text-foreground w-10 text-right shrink-0">{k.progress}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )
      })()}

      {/* ===== 3. 自己評価バナー ===== */}
      {showReviewBanner && kpiGoals.length > 0 && (
        <button type="button" onClick={openReviewDialog} className="w-full mb-8 cursor-pointer border-0 p-0 bg-transparent">
          <div className="rounded-full bg-[#47C95C] px-6 py-4 flex items-center justify-between hover:opacity-90 transition-opacity">
            <p className="text-white text-base font-semibold m-0">
              あなたの{goalPeriodType === 'year' ? '１年間' : goalPeriodType === 'half' ? '半年間' : goalPeriodType === 'quarter' ? '３ヶ月間' : '期間'}を振り返り、自己評価を行いましょう！
            </p>
            <ArrowRight size={18} className="text-white shrink-0 ml-3" />
          </div>
        </button>
      )}

      {/* ===== 4. あなたのブランドコミット ===== */}
      {personalStats && (() => {
        const catWithData = filteredStats.categoryDistribution.filter(d => d.count > 0)
        const totalCatCount = catWithData.reduce((sum, d) => sum + d.count, 0)

        const periodOptions: { value: StatsPeriod; label: string }[] = [
          { value: 'all', label: 'すべて' },
          { value: '90d', label: '90日間' },
          { value: '30d', label: '30日間' },
          { value: 'month', label: '今月' },
        ]

        return (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-foreground tracking-wide m-0">
                あなたのブランドコミット
              </h2>
              <div className="flex gap-1">
                {periodOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handlePeriodChange(opt.value)}
                    className={`rounded-full text-xs font-medium px-3 py-1 border-0 cursor-pointer transition-colors ${
                      statsPeriod === opt.value
                        ? 'bg-foreground text-background'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2fr 1fr グリッド: 左(2x2) + 右(円グラフ) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* === 左側: 2行構成 === */}
              <div className="flex flex-col gap-3">
                {/* 上段: 投稿数 + いいね数 (2列) */}
                <div className="grid grid-cols-2 gap-3">
                  {/* 投稿数 */}
                  <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
                    <CardContent className="p-5 pb-3">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText size={18} className="text-foreground" />
                        <h3 className="text-sm font-semibold text-foreground m-0">投稿数</h3>
                      </div>
                      <p className="text-3xl font-bold text-foreground m-0 text-center">
                        {filteredStats.postCount}
                      </p>
                    </CardContent>
                  </Card>

                  {/* いいね数 */}
                  <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
                    <CardContent className="p-5 pb-3">
                      <div className="flex items-center gap-2 mb-3">
                        <Heart size={18} className="text-foreground" />
                        <h3 className="text-sm font-semibold text-foreground m-0">いいね数</h3>
                      </div>
                      <p className="text-3xl font-bold text-foreground m-0 text-center">
                        {filteredStats.likeCount}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* 下段: 連続投稿記録 (2列ぶち抜き) */}
                <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Star size={18} className="text-foreground" />
                        <h3 className="text-sm font-semibold text-foreground m-0">連続投稿記録</h3>
                      </div>
                      {personalStats.currentStreak > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {personalStats.currentStreak}日継続中
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-center gap-8">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-1.5">
                          <Star
                            size={24}
                            className={
                              i < Math.min(personalStats.currentStreak, 5)
                                ? 'text-[#EDD600] fill-[#EDD600]'
                                : 'text-muted-foreground/25'
                            }
                          />
                          <span className="text-[10px] text-muted-foreground">
                            {i + 1}日目
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* === 右側: 行動指針別割合 === */}
              <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <PieChartIcon size={18} className="text-foreground" />
                    <h3 className="text-sm font-semibold text-foreground m-0">行動指針別割合</h3>
                  </div>
                  {catWithData.length > 0 ? (
                    <div className="flex items-center gap-4 flex-1">
                      {/* 円グラフ */}
                      <div className="shrink-0">
                        <ChartContainer
                          config={categoryChartConfig}
                          className="aspect-square h-[150px] w-[150px]"
                        >
                          <PieChart key={chartKey}>
                            <Pie
                              data={catWithData}
                              cx="50%"
                              cy="50%"
                              outerRadius={65}
                              innerRadius={0}
                              dataKey="count"
                              nameKey="category"
                              strokeWidth={2}
                              isAnimationActive={true}
                              animationBegin={200}
                              animationDuration={800}
                              animationEasing="ease-out"
                            >
                              {catWithData.map((_, i) => (
                                <Cell
                                  key={i}
                                  fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                                />
                              ))}
                            </Pie>
                          </PieChart>
                        </ChartContainer>
                      </div>

                      {/* 凡例 */}
                      <div className="flex-1 min-w-0 flex flex-col gap-2">
                        {catWithData.map((item, i) => {
                          const pct = totalCatCount > 0
                            ? Math.round((item.count / totalCatCount) * 100)
                            : 0
                          return (
                            <div
                              key={item.category}
                              className="flex items-center text-xs leading-none h-5"
                            >
                              <div
                                className="size-2.5 rounded-full shrink-0"
                                style={{
                                  backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                                }}
                              />
                              <span className="font-semibold text-foreground w-10 text-right tabular-nums shrink-0">
                                {pct}%
                              </span>
                              <span className="text-muted-foreground truncate ml-1">
                                {item.category}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center flex-1 text-muted-foreground text-xs">
                      —
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )
      })()}

      {/* ===== 5. 投稿カード（2カラム） ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 左: あなたの投稿 */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <PenSquare size={18} className="text-foreground" />
              <h3 className="text-sm font-semibold text-foreground m-0">あなたの投稿</h3>
            </div>
            <div className="space-y-2">
              {myRecentPosts.length > 0 ? (
                myRecentPosts.map((post) => (
                  <DashboardPostCard key={post.id} post={post} />
                ))
              ) : (
                <p className="text-xs text-muted-foreground m-0">
                  まだ投稿がありません
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 右: みんなの投稿 */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-foreground" />
                <h3 className="text-sm font-semibold text-foreground m-0">みんなの投稿</h3>
              </div>
              <Link
                href="/portal/timeline"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1 no-underline"
              >
                すべて見る <ArrowRight size={12} />
              </Link>
            </div>
            <div className="space-y-2">
              {companyRecentPosts.length > 0 ? (
                companyRecentPosts.map((post) => (
                  <DashboardPostCard key={post.id} post={post} showAuthor />
                ))
              ) : (
                <p className="text-xs text-muted-foreground m-0">
                  まだ投稿がありません
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== 自己評価ダイアログ ===== */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogTitle>KPI進捗を更新</DialogTitle>
          <div className="space-y-5 mt-3">
            {kpiGoals.map(kpi => (
              <div key={kpi.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-foreground">{kpi.title}</span>
                  <span className="text-sm font-bold text-foreground">{reviewProgress[kpi.id] ?? kpi.progress}%</span>
                </div>
                <Slider
                  value={[reviewProgress[kpi.id] ?? kpi.progress]}
                  onValueChange={v => setReviewProgress(prev => ({ ...prev, [kpi.id]: v[0] }))}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-5">
            <Button onClick={handleReviewSave} disabled={reviewSaving} className="min-w-[100px]">
              {reviewSaving ? '保存中...' : '保存する'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
