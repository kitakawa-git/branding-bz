'use client'

import { visibleDashboardTabs } from '@/lib/constants/dashboard-tabs'
import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '../components/AdminDataProvider'
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
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { SnapshotScheduleCard } from './components/SnapshotScheduleCard'
import {
  ArrowRight,
  TrendingUp,
  Users,
  Eye,
  MessageSquare,
  ClipboardList,
  ClipboardCheck,
  CreditCard,
  Check,
  Minus,
  AlertTriangle,
  CheckCircle,
  Camera,
  Loader2,
  Globe,
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
  period_days: number
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

// ── ヘルパー関数 ──

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground'
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-ds-app-accent'
  if (score >= 40) return 'text-amber-600'
  return 'text-red-600'
}

function getScoreProgressColor(score: number | null): string {
  if (score === null) return ''
  if (score >= 80) return '[&>div]:bg-green-500'
  if (score >= 60) return '[&>div]:bg-ds-app-accent-soft'
  if (score >= 40) return '[&>div]:bg-amber-500'
  return '[&>div]:bg-red-500'
}

// ギャップ解釈バッジの色（direction 別）
function getGapBadgeClass(direction: string): string {
  if (direction === 'balanced_high') return 'bg-green-100 text-green-700 border-green-200'
  if (direction === 'balanced_low') return 'bg-red-100 text-red-700 border-red-200'
  if (direction === 'empathy_leads' || direction === 'knowledge_leads')
    return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-gray-100 text-gray-600 border-gray-200'
}

function getRankBadgeClass(rank: string | null): string {
  if (!rank || rank === '-') return 'bg-gray-100 text-gray-500 border-gray-200'
  if (rank === 'S') return 'bg-green-100 text-green-700 border-green-200'
  if (rank === 'A+' || rank === 'A') return 'bg-blue-100 text-ds-app-accent-hover border-blue-200'
  if (rank === 'B+' || rank === 'B') return 'bg-amber-100 text-amber-700 border-amber-200'
  if (rank === 'C') return 'bg-orange-100 text-orange-700 border-orange-200'
  return 'bg-gray-100 text-gray-500 border-gray-200'
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
  impressionScore: number | null
  knowledgeGap: KnowledgeGapData | null
}

// ── メインコンポーネント ──

export default function BrandScoreDashboard() {
  const { companyId, company } = useAuth()
  const pathname = usePathname()

  // 機能トグルを踏まえたタブ（定義は lib/constants/dashboard-tabs.ts に集約）
  const visibleTabs = visibleDashboardTabs(company)

  const [period, setPeriod] = useState<string>('30')

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

  // スナップショット手動保存
  const [isSaving, setIsSaving] = useState(false)

  // 印象一致度
  const [impressionScore, setImpressionScore] = useState<number | null>(cached?.impressionScore ?? null)
  const [knowledgeGap, setKnowledgeGap] = useState<KnowledgeGapData | null>(cached?.knowledgeGap ?? null)

  // データ取得（段階的レンダリング：各fetchが終わり次第stateに反映）
  const fetchAll = useCallback(async () => {
    if (!companyId) return

    const periodDays = parseInt(period)
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

    const prevSnapPromise = supabase
      .from('brand_score_snapshots')
      .select('total_score, inner_score, outer_score, rank, snapshot_date')
      .eq('company_id', companyId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (error) return
        const rows = data || []
        const snap = rows.length > 0 ? rows[0] : null
        setPrevSnapshot(snap)
        collected.prevSnapshot = snap
      })

    const snapshotsPromise = fetch(`/api/brand-score/snapshots?company_id=${companyId}`)
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        const list = data.snapshots || []
        setSnapshots(list)
        collected.snapshots = list
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
    Promise.all([innerPromise, outerPromise, prevSnapPromise]).then(() => {
      setLoading(false)
    })

    // 全部終わったらキャッシュ保存
    await Promise.allSettled([innerPromise, outerPromise, tagPromise, fbPromise, prevSnapPromise, snapshotsPromise, knowledgeGapPromise])

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

  // インナースコアの内訳。浸透の5段階を主とし、段階が解決できないサーベイ
  // （設問数が対応表と合わない等）だけ WHY/HOW/WHAT に落とす。
  // 最も低い段階は数字とバーをオレンジにする（サーベイ詳細と同じ方式）
  const innerStageRows: { label: string; value: number | null; isWeakest: boolean }[] = (() => {
    const stageScores = innerScore?.funnel?.overall.stageScores
    if (stageScores && stageScores.length > 0) {
      const rows = FUNNEL_STAGES.map((stage, i) => ({
        label: `${i + 1}. ${STAGE_LABELS[stage]}`,
        value: stageScores.find(s => s.stage === stage)?.score ?? null,
      }))
      const lowest = rows.reduce<number | null>(
        (min, r) => (r.value !== null && (min === null || r.value < min) ? r.value : min),
        null
      )
      return rows.map(r => ({ ...r, isWeakest: r.value !== null && r.value === lowest }))
    }
    return [
      { label: '理念浸透（WHY）', value: innerScore?.scores.why ?? null, isWeakest: false },
      { label: '方針共感（HOW）', value: innerScore?.scores.how ?? null, isWeakest: false },
      { label: '行動体現（WHAT）', value: innerScore?.scores.what ?? null, isWeakest: false },
    ]
  })()

  // 市場浸透の5段階。インナーと同じ形（最下位をオレンジ）で並べ、
  // 左右のカードを同じ目線で見比べられるようにする
  const marketStageRows: { label: string; value: number | null; isWeakest: boolean }[] = (() => {
    const rows = MARKET_STAGES.map((stage, i) => ({
      label: `${i + 1}. ${MARKET_STAGE_LABELS[stage]}`,
      value: outerScore?.market_stages?.[stage] ?? null,
    }))
    const lowest = rows.reduce<number | null>(
      (min, r) => (r.value !== null && (min === null || r.value < min) ? r.value : min),
      null
    )
    return rows.map(r => ({ ...r, isWeakest: r.value !== null && r.value === lowest }))
  })()

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
        <div className="flex gap-6 border-b mb-6">
          {visibleTabs.map(tab => (
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
        <div className="flex gap-6 border-b mb-6">
          {visibleTabs.map(tab => (
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
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-10 text-center">
            <TrendingUp size={48} className="mx-auto mb-4 text-muted-foreground/30" />
            <h2 className="text-base font-bold text-foreground mb-2">ブランドスコアの測定を始めましょう</h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              社内サーベイで「インナースコア」を、名刺閲覧データで「アウタースコア」を測定できます。
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="sm">
                <Link href="/admin/brand-score/surveys">
                  <ClipboardList size={14} />
                  サーベイを作成する
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/members">
                  <CreditCard size={14} />
                  名刺を配布する
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      {/* ── タブバー ── */}
      <div className="flex gap-6 border-b mb-6">
        {visibleTabs.map(tab => (
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
              <SelectItem value="7">7日間</SelectItem>
              <SelectItem value="30">30日間</SelectItem>
              <SelectItem value="90">90日間</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── 2. 総合ブランドスコアカード ── */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-4">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">総合ブランドスコア</span>
            {prevDiff !== null ? (
              <span className={`text-xs font-medium ${prevDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                前回比 {prevDiff >= 0 ? '+' : ''}{prevDiff}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">初回測定</span>
            )}
          </div>
          <div className="flex items-center gap-3 mb-3">
            <span className={`text-4xl font-bold ${getScoreColor(totalBrandScore)}`}>
              {totalBrandScore !== null ? totalBrandScore.toFixed(1) : '-'}
            </span>
            <Badge variant="outline" className={`text-sm font-bold ${getRankBadgeClass(totalRank)}`}>
              {totalRank}
            </Badge>
          </div>
          <Progress
            value={totalBrandScore ?? 0}
            className={`h-2 mb-3 ${getScoreProgressColor(totalBrandScore)}`}
          />
          <div className="flex gap-4 text-xs text-muted-foreground">
            {hasInner && hasOuter ? (
              <>
                <span>インナー {innerScore!.scores.total!.toFixed(1)} × 50%</span>
                <span>アウター {outerScore!.outer_score.toFixed(1)} × 50%</span>
              </>
            ) : hasInner ? (
              <span className="flex items-center gap-1">
                <Eye size={12} />
                アウタースコアのデータ収集中（名刺閲覧データが蓄積されると表示されます）
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Users size={12} />
                インナースコアのデータ収集中（サーベイを実施すると表示されます）
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── 2.5. スコア推移グラフ ── */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-4">
        <CardContent className="p-5">
          <h2 className="text-xs font-bold text-foreground mb-4 flex items-center gap-1.5">
            <TrendingUp size={14} />
            スコア推移
          </h2>

          {snapshots.length === 0 ? (
            <div className="text-center py-8">
              <TrendingUp size={32} className="mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                スコアを記録すると推移グラフが表示されます
              </p>
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={snapshots} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="snapshot_date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => {
                      const d = new Date(v)
                      return `${d.getMonth() + 1}/${d.getDate()}`
                    }}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number | string, name: string) => {
                      const label = name === 'total_score' ? '総合'
                        : name === 'inner_score' ? 'インナー'
                        : 'アウター'
                      return [value != null ? `${Number(value).toFixed(1)}` : '—', label]
                    }}
                    labelFormatter={(label: string) => {
                      const d = new Date(label)
                      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
                    }}
                  />
                  {/* 凡例の文字は黒。線の色は左の印が担うので、
                      文字まで色を付けると系列名が読みにくくなる */}
                  <Legend
                    formatter={(value: string) => (
                      <span className="text-foreground">
                        {value === 'total_score'
                          ? '総合'
                          : value === 'inner_score'
                            ? 'インナー'
                            : 'アウター'}
                      </span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="total_score"
                    stroke="#1f2937"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="inner_score"
                    stroke="var(--ds-app-accent-soft)"
                    strokeWidth={1.5}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="outer_score"
                    stroke="#22c55e"
                    strokeWidth={1.5}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 3. インナー × アウター 2カラム ── */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {/* 左: インナースコア */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Users size={14} />
                インナースコア
              </h2>
              {hasInner && (
                <Badge variant="outline" className={`text-xs font-bold ${getRankBadgeClass(innerScore!.rank)}`}>
                  {innerScore!.rank}
                </Badge>
              )}
            </div>

            {hasInner ? (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <span className={`text-3xl font-bold ${getScoreColor(innerScore!.scores.total)}`}>
                    {innerScore!.scores.total!.toFixed(1)}
                  </span>
                </div>

                {/* 浸透の5段階。段階が解決できないサーベイでは WHY/HOW/WHAT に落とす */}
                {innerStageRows.map(item => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                      <span className={`text-sm font-bold ${item.isWeakest ? 'text-orange-600' : 'text-ds-app-accent'}`}>
                        {item.value !== null ? item.value.toFixed(1) : '-'}
                      </span>
                    </div>
                    <Progress
                      value={item.value ?? 0}
                      className={`h-1.5 ${item.isWeakest ? '[&>div]:bg-orange-500' : '[&>div]:bg-ds-app-accent-soft'}`}
                    />
                  </div>
                ))}

                {/* 回答率 */}
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>回答率</span>
                    <span>{innerScore!.response_count}人 / {innerScore!.survey.total_members}人（{innerScore!.response_rate}%）</span>
                  </div>
                </div>

                <Link
                  href="/admin/brand-score/surveys"
                  className="flex items-center gap-1 text-xs text-foreground hover:underline"
                >
                  サーベイ管理 <ArrowRight size={12} />
                </Link>
              </div>
            ) : (
              <div className="text-center py-6">
                <ClipboardList size={32} className="mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground mb-3">サーベイを実施するとスコアが表示されます</p>
                <Button asChild size="sm" variant="outline">
                  <Link href="/admin/brand-score/surveys">
                    サーベイを作成 <ArrowRight size={12} />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 右: アウタースコア */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Eye size={14} />
                アウタースコア
              </h2>
              {hasOuter && (
                <Badge variant="outline" className={`text-xs font-bold ${getRankBadgeClass(outerScore!.rank)}`}>
                  {outerScore!.rank}
                </Badge>
              )}
            </div>

            {hasOuter ? (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  {/* スコアの水準ではなく系列色で出す。上のスコア推移の
                      アウター線（緑）とカードの中身を対応させるため */}
                  <span className="text-3xl font-bold text-green-600">
                    {outerScore!.outer_score.toFixed(1)}
                  </span>
                </div>

                {/* 市場浸透（外部調査）。調査を取り込んでいない企業では出さない
                    ＝ その場合の見た目は従来と完全に同じ。
                    段階の並べ方・色はインナースコアと揃える（左右で見比べるため） */}
                {outerScore!.market_score !== null && (
                  <>
                    {/* デジタル接点も出るときだけ、どちらの数字かを示す見出しを付ける。
                        市場浸透だけのときはアウタースコアと同じ値なので重複になる */}
                    {outerScore!.digital_unavailable === null && (
                      <p className="m-0 flex items-center gap-1.5 text-xs font-bold text-foreground">
                        <Globe size={12} />
                        市場浸透（外部調査）
                        <span className="ml-auto text-sm text-green-600">
                          {outerScore!.market_score.toFixed(1)}
                        </span>
                      </p>
                    )}

                    {/* バーの基調色はスコア推移グラフのアウター線（green-500）と揃える。
                        インナーが青・アウターが緑で、上のグラフの凡例とそのまま対応する */}
                    {marketStageRows.map(item => (
                      <div key={item.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">{item.label}</span>
                          <span className={`text-sm font-bold ${item.isWeakest ? 'text-orange-600' : 'text-green-600'}`}>
                            {item.value !== null ? item.value.toFixed(1) : '-'}
                          </span>
                        </div>
                        <Progress
                          value={item.value ?? 0}
                          className={`h-1.5 ${item.isWeakest ? '[&>div]:bg-orange-500' : '[&>div]:bg-green-500'}`}
                        />
                      </div>
                    ))}

                    {/* インナーの回答率と同じ位置。調査の規模を添える */}
                    {outerScore!.market_sample_size !== null && (
                      <div className="pt-2 border-t">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>サンプル数</span>
                          <span>n = {outerScore!.market_sample_size}</span>
                        </div>
                      </div>
                    )}

                    <Link
                      href="/admin/brand-score/market-surveys"
                      className="flex items-center gap-1 text-xs text-foreground hover:underline"
                    >
                      市場調査 <ArrowRight size={12} />
                    </Link>
                  </>
                )}

                {/* デジタル接点（名刺ログ）。
                    スマート名刺がオフの会社は名刺ページ自体が非公開なので、
                    ブロックごと出さない（スコアにも算入していない）。
                    アクセスが少なすぎる場合は0点を並べず「未計測」と書く */}
                {outerScore!.digital_unavailable !== 'disabled' && (
                  <>
                    {outerScore!.market_score !== null && (
                      <p className="m-0 flex items-center gap-1.5 text-xs font-bold text-foreground">
                        <CreditCard size={12} />
                        デジタル接点（名刺）
                        <span className="ml-auto text-sm text-foreground">
                          {outerScore!.digital_score?.toFixed(1) ?? '未計測'}
                        </span>
                      </p>
                    )}

                    {outerScore!.digital_unavailable === 'insufficient_data' ? (
                      <p className="m-0 rounded-md border bg-background p-3 text-[11px] leading-relaxed text-muted-foreground">
                        名刺の閲覧が{outerScore!.total_card_views}件で、スコアを出すには
                        足りません（{MIN_CARD_VIEWS_FOR_DIGITAL}件から）。
                        数件のアクセスから関心度や遷移率を判断すると実態とずれるため、
                        アウタースコアには算入していません。
                      </p>
                    ) : (
                      [
                        { label: '到達力', value: outerScore!.scores.reach.score },
                        { label: '関心度', value: outerScore!.scores.interest.score },
                        { label: 'ブランド遷移率', value: outerScore!.scores.transition.score },
                        { label: 'ブランド関与度', value: outerScore!.scores.engagement.score },
                        { label: '印象一致度', value: impressionScore },
                      ].map(item => (
                        <div key={item.label}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">{item.label}</span>
                            {item.value !== null ? (
                              <span className={`text-sm font-bold ${getScoreColor(item.value)}`}>
                                {item.value.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">データ収集中</span>
                            )}
                          </div>
                          <Progress
                            value={item.value ?? 0}
                            className={`h-1.5 ${getScoreProgressColor(item.value)}`}
                          />
                        </div>
                      ))
                    )}

                    <Link
                      href="/admin/analytics"
                      className="flex items-center gap-1 text-xs text-foreground hover:underline"
                    >
                      アナリティクス詳細 <ArrowRight size={12} />
                    </Link>
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <CreditCard size={32} className="mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground mb-3">名刺閲覧データが蓄積されると表示されます</p>
                <Button asChild size="sm" variant="outline">
                  <Link href="/admin/members">
                    名刺を管理 <ArrowRight size={12} />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 3.5. 理解度（知識）× 共感ギャップ ── */}
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

      {/* ── 4. 印象タグ分布 ── */}
      {hasMicroFb && (
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-4">
          <CardContent className="p-5">
            <h2 className="text-xs font-bold text-foreground mb-1 flex items-center gap-1.5">
              <MessageSquare size={14} />
              印象タグ分布
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              直近{period}日間の回答 {totalFbCount}件
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

      {/* ── 5. ギャップ分析 ── */}
      {hasMicroFb && hasTagMappings && (
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
