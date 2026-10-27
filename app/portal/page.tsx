'use client'

// ポータルダッシュボード: ミッション + KPI + 個人サマリー + 投稿フィード
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePortalAuth } from './components/PortalDataProvider'
import { isFeatureEnabled } from '@/lib/constants/feature-toggles'
import { isPortalPageVisibleForRole } from '@/lib/constants/member-roles'
import { can } from '@/lib/billing/entitlements'
import { BrandScorePortalSection } from '@/components/brand-score/BrandScorePortalSection'
import { SurveyBanner } from './components/SurveyBanner'
import { QuizBanner } from './components/QuizBanner'
import { fetchPhilosophy } from '@/lib/brand/philosophy'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { useOnboarding } from '@/components/onboarding/use-onboarding'
import { useRashisaCardVisible } from '@/components/portal/rashisa-card-visibility'
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist'
import { PortalIntroCard } from '@/components/onboarding/PortalIntroCard'
import { DashboardPost, calculateCurrentStreak } from './_components/DashboardPostCard'
import { DashboardSkeleton } from './_components/DashboardSkeleton'
import { DashboardWelcome } from './_components/DashboardWelcome'
import { AnnouncementSummary, DashboardAnnouncements } from './_components/DashboardAnnouncements'
import { DashboardMissionCard } from './_components/DashboardMissionCard'
import { DashboardRashisaCard } from './_components/DashboardRashisaCard'
import {
  KpiItemSummary,
  DashboardGoalBanner,
  DashboardKpiSummary,
  DashboardReviewBanner,
  DashboardReviewDialog,
} from './_components/DashboardKpiSections'
import {
  StatsPeriod,
  UserPostRaw,
  PersonalStats,
  DashboardTimelineSection,
} from './_components/DashboardTimelineSection'
import { useDashboardReview } from './_components/useDashboardReview'
import { pickCurrentPeriod } from '@/lib/goals/types'
import { pickConceptVisual } from '@/components/brand/ConceptVisualBackdrop'

// ============================================
// Types
// ============================================

type DashboardCache = {
  mission: string | null
  conceptVisualUrl: string | null
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

// ============================================
// Main Component
// ============================================

export default function PortalTopPage() {
  const { companyId, user, member, slogan, company, roleCategory, isAdmin } = usePortalAuth()

  // 初回セットアップ案内（管理者のみ）。未セットアップのあいだ、
  // ダッシュボードの中身をこれに差し替える（着地先は変えない）
  const onboarding = useOnboarding(company, { notifyOnComplete: true, userId: user?.id })
  const showOnboarding = !onboarding.loading && !onboarding.hidden && !onboarding.dismissed

  // 「私たちの『らしさ』」カードの表示。切り替えはサイドバー見出しのスイッチ
  const rashisaCardVisible = useRashisaCardVisible()

  // 機能トグル: タイムラインが無効なら投稿関連ウィジェットを非表示にする
  const timelineEnabled = isFeatureEnabled(company, 'timeline_enabled')
  // 機能トグル: KPIが無効なら目標・KPI関連のバナー／カードを非表示にする
  const kpiEnabled = isFeatureEnabled(company, 'kpi_enabled')
  // 機能トグル: お知らせ／理解度テストが無効ならダッシュボードのウィジェットも出さない
  const announcementsEnabled = isFeatureEnabled(company, 'announcements_enabled')
  const quizEnabled = isFeatureEnabled(company, 'quiz_enabled')
  // 区分ごとの表示設定で目標・KPI を出し分け（機能トグルと AND）
  const kpiVisible = kpiEnabled && isPortalPageVisibleForRole(company, 'kpi', roleCategory, isAdmin)
  // ブランドスコアは既定で管理職以上（従業員には出さない）。会社ごとに設定で変えられる
  const brandScoreVisible = isPortalPageVisibleForRole(
    company,
    'brand_score',
    roleCategory,
    isAdmin
  )
  // スコアカードから各調査結果へ飛べるようにする。見られない区分にはリンクを出さない
  // 計測の見せ方。Premium はインナーのみ、Enterprise は市場調査を含む総合
  const brandScoreIntegrated = can(company, 'brandScoreIntegrated')
  const surveyVisible = isPortalPageVisibleForRole(company, 'survey', roleCategory, isAdmin)
  const marketSurveyVisible = isPortalPageVisibleForRole(
    company,
    'market_survey',
    roleCategory,
    isAdmin
  )
  const cacheKey = `portal-dashboard-${companyId}-${user?.id}`
  // persist: 再読込（引っ張り更新を含む）後も前回の内容をすぐ出し、裏で最新に差し替える（lib/page-cache.ts）
  const cached = companyId && user?.id ? getPageCache<DashboardCache>(cacheKey, { persist: true }) : null
  const [loading, setLoading] = useState(!cached)
  const [mission, setMission] = useState<string | null>(cached?.mission ?? null)
  const [conceptVisualUrl, setConceptVisualUrl] = useState<string | null>(cached?.conceptVisualUrl ?? null)
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

  // 期間フィルタの統計計算は DashboardTimelineSection 側（表示するのはそこだけ）
  const handlePeriodChange = (period: StatsPeriod) => {
    setStatsPeriod(period)
    setChartKey(prev => prev + 1)
  }

  // 自己評価ポップアップ
  const {
    reviewOpen,
    setReviewOpen,
    reviewProgress,
    setReviewProgress,
    reviewSaving,
    openReviewDialog,
    handleReviewSave,
  } = useDashboardReview({ companyId, userId: user?.id, kpiGoals, setKpiGoals })

  useEffect(() => {
    if (!companyId || !user?.id) {
      setLoading(false)
      return
    }

    const fetchAll = async () => {
      try {
        // === Group 1: base queries (parallel) ===
        const [missionRes, allUserPostsRes, userRecent3Res, companyRecent3Res, announcementsRes, announcementReadsRes, kpiGoalsRes, goalPeriodRes, goalPeriodsRes, conceptVisualRes] =
          await Promise.allSettled([
            fetchPhilosophy(supabase, companyId),
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
            // 未読を3件出したいので多めに取ってから絞る。
            // limit(3) のまま既読を落とすと、新しい3件が既読なだけで
            // 未読が残っていても何も出なくなる
            supabase
              .from('announcements')
              .select('id, title, category, created_at, content')
              .eq('company_id', companyId)
              .eq('is_published', true)
              .order('created_at', { ascending: false })
              .limit(20),
            supabase
              .from('announcement_reads')
              .select('announcement_id')
              .eq('user_id', user.id)
              .eq('company_id', companyId),
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
              .select('id, type, is_current, status')
              .eq('company_id', companyId)
              .eq('is_current', true)
              .eq('status', 'active'),
            supabase
              .from('brand_guidelines')
              .select('concept_visuals, concept_visual_url')
              .eq('company_id', companyId)
              .maybeSingle(),
          ])

        // Extract results
        const missionData =
          missionRes.status === 'fulfilled' ? missionRes.value : null
        if (missionData?.mission) {
          setMission(missionData.mission)
        }

        // コンセプトビジュアル（新カラム concept_visuals 優先・レガシー concept_visual_url フォールバック）
        const cvRow =
          conceptVisualRes.status === 'fulfilled'
            ? (conceptVisualRes.value.data as { concept_visuals?: string[] | null; concept_visual_url?: string | null } | null)
            : null
        const conceptVisual = pickConceptVisual(cvRow)
        setConceptVisualUrl(conceptVisual)

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

        // --- Announcements（未読のみ・最新3件） ---
        // 読んだものはダッシュボードから消える。全件は /portal/announcements で見る
        const readAnnouncementIds = new Set(
          announcementReadsRes.status === 'fulfilled'
            ? (announcementReadsRes.value.data || []).map((r: { announcement_id: string }) => r.announcement_id)
            : []
        )
        const latestAnnouncementsData: AnnouncementSummary[] =
          announcementsRes.status === 'fulfilled'
            ? (announcementsRes.value.data || [])
                .filter((a: { id: string }) => !readAnnouncementIds.has(a.id))
                .slice(0, 3)
                .map((a: { id: string; title: string; category: string; created_at: string; content: string }) => ({
                  id: a.id,
                  title: a.title,
                  category: a.category,
                  created_at: a.created_at,
                  content: a.content,
                }))
            : []
        setLatestAnnouncements(latestAnnouncementsData)

        // --- Current period ID ---
        const currentPeriodId =
          goalPeriodsRes.status === 'fulfilled' ? pickCurrentPeriod(goalPeriodsRes.value.data || [], 'personal')?.id || null : null

        // 今期の個人目標（goals・level='personal'）。ここで await すると Group 1 と Group 2 の
        // 間にもう1往復挟まる。依存しているのは Group 1 の currentPeriodId だけなので、
        // 組み立てだけ済ませて Group 2 に相乗りさせる（結果は Group 2 の後で読む）
        let goalQuery = supabase
          .from('goals')
          .select('id, title')
          .eq('company_id', companyId)
          .eq('level', 'personal')
          .eq('owner_user_id', user.id)
        if (currentPeriodId) {
          goalQuery = goalQuery.eq('period_id', currentPeriodId)
        } else {
          goalQuery = goalQuery.is('period_id', null)
        }

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

        const [monthlyLikesRes, recentLikesRes, recentCommentsRes, membersRes, goalRes] =
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
            // [4] 今期の目標。Group 1 にしか依存しないのでここに相乗りさせている
            goalQuery.limit(1).maybeSingle(),
          ])

        // --- 目標と KPI（goalRes を読んでから） ---
        const goalData =
          goalRes.status === 'fulfilled'
            ? ((goalRes.value as { data: { id: string; title: string } | null }).data ?? null)
            : null
        const currentGoalId = goalData?.id || null
        setHasGoals(!!goalData)
        setGoalTitle(goalData?.title || null)

        // KPI は今期の目標に紐づくものだけ
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
          conceptVisualUrl: conceptVisual,
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
          hasGoals: !!goalData,
          goalTitle: goalData?.title || null,
          goalPeriodType: goalPeriodTypeData,
          showGoalBanner: showGoalBannerData,
          showReviewBanner: showReviewBannerData,
        }, { persist: true })
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

  // 案内を出すかどうか決まる前にダッシュボードを描くと、直後に案内へ
  // 差し替わって一瞬ちらつく。管理者のときだけ判定を待つ
  // （メンバーには案内を出さないので待たせる理由がない）
  if (loading || (isAdmin && onboarding.loading)) {
    return <DashboardSkeleton kpiVisible={kpiVisible} timelineEnabled={timelineEnabled} />
  }

  return (
    <div className="max-w-4xl mx-auto px-5 pt-6 pb-10">
      {/* ===== 1. スローガン ===== */}
      <DashboardWelcome member={member} slogan={slogan} />

      {/* ===== 1.2. 初回セットアップ案内（管理者・未セットアップのときだけ） =====
          ここが出ているあいだは、下のダッシュボード本体は出さない。
          空のカードが並ぶと「中身の無いサービス」に見えてしまうため */}
      {showOnboarding && onboarding.view ? (
        <>
          {/* 出す条件はオンボーディングと同じ。「あとで」を押せば両方消える */}
          <PortalIntroCard />
          <OnboardingChecklist
            company={company}
            view={onboarding.view}
            onDismiss={onboarding.dismiss}
          />
        </>
      ) : (
      <>

      {/* ===== 1.3. 未回答サーベイバナー ===== */}
      {/* 中身（SurveyBanner）は未回答が無いと null を返す。
          empty:hidden が無いと、この枠だけが残って余白として居座る */}
      <div className="mb-4 empty:hidden">
        <SurveyBanner />
      </div>

      {/* ===== 1.4. 未受験 理解度テストバナー ===== */}
      {quizEnabled && (
        <div className="mb-4 empty:hidden">
          <QuizBanner />
        </div>
      )}

      {/* ===== 1.5. 最新のお知らせ =====
          1件＝1カードだと、お知らせが2〜3本並んだだけで枠線が増えて
          ダッシュボードが細切れに見える。1枚のカードに畳んで、
          件どうしの区切りは内側の罫線だけで表す。
          見出しと「すべて見る」もカードの中に入れる（ミッションカードと同じ作法） */}
      {announcementsEnabled && latestAnnouncements.length > 0 && (
        <DashboardAnnouncements latestAnnouncements={latestAnnouncements} />
      )}

      {/* ===== 2. ミッションカード ===== */}
      {mission && (
        <DashboardMissionCard mission={mission} conceptVisualUrl={conceptVisualUrl} />
      )}

      {/* ===== 2.7. 私たちの「らしさ」4象限概観カード =====
          サイドバー見出しのスイッチで隠せる（端末ごとの好み）。
          同じ5項目がサイドバーに常時あるので、慣れた人には要らない */}
      <DashboardRashisaCard visible={rashisaCardVisible} />

      {/* ===== 2.45. 目標・KPI未設定バナー（ミッションの下。設定すると同じ位置に 2.5 の KPIサマリーが出る） =====
          サーベイ・理解度テストと同じ「やってください」の通知なので、
          並べて同じ様式・同じ位置に置く（以前は下のブランドスコアの後にあり、種類が違うものに見えていた） */}
      {kpiVisible && !hasGoals && showGoalBanner && (
        <DashboardGoalBanner goalPeriodType={goalPeriodType} />
      )}

      {/* ===== 2.5. KPIサマリー（KPI無効時は非表示。未設定時のバナーは直前の 2.45） ===== */}
      {kpiVisible && hasGoals && (
        <DashboardKpiSummary kpiGoals={kpiGoals} goalTitle={goalTitle} />
      )}

      {/* ===== 3. 自己評価バナー（KPI無効時は非表示） ===== */}
      {kpiVisible && showReviewBanner && kpiGoals.length > 0 && (
        <DashboardReviewBanner goalPeriodType={goalPeriodType} onOpen={openReviewDialog} />
      )}

      {/* ===== 2.4. ブランドスコア（区分ごとの表示設定で出し分け） =====
          表示は管理画面と同じ BrandScoreView。読み取り専用で、
          記録設定やAI再生成などの操作系は出さない。
          下の余白は他のカードと同じ 16px（mb-4）。ここだけ mb-8 だった */}
      {brandScoreVisible && companyId && (
        <div className="mb-4 empty:hidden">
          <BrandScorePortalSection
            companyId={companyId}
            surveyHref={surveyVisible ? '/portal/survey' : null}
            marketSurveyHref={marketSurveyVisible ? '/portal/market-survey' : null}
            variant={brandScoreIntegrated ? 'full' : 'basic'}
          />
        </div>
      )}

      {/* ===== 4. あなたのブランドコミット（タイムライン由来。無効時は非表示） ===== */}
      {/* 5. 投稿カードも同じ枠の中（DashboardTimelineSection） */}
      {timelineEnabled && personalStats && (
        <DashboardTimelineSection
          personalStats={personalStats}
          allUserPostsRaw={allUserPostsRaw}
          allLikePostIds={allLikePostIds}
          statsPeriod={statsPeriod}
          onPeriodChange={handlePeriodChange}
          chartKey={chartKey}
          myRecentPosts={myRecentPosts}
          companyRecentPosts={companyRecentPosts}
        />
      )}

      </>
      )}

      {/* ===== 自己評価ダイアログ ===== */}
      <DashboardReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        kpiGoals={kpiGoals}
        reviewProgress={reviewProgress}
        setReviewProgress={setReviewProgress}
        onSave={handleReviewSave}
        saving={reviewSaving}
      />
    </div>
  )
}
