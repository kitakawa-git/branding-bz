// ポータルダッシュボードのタイムライン由来ブロック（あなたのタイムライン分析＋あなた／みんなの投稿）
import { useMemo } from 'react'
import Link from 'next/link'
import { PieChart, Pie, Cell } from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import {
  type ChartConfig,
  ChartContainer,
} from '@/components/ui/chart'
import {
  FileText,
  Heart,
  Star,
  ArrowRight,
  PieChart as PieChartIcon,
  User,
  Users,
} from 'lucide-react'
import { DashboardPost, DashboardPostCard } from './DashboardPostCard'

const CATEGORY_COLORS = [
  '#F87E0C',
  '#A90CF8',
  '#1785F3',
  '#EDD600',
  '#F41189',
  '#47C95C',
]

export type StatsPeriod = 'month' | '30d' | '90d' | 'all'

export type UserPostRaw = {
  id: string
  category: string
  created_at: string
}

export type PersonalStats = {
  monthlyPosts: number
  monthlyLikesReceived: number
  currentStreak: number
  categoryDistribution: { category: string; count: number }[]
}

export function DashboardTimelineSection({
  personalStats,
  allUserPostsRaw,
  allLikePostIds,
  statsPeriod,
  onPeriodChange,
  chartKey,
  myRecentPosts,
  companyRecentPosts,
}: {
  personalStats: PersonalStats
  allUserPostsRaw: UserPostRaw[]
  allLikePostIds: string[]
  statsPeriod: StatsPeriod
  onPeriodChange: (period: StatsPeriod) => void
  chartKey: number
  myRecentPosts: DashboardPost[]
  companyRecentPosts: DashboardPost[]
}) {
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
    <div className="mb-4 rounded-xl border border-gray-200 bg-[hsl(0_0%_97%)] p-5">
    {(() => {
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
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-foreground tracking-wide m-0">
              あなたのタイムライン分析
            </h2>
            <div className="flex gap-1">
              {periodOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onPeriodChange(opt.value)}
                  className={`rounded-full text-sm font-medium px-3.5 py-1.5 border-0 cursor-pointer transition-colors ${
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
                <Card className="bg-white border shadow-none">
                  <CardContent className="p-4 pb-3">
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
                <Card className="bg-white border shadow-none">
                  <CardContent className="p-4 pb-3">
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
              <Card className="bg-white border shadow-none">
                <CardContent className="p-4 sm:p-5">
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
            <Card className="bg-white border shadow-none">
              <CardContent className="p-4 sm:p-5">
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

    {/* ===== 5. 投稿カード（2カラム・タイムライン由来。ラップ内なので判定不要） ===== */}
    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 左: あなたの投稿 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <User size={18} className="text-foreground" />
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
      </div>

      {/* 右: みんなの投稿 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-foreground" />
            <h3 className="text-sm font-semibold text-foreground m-0">みんなの投稿</h3>
          </div>
          <Link
            href="/portal/timeline"
            className="text-xs text-ds-app-accent hover:underline flex items-center gap-1 no-underline"
          >
            すべて見る <ArrowRight size={14} />
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
      </div>
    </div>
    </div>
  )
}
