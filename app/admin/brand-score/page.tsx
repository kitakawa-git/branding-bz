'use client'

import { useState, useEffect, useCallback } from 'react'
import { isFeatureEnabled } from '@/lib/constants/feature-toggles'
import { useAuth } from '../components/AdminDataProvider'
import { DashboardTabs } from '../components/DashboardTabs'
import { ALL_IMPRESSION_TAGS as ALL_TAGS } from '@/lib/brand-score/impression-tags'
import {
  FUNNEL_STAGES,
  STAGE_LABELS,
  type FunnelStage,
} from '@/lib/brand-score/funnel-stages'
import {
  MARKET_STAGES,
  MARKET_STAGE_LABELS,
} from '@/lib/brand-score/market-stages'
import { MIN_CARD_VIEWS_FOR_DIGITAL } from '@/lib/brand-score/outer-metrics'
import { supabase } from '@/lib/supabase'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { SnapshotScheduleCard } from './components/SnapshotScheduleCard'
import { BrandScoreView } from '@/components/brand-score/BrandScoreView'
import { can } from '@/lib/billing/entitlements'
import {
  ArrowRight,
  TrendingUp,
  CreditCard,
  MessageSquare,
  ClipboardList,
  Globe,
  ClipboardCheck,
  Check,
  Minus,
  AlertTriangle,
  CheckCircle,
  Camera,
  Loader2,
} from 'lucide-react'

// ── 型定義 ──

interface InnerScoreData {
  survey: { id: string; title: string; status: string; total_members: number }
  response_rate: number
  response_count: number
  scores: { total: number | null; why: number | null; how: number | null; what: number | null }
  rank: string
  by_department: { department: string; count: number; why: number | null; how: number | null; what: number | null; total: number | null }[]
  by_role: { role_category: string; count: number; why: number | null; how: number | null; what: number | null; total: number | null }[]
  /** 浸透段階の集計。段階が解決できないサーベイでは null */
  funnel: {
    overall: { stageScores: { stage: FunnelStage; score: number | null }[] }
  } | null
}

interface OuterScoreData {
  period_days: number | null
  total_card_views: number
  unique_visitors: number
  member_count: number
  scores: {
    reach: { value: number; score: number; weight: number }
    interest: { value: number; score: number; weight: number }
    transition: { value: number; score: number; weight: number }
    engagement: { value: number; score: number; weight: number }
    impression: null | { value: number; score: number; weight: number }
  }
  outer_score: number
  rank: string
  /** 市場浸透（外部調査）。取り込んでいなければ null */
  market_score: number | null
  market_stages: Record<string, number> | null
  /** 調査のサンプル数（n）。インナーの回答率と同じ位置に出す */
  market_sample_size: number | null
  /** デジタル接点（名刺ログ）。従来の outer_score と同じ値。未計測なら null */
  digital_score: number | null
  /** null の理由。disabled=スマート名刺オフ / insufficient_data=アクセス数不足 */
  digital_unavailable: 'disabled' | 'insufficient_data' | null
}

interface GapItem {
  empathy: number
  knowledge: number
  gap: number
  direction: 'empathy_leads' | 'knowledge_leads' | 'balanced_high' | 'balanced_low' | 'balanced'
  interpretation: string
  action: string
}

interface KnowledgeGapData {
  quiz: {
    id: string
    title: string
    status: string
    overall: number | null
    why: number | null
    how: number | null
    attempt_count: number
    total_members: number
    response_rate: number
    insufficient: boolean
  } | null
  survey: { id: string; title: string; status: string; why: number | null; how: number | null } | null
  gap: { why: GapItem | null; how: GapItem | null } | null
  reason: 'no_quiz' | 'no_survey' | 'insufficient' | null
}

interface TagMapping {
  tag: string
  is_expected: boolean
}

interface TagCount {
  tag: string
  count: number
  rate: number // パーセント
}

interface Snapshot {
  total_score: number | null
  inner_score: number | null
  outer_score: number | null
  rank: string | null
  snapshot_date: string
}

/** 市場調査1件＝推移の1点。実施日と市場浸透スコアだけ使う */
interface MarketTrendPoint {
  date: string
  market_score: number | null
}

/** サーベイ1件＝推移の1点。実施日（終了日）とインナースコアだけ使う */
interface SurveyTrendPoint {
  date: string
  inner_score: number | null
}

/**
 * 集計期間の選択肢。年単位の定点観測が前提なので日単位の窓は置かない。
 * 7日ではログが溜まらず、どの会社もほぼ「未計測」になっていた。
 *
 * ⚠ 期間を変えると到達力（UU数÷社員数）は窓が長いほど機械的に上がる。
 *   前年比を見るときは毎回同じ期間で揃えること（全期間は年ごとに窓が伸びる）。
 */
const PERIOD_OPTIONS: { value: string; label: string }[] = [
  { value: '180', label: '6ヶ月' },
  { value: '365', label: '1年' },
  { value: '1095', label: '3年' },
  { value: '1825', label: '5年' },
  { value: 'all', label: '全期間' },
]

const PERIOD_LABELS: Record<string, string> = Object.fromEntries(
  PERIOD_OPTIONS.map((o) => [o.value, o.label])
)

// ── ヘルパー関数 ──

function getScoreProgressColor(score: number | null): string {
  if (score === null) return ''
  if (score >= 80) return '[&>div]:bg-green-500'
  if (score >= 60) return '[&>div]:bg-ds-app-accent-soft'
  if (score >= 40) return '[&>div]:bg-amber-500'
  return '[&>div]:bg-red-500'
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground'
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-ds-app-accent'
  if (score >= 40) return 'text-amber-600'
  return 'text-red-600'
}

// ギャップ解釈バッジの色（direction 別）
function getGapBadgeClass(direction: string): string {
  if (direction === 'balanced_high') return 'bg-green-100 text-green-700 border-green-200'
  if (direction === 'balanced_low') return 'bg-red-100 text-red-700 border-red-200'
  if (direction === 'empathy_leads' || direction === 'knowledge_leads')
    return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-gray-100 text-gray-600 border-gray-200'
}

function getRank(score: number | null): string {
  if (score === null) return '-'
  if (score >= 90) return 'S'
  if (score >= 80) return 'A+'
  if (score >= 70) return 'A'
  if (score >= 60) return 'B+'
  if (score >= 50) return 'B'
  if (score >= 40) return 'C'
  return 'D'
}

function getBarColor(rate: number): string {
  if (rate >= 40) return 'bg-green-500'
  if (rate >= 20) return 'bg-ds-app-accent-soft'
  if (rate >= 10) return 'bg-amber-500'
  return 'bg-gray-300'
}


// ── キャッシュ型 ──
type BrandScoreCache = {
  innerScore: InnerScoreData | null
  outerScore: OuterScoreData | null
  tagMappings: TagMapping[]
  tagCounts: TagCount[]
  totalFbCount: number
  prevSnapshot: Snapshot | null
  snapshots: Snapshot[]
  marketTrend: MarketTrendPoint[]
  surveyTrend: SurveyTrendPoint[]
  impressionScore: number | null
  knowledgeGap: KnowledgeGapData | null
}

// ── メインコンポーネント ──

export default function BrandScoreDashboard() {
  const { companyId, company } = useAuth()
  // 計測の見せ方。Premium は簡易版（アウターのみ）、Enterprise は完全版
  const brandScoreFull = can(company, 'brandScoreFull')

  // 機能トグルを踏まえたタブ（定義は lib/constants/dashboard-tabs.ts に集約）

  // 既定は1年。この画面は年単位の定点観測が前提で、30日窓では
  // 名刺のアクセスが下限（MIN_CARD_VIEWS_FOR_DIGITAL）に届かず未計測になりやすい
  const [period, setPeriod] = useState<string>('365')

  // キャッシュキーは companyId + period 単位（period切替で別データ）
  const cacheKey = `brand-score-${companyId}-${period}`
  const cached = companyId ? getPageCache<BrandScoreCache>(cacheKey) : null

  const [loading, setLoading] = useState(!cached)

  const [innerScore, setInnerScore] = useState<InnerScoreData | null>(cached?.innerScore ?? null)
  const [outerScore, setOuterScore] = useState<OuterScoreData | null>(cached?.outerScore ?? null)
  const [tagMappings, setTagMappings] = useState<TagMapping[]>(cached?.tagMappings ?? [])
  const [tagCounts, setTagCounts] = useState<TagCount[]>(cached?.tagCounts ?? [])
  const [totalFbCount, setTotalFbCount] = useState(cached?.totalFbCount ?? 0)
  const [prevSnapshot, setPrevSnapshot] = useState<Snapshot | null>(cached?.prevSnapshot ?? null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>(cached?.snapshots ?? [])
  const [marketTrend, setMarketTrend] = useState<MarketTrendPoint[]>(cached?.marketTrend ?? [])
  const [surveyTrend, setSurveyTrend] = useState<SurveyTrendPoint[]>(cached?.surveyTrend ?? [])

  // スナップショット手動保存
  const [isSaving, setIsSaving] = useState(false)

  // 印象一致度
  const [impressionScore, setImpressionScore] = useState<number | null>(cached?.impressionScore ?? null)
  const [knowledgeGap, setKnowledgeGap] = useState<KnowledgeGapData | null>(cached?.knowledgeGap ?? null)

  // データ取得（段階的レンダリング：各fetchが終わり次第stateに反映）
  const fetchAll = useCallback(async () => {
    if (!companyId) return

    // 全期間は十分に古い日付を起点にして実質フィルタなしにする
    const periodDays = period === 'all' ? 36500 : parseInt(period)
    const sinceDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()

    // 各fetchの結果をキャッシュ用に集約するためのrefオブジェクト
    const collected: BrandScoreCache = {
      innerScore: null,
      outerScore: null,
      tagMappings: [],
      tagCounts: [],
      totalFbCount: 0,
      prevSnapshot: null,
      snapshots: [],
      marketTrend: [],
      surveyTrend: [],
      impressionScore: null,
      knowledgeGap: null,
    }

    // 各リクエストを独立して投げ、完了次第stateに反映
    const innerPromise = fetch(`/api/brand-score/inner-score?company_id=${companyId}`)
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        if (data.scores) {
          setInnerScore(data)
          collected.innerScore = data
        }
      })
      .catch(() => {})

    const outerPromise = fetch(`/api/analytics/outer-score?company_id=${companyId}&period=${period}`)
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        if (data.outer_score !== undefined) {
          setOuterScore(data)
          collected.outerScore = data
        }
      })
      .catch(() => {})

    const tagPromise = fetch(`/api/brand-score/tag-mappings?company_id=${companyId}`)
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        const mappings = data.mappings || []
        setTagMappings(mappings)
        collected.tagMappings = mappings
      })
      .catch(() => {})

    const fbPromise = supabase
      .from('brand_micro_feedbacks')
      .select('tags')
      .eq('company_id', companyId)
      .gte('created_at', sinceDate)
      .then(({ data, error }) => {
        if (error) return
        const rows = data || []
        setTotalFbCount(rows.length)
        collected.totalFbCount = rows.length

        const countMap = new Map<string, number>()
        ALL_TAGS.forEach(t => countMap.set(t, 0))
        for (const row of rows) {
          const tags = row.tags as string[]
          if (Array.isArray(tags)) {
            tags.forEach(t => {
              countMap.set(t, (countMap.get(t) || 0) + 1)
            })
          }
        }
        const counts: TagCount[] = ALL_TAGS.map(tag => ({
          tag,
          count: countMap.get(tag) || 0,
          rate: rows.length > 0 ? Math.round(((countMap.get(tag) || 0) / rows.length) * 1000) / 10 : 0,
        })).sort((a, b) => b.rate - a.rate)
        setTagCounts(counts)
        collected.tagCounts = counts
      })

    // 前回記録は記録一覧の最後（snapshot_date 昇順）。
    // 同じ内容をクライアントから直接 brand_score_snapshots に取りに行くと
    // 往復が1回増えるうえ、RLS で別会社を見たときだけ空になり食い違う
    const snapshotsPromise = fetch(`/api/brand-score/snapshots?company_id=${companyId}`)
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        const list: Snapshot[] = data.snapshots || []
        setSnapshots(list)
        collected.snapshots = list
        const snap = list.length > 0 ? list[list.length - 1] : null
        setPrevSnapshot(snap)
        collected.prevSnapshot = snap
      })
      .catch(() => {})

    // 市場調査の実施日に打つ点。スナップショットとは別ソース
    const marketTrendPromise = fetch(
      `/api/brand-score/market-surveys/trend?company_id=${companyId}`
    )
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        const list = data.points || []
        setMarketTrend(list)
        collected.marketTrend = list
      })
      .catch(() => {})

    // サーベイを締めた日に打つ点。スナップショットとは別ソース
    const surveyTrendPromise = fetch(
      `/api/brand-score/surveys/trend?company_id=${companyId}`
    )
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        const list = data.points || []
        setSurveyTrend(list)
        collected.surveyTrend = list
      })
      .catch(() => {})

    // 理解度（知識）× 共感 ギャップ分析（admin セッションで company 確定）
    const knowledgeGapPromise = fetch(`/api/brand-score/knowledge-gap`)
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        setKnowledgeGap(data)
        collected.knowledgeGap = data
      })
      .catch(() => {})

    // 最初に最低限の表示を出したいデータが揃ったらloading解除
    // （inner + outer + prevSnapshot があれば総合カードが描画可能）
    Promise.all([innerPromise, outerPromise, snapshotsPromise]).then(() => {
      setLoading(false)
    })

    // 全部終わったらキャッシュ保存
    await Promise.allSettled([innerPromise, outerPromise, tagPromise, fbPromise, snapshotsPromise, marketTrendPromise, surveyTrendPromise, knowledgeGapPromise])

    // 印象一致度の最終算出（tagMappings と tagCounts と totalFbCount が揃ってから）
    if (collected.totalFbCount >= 30) {
      const expectedTags = collected.tagMappings.filter(m => m.is_expected).map(m => m.tag)
      if (expectedTags.length > 0) {
        const top3Tags = collected.tagCounts.slice(0, 3).map(c => c.tag)
        const matchCount = expectedTags.filter(t => top3Tags.includes(t)).length
        collected.impressionScore = Math.round((matchCount / expectedTags.length) * 100)
      }
    }

    setLoading(false)
    setPageCache<BrandScoreCache>(cacheKey, collected)
  }, [companyId, period, cacheKey])

  useEffect(() => {
    if (!companyId) return

    // companyId 確定後にキャッシュがあればそれを反映
    const cachedNow = getPageCache<BrandScoreCache>(cacheKey)
    if (cachedNow) {
      setInnerScore(cachedNow.innerScore)
      setOuterScore(cachedNow.outerScore)
      setTagMappings(cachedNow.tagMappings)
      setTagCounts(cachedNow.tagCounts)
      setTotalFbCount(cachedNow.totalFbCount)
      setPrevSnapshot(cachedNow.prevSnapshot)
      setSnapshots(cachedNow.snapshots)
      setMarketTrend(cachedNow.marketTrend ?? [])
      setSurveyTrend(cachedNow.surveyTrend ?? [])
      setImpressionScore(cachedNow.impressionScore)
    }

    // companyId が定まった時点で即座に画面表示（データ未取得は各カードの「データなし」が出る）
    // バックグラウンドで fetchAll を実行して順次更新（SWRパターン）
    setLoading(false)
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, period])

  // タグマッピングが取得されたら印象一致度を再計算
  useEffect(() => {
    if (tagMappings.length > 0 && tagCounts.length > 0 && totalFbCount >= 30) {
      const expectedTags = tagMappings.filter(m => m.is_expected).map(m => m.tag)
      if (expectedTags.length > 0) {
        const top3Tags = tagCounts.slice(0, 3).map(c => c.tag)
        const matchCount = expectedTags.filter(t => top3Tags.includes(t)).length
        setImpressionScore(Math.round((matchCount / expectedTags.length) * 100))
      }
    }
  }, [tagMappings, tagCounts, totalFbCount])

  // スナップショット手動保存ハンドラー
  const handleSaveSnapshot = useCallback(async () => {
    if (!companyId || isSaving) return
    setIsSaving(true)
    try {
      const res = await fetch('/api/brand-score/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId }),
      })

      if (res.status === 409) {
        toast('本日のスコアは既に記録済みです')
        return
      }

      if (!res.ok) throw new Error()

      toast.success('スコアを記録しました')
      // データ再フェッチ（前回スナップショットを更新するため）
      fetchAll()
    } catch {
      toast.error('記録に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }, [companyId, isSaving, fetchAll])

  // ── 算出値 ──
  const hasInner = innerScore !== null && innerScore.scores.total !== null
  const hasOuter = outerScore !== null && outerScore.outer_score > 0
  const hasMicroFb = totalFbCount > 0
  const hasTagMappings = tagMappings.some(m => m.is_expected)

  // 総合ブランドスコア
  let totalBrandScore: number | null = null
  if (hasInner && hasOuter) {
    totalBrandScore = Math.round(((innerScore!.scores.total! * 0.5) + (outerScore!.outer_score * 0.5)) * 10) / 10
  } else if (hasInner) {
    totalBrandScore = innerScore!.scores.total
  } else if (hasOuter) {
    totalBrandScore = Math.round(outerScore!.outer_score * 10) / 10
  }
  const totalRank = getRank(totalBrandScore)

  // 前回比較
  const prevDiff = prevSnapshot?.total_score != null && totalBrandScore != null
    ? Math.round((totalBrandScore - Number(prevSnapshot.total_score)) * 10) / 10
    : null

  // ── レンダリング ──

  if (loading) {
    return (
      <div>
        <DashboardTabs company={company} />
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-9 w-28" />
        </div>
        <Skeleton className="h-32 w-full mb-6 rounded-xl" />
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  // 両方なし
  if (!hasInner && !hasOuter) {
    return (
      <div>
        <DashboardTabs company={company} />
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-10 text-center">
            <TrendingUp size={48} className="mx-auto mb-4 text-muted-foreground/30" />
            <h2 className="text-base font-bold text-foreground mb-2">ブランドスコアの測定を始めましょう</h2>
            {/* アウターは市場浸透75%＋デジタル接点25%。名刺だけで測れるかのように
                書くと、名刺を配ってもスコアが動かない（30件未満は未計測）ときに
                「壊れている」と受け取られる。主役が市場調査であることを先に書く */}
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              社内サーベイで「インナースコア」を、市場調査と名刺閲覧データで「アウタースコア」を測定できます。
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {isFeatureEnabled(company, 'survey_enabled') && (
                <Button asChild size="sm">
                  <Link href="/admin/brand-score/surveys">
                    <ClipboardList size={14} />
                    サーベイを作成する
                  </Link>
                </Button>
              )}
              {/* アウターの4分の3を占めるのに入口が無かった。プラン外なら
                  遷移先がアップセル面を出すので、ここでは隠さず出す */}
              {isFeatureEnabled(company, 'market_survey_enabled') && (
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/brand-score/market-surveys">
                    <Globe size={14} />
                    市場調査を取り込む
                  </Link>
                </Button>
              )}
              {/* 配布に使う QR は「スマート名刺」にある。メンバー管理には
                  アカウントの追加と名刺のオンオフしか無く、配布はできない */}
              {isFeatureEnabled(company, 'card_enabled') && (
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/card-template">
                    <CreditCard size={14} />
                    名刺を配布する
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      {/* ── セットアップ進捗＋タブバー ── */}
      <DashboardTabs company={company} />

      {/* ── 1. ヘッダー ── */}
      {/* 見出しはパンくず・タブと重複するため置かない。
          操作は左寄せ。ダッシュボードタブの期間フィルターと位置を揃える */}
      <div className="flex items-center mb-4">
        <div className="flex items-center gap-2">
          {/* 期間をいちばん左に。タイムライン分析タブの期間フィルターと位置が揃う */}
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-28 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── 2〜3. 総合 / スコア推移 / インナー×アウター ──
          ポータル（管理職以上）と同じ表示なので components/brand-score に切り出してある。
          同じ数字を2箇所で計算すると画面ごとに違う点数が出るため、派生値も向こうが持つ */}
      <BrandScoreView
        innerScore={innerScore}
        outerScore={outerScore}
        snapshots={snapshots}
        marketTrend={marketTrend.map(m => ({ date: m.date, score: m.market_score }))}
        surveyTrend={surveyTrend.map(t => ({ date: t.date, score: t.inner_score }))}
        prevDiff={prevDiff}
        impressionScore={impressionScore}
        periodLabel={PERIOD_LABELS[period] ?? period}
        variant={brandScoreFull ? 'full' : 'basic'}
      />

      {/* ── 3.5. 理解度（知識）× 共感ギャップ ──
          インナー（サーベイ・理解度テスト）由来なので Enterprise 側 */}
      {brandScoreFull && (
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {/* 左: 理解度（知識） */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <ClipboardCheck size={14} />
                理解度（知識）
              </h2>
            </div>

            {knowledgeGap?.quiz ? (
              knowledgeGap.quiz.insufficient ? (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground mb-1">集計中</p>
                  <p className="text-xs text-muted-foreground/70 mb-4">
                    回答数が少ないため非表示（匿名性確保）
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground px-1 mb-3">
                    <span>受験率</span>
                    <span>
                      {knowledgeGap.quiz.attempt_count}人 / {knowledgeGap.quiz.total_members}人（
                      {knowledgeGap.quiz.response_rate}%）
                    </span>
                  </div>
                  <Link
                    href="/admin/brand-score/quizzes"
                    className="inline-flex items-center gap-1 text-xs text-ds-app-accent hover:underline"
                  >
                    理解度テスト管理 <ArrowRight size={12} />
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center mb-2">
                    <span className={`text-3xl font-bold ${getScoreColor(knowledgeGap.quiz.overall)}`}>
                      {knowledgeGap.quiz.overall !== null ? knowledgeGap.quiz.overall.toFixed(1) : '-'}
                    </span>
                    <span className="text-sm text-muted-foreground ml-1">%</span>
                  </div>

                  {[
                    { label: '理念（WHY）', value: knowledgeGap.quiz.why },
                    { label: '戦略・ルール（HOW）', value: knowledgeGap.quiz.how },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">{item.label}</span>
                        <span className={`text-sm font-bold ${getScoreColor(item.value)}`}>
                          {item.value !== null ? item.value.toFixed(1) : '-'}
                        </span>
                      </div>
                      <Progress value={item.value ?? 0} className={`h-1.5 ${getScoreProgressColor(item.value)}`} />
                    </div>
                  ))}

                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>受験率</span>
                      <span>
                        {knowledgeGap.quiz.attempt_count}人 / {knowledgeGap.quiz.total_members}人（
                        {knowledgeGap.quiz.response_rate}%）
                      </span>
                    </div>
                  </div>

                  <Link
                    href="/admin/brand-score/quizzes"
                    className="flex items-center gap-1 text-xs text-ds-app-accent hover:underline"
                  >
                    理解度テスト管理 <ArrowRight size={12} />
                  </Link>
                </div>
              )
            ) : (
              <div className="text-center py-6">
                <ClipboardCheck size={32} className="mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground mb-3">
                  理解度テストを実施するとスコアが表示されます
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link href="/admin/brand-score/quizzes">
                    テストを作成 <ArrowRight size={12} />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 右: 共感 × 知識 ギャップ */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <TrendingUp size={14} />
                共感 × 知識 ギャップ
              </h2>
            </div>

            {knowledgeGap?.gap ? (
              <div className="space-y-5">
                {(
                  [
                    { key: 'why' as const, label: 'WHY（理念）' },
                    { key: 'how' as const, label: 'HOW（戦略・ルール）' },
                  ]
                ).map(({ key, label }) => {
                  const item = knowledgeGap.gap![key]
                  if (!item) {
                    return (
                      <div key={key}>
                        <p className="text-xs font-semibold text-foreground mb-1">{label}</p>
                        <p className="text-xs text-muted-foreground">データが揃っていません</p>
                      </div>
                    )
                  }
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-foreground">{label}</span>
                        <Badge variant="outline" className={`text-[10px] ${getGapBadgeClass(item.direction)}`}>
                          {item.interpretation}
                        </Badge>
                      </div>
                      <div className="space-y-1.5">
                        <div>
                          <div className="flex items-center justify-between text-[11px] mb-0.5">
                            <span className="text-ds-app-accent">共感（サーベイ）</span>
                            <span className="font-semibold">{item.empathy.toFixed(1)}</span>
                          </div>
                          <Progress value={item.empathy} className="h-1.5 [&>div]:bg-ds-app-accent-soft" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-[11px] mb-0.5">
                            <span className="text-purple-600">知識（テスト）</span>
                            <span className="font-semibold">{item.knowledge.toFixed(1)}</span>
                          </div>
                          <Progress value={item.knowledge} className="h-1.5 [&>div]:bg-purple-500" />
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        差 {item.gap > 0 ? '+' : ''}
                        {item.gap.toFixed(1)} ・ {item.action}
                      </p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <TrendingUp size={32} className="mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  {knowledgeGap?.reason === 'no_quiz' &&
                    '理解度テストを実施すると、共感とのギャップが見えます'}
                  {knowledgeGap?.reason === 'no_survey' &&
                    'サーベイを実施すると、知識とのギャップが見えます'}
                  {knowledgeGap?.reason === 'insufficient' &&
                    '受験数が少ないため集計中（回答が増えるとギャップを表示）'}
                  {!knowledgeGap?.reason &&
                    'サーベイとテストの両方を実施すると、共感×知識のギャップが見えます'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      )}

      {/* ── 4. 印象タグ分布 ── */}
      {hasMicroFb && (
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-4">
          <CardContent className="p-5">
            <h2 className="text-xs font-bold text-foreground mb-1 flex items-center gap-1.5">
              <MessageSquare size={14} />
              印象タグ分布
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              {period === 'all' ? '' : `直近${PERIOD_LABELS[period] ?? `${period}日`}の`}回答 {totalFbCount}件
            </p>

            {totalFbCount >= 30 ? (
              <div className="space-y-2.5">
                {tagCounts.map(tc => {
                  const isExpected = tagMappings.find(m => m.tag === tc.tag)?.is_expected
                  return (
                    <div key={tc.tag} className="flex items-center gap-3">
                      <div className="w-28 shrink-0 flex items-center gap-1.5">
                        {isExpected && (
                          <Check size={12} className="text-ds-app-accent-soft shrink-0" />
                        )}
                        <span className={`text-sm ${isExpected ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                          {tc.tag}
                        </span>
                      </div>
                      <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${getBarColor(tc.rate)}`}
                          style={{ width: `${Math.min(tc.rate, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-foreground w-14 text-right">
                        {tc.rate}%
                      </span>
                      <span className="text-[10px] text-muted-foreground w-10 text-right">
                        {tc.count}件
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <MessageSquare size={32} className="mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  マイクロフィードバックのデータを収集中です
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  （現在 {totalFbCount}件 / 30件以上で表示）
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── 5. ギャップ分析 ──
          共感（サーベイ）× 知識（理解度テスト）の対比なので Enterprise 側 */}
      {brandScoreFull && hasMicroFb && hasTagMappings && (
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-4">
          <CardContent className="p-5">
            <h2 className="text-xs font-bold text-foreground mb-4 flex items-center gap-1.5">
              <AlertTriangle size={14} />
              ギャップ分析
            </h2>

            {totalFbCount >= 30 ? (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-xs font-semibold">タグ</TableHead>
                      <TableHead className="text-xs font-semibold text-center">期待</TableHead>
                      <TableHead className="text-xs font-semibold text-center">選択率</TableHead>
                      <TableHead className="text-xs font-semibold text-center">判定</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tagCounts.map(tc => {
                      const mapping = tagMappings.find(m => m.tag === tc.tag)
                      const isExpected = mapping?.is_expected || false
                      let verdict: { icon: React.ReactNode; text: string; className: string }
                      if (!isExpected) {
                        verdict = {
                          icon: <Minus size={14} />,
                          text: 'ー',
                          className: 'text-muted-foreground',
                        }
                      } else if (tc.rate >= 20) {
                        verdict = {
                          icon: <CheckCircle size={14} />,
                          text: '一致',
                          className: 'text-green-600',
                        }
                      } else {
                        verdict = {
                          icon: <AlertTriangle size={14} />,
                          text: '要改善',
                          className: 'text-orange-600',
                        }
                      }

                      return (
                        <TableRow key={tc.tag}>
                          <TableCell className="text-sm font-medium">{tc.tag}</TableCell>
                          <TableCell className="text-center">
                            {isExpected ? (
                              <Check size={14} className="mx-auto text-ds-app-accent-soft" />
                            ) : (
                              <Minus size={14} className="mx-auto text-muted-foreground/40" />
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-center font-semibold">
                            {tc.rate}%
                          </TableCell>
                          <TableCell className={`text-center ${verdict.className}`}>
                            <div className="flex items-center justify-center gap-1 text-xs font-medium">
                              {verdict.icon}
                              {verdict.text}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-6">
                <AlertTriangle size={32} className="mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  マイクロフィードバックのデータを収集中です
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  （現在 {totalFbCount}件 / 30件以上で表示）
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── 6. 自動記録設定 ── */}
      {companyId && (
        <SnapshotScheduleCard
          companyId={companyId}
          onSnapshotsChanged={fetchAll}
          recordSlot={
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full" disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Camera size={14} />
                  )}
                  スコアを記録
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>スコアを記録</AlertDialogTitle>
                  <AlertDialogDescription>
                    現時点のブランドスコアをスナップショットとして保存します。記録したスコアは推移グラフに反映されます。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSaveSnapshot}>
                    記録する
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          }
        />
      )}
    </div>
  )
}
