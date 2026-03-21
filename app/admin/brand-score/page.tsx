'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '../components/AuthProvider'
import { supabase } from '@/lib/supabase'
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
  BarChart3,
  ArrowRight,
  TrendingUp,
  Users,
  Eye,
  MessageSquare,
  ClipboardList,
  CreditCard,
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
  if (score >= 60) return 'text-blue-600'
  if (score >= 40) return 'text-yellow-600'
  return 'text-red-600'
}

function getScoreProgressColor(score: number | null): string {
  if (score === null) return ''
  if (score >= 80) return '[&>div]:bg-green-500'
  if (score >= 60) return '[&>div]:bg-blue-500'
  if (score >= 40) return '[&>div]:bg-yellow-500'
  return '[&>div]:bg-red-500'
}

function getHeatmapBg(score: number | null): string {
  if (score === null) return ''
  if (score >= 80) return 'bg-green-50 text-green-700'
  if (score >= 60) return 'bg-blue-50 text-blue-700'
  if (score >= 40) return 'bg-yellow-50 text-yellow-700'
  return 'bg-red-50 text-red-700'
}

function getRankBadgeClass(rank: string | null): string {
  if (!rank || rank === '-') return 'bg-gray-100 text-gray-500 border-gray-200'
  if (rank === 'S') return 'bg-green-100 text-green-700 border-green-200'
  if (rank === 'A+' || rank === 'A') return 'bg-blue-100 text-blue-700 border-blue-200'
  if (rank === 'B+' || rank === 'B') return 'bg-yellow-100 text-yellow-700 border-yellow-200'
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
  if (rate >= 20) return 'bg-blue-500'
  if (rate >= 10) return 'bg-yellow-500'
  return 'bg-gray-300'
}

const ALL_TAGS = [
  '信頼感', '革新的', '親しみやすい', '専門的',
  '洗練された', '情熱的', '堅実', '遊び心がある',
]

const dashboardTabs = [
  { label: 'スコア', href: '/admin/brand-score' },
  { label: 'タイムライン投稿', href: '/admin/dashboard' },
  { label: 'スマート名刺', href: '/admin/analytics' },
]

// ── メインコンポーネント ──

export default function BrandScoreDashboard() {
  const { companyId } = useAuth()
  const pathname = usePathname()

  const [period, setPeriod] = useState<string>('30')
  const [loading, setLoading] = useState(true)

  const [innerScore, setInnerScore] = useState<InnerScoreData | null>(null)
  const [outerScore, setOuterScore] = useState<OuterScoreData | null>(null)
  const [tagMappings, setTagMappings] = useState<TagMapping[]>([])
  const [tagCounts, setTagCounts] = useState<TagCount[]>([])
  const [totalFbCount, setTotalFbCount] = useState(0)
  const [prevSnapshot, setPrevSnapshot] = useState<Snapshot | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])

  // スナップショット手動保存
  const [isSaving, setIsSaving] = useState(false)

  // 印象一致度
  const [impressionScore, setImpressionScore] = useState<number | null>(null)

  // データ取得
  const fetchAll = useCallback(async () => {
    if (!companyId) return
    setLoading(true)

    try {
      // 3 API + Supabase直接クエリを並列
      const periodDays = parseInt(period)
      const sinceDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()

      const [innerRes, outerRes, tagRes, fbRes, snapRes, snapshotsRes] = await Promise.allSettled([
        fetch(`/api/brand-score/inner-score?company_id=${companyId}`),
        fetch(`/api/analytics/outer-score?company_id=${companyId}&period=${period}`),
        fetch(`/api/brand-score/tag-mappings?company_id=${companyId}`),
        supabase
          .from('brand_micro_feedbacks')
          .select('tags')
          .eq('company_id', companyId)
          .gte('created_at', sinceDate),
        supabase
          .from('brand_score_snapshots')
          .select('total_score, inner_score, outer_score, rank, snapshot_date')
          .eq('company_id', companyId)
          .order('snapshot_date', { ascending: false })
          .limit(1),
        fetch(`/api/brand-score/snapshots?company_id=${companyId}`),
      ])

      // インナースコア
      if (innerRes.status === 'fulfilled' && innerRes.value.ok) {
        const data = await innerRes.value.json()
        if (data.scores) setInnerScore(data)
      }

      // アウタースコア
      if (outerRes.status === 'fulfilled' && outerRes.value.ok) {
        const data = await outerRes.value.json()
        if (data.outer_score !== undefined) setOuterScore(data)
      }

      // タグマッピング
      if (tagRes.status === 'fulfilled' && tagRes.value.ok) {
        const data = await tagRes.value.json()
        setTagMappings(data.mappings || [])
      }

      // マイクロFB集計
      if (fbRes.status === 'fulfilled' && !fbRes.value.error) {
        const rows = fbRes.value.data || []
        setTotalFbCount(rows.length)

        // タグ別カウント
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

        // 印象一致度算出（30件以上必要）
        if (rows.length >= 30) {
          const expectedTags = (tagMappings.length > 0 ? tagMappings : []).filter(m => m.is_expected).map(m => m.tag)
          if (expectedTags.length > 0) {
            // 選択率TOP3に入っている期待タグの割合
            const top3Tags = counts.slice(0, 3).map(c => c.tag)
            const matchCount = expectedTags.filter(t => top3Tags.includes(t)).length
            const score = Math.round((matchCount / expectedTags.length) * 100)
            setImpressionScore(score)
          }
        } else {
          setImpressionScore(null)
        }
      }

      // 前回スナップショット
      if (snapRes.status === 'fulfilled' && !snapRes.value.error) {
        const rows = snapRes.value.data || []
        setPrevSnapshot(rows.length > 0 ? rows[0] : null)
      }

      // スナップショット一覧（時系列グラフ用）
      if (snapshotsRes.status === 'fulfilled' && snapshotsRes.value.ok) {
        const data = await snapshotsRes.value.json()
        setSnapshots(data.snapshots || [])
      }
    } catch (err) {
      console.error('[BrandScore] データ取得エラー:', err)
    } finally {
      setLoading(false)
    }
  }, [companyId, period, tagMappings])

  useEffect(() => {
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

      {/* ── 1. ヘッダー ── */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <BarChart3 size={20} />
          ブランドスコア
        </h1>
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={isSaving}>
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
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-6">
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
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-6">
        <CardContent className="p-5">
          <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-1.5">
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
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip
                    formatter={(value: any, name: any) => {
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
                  <Legend
                    formatter={(value: string) =>
                      value === 'total_score' ? '総合'
                        : value === 'inner_score' ? 'インナー'
                        : 'アウター'
                    }
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
                    stroke="#3b82f6"
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
              <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
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

                {/* WHY / HOW / WHAT */}
                {[
                  { label: '理念浸透（WHY）', value: innerScore!.scores.why, weight: '35%' },
                  { label: '方針共感（HOW）', value: innerScore!.scores.how, weight: '30%' },
                  { label: '行動体現（WHAT）', value: innerScore!.scores.what, weight: '35%' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                      <span className={`text-sm font-bold ${getScoreColor(item.value)}`}>
                        {item.value !== null ? item.value.toFixed(1) : '-'}
                      </span>
                    </div>
                    <Progress
                      value={item.value ?? 0}
                      className={`h-1.5 ${getScoreProgressColor(item.value)}`}
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
                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
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
              <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
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
                  <span className={`text-3xl font-bold ${getScoreColor(outerScore!.outer_score)}`}>
                    {outerScore!.outer_score.toFixed(1)}
                  </span>
                </div>

                {/* 5指標 */}
                {[
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
                ))}

                <Link
                  href="/admin/analytics"
                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  アナリティクス詳細 <ArrowRight size={12} />
                </Link>
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

      {/* ── 4. 印象タグ分布 ── */}
      {hasMicroFb && (
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-6">
          <CardContent className="p-5">
            <h2 className="text-sm font-bold text-foreground mb-1 flex items-center gap-1.5">
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
                          <Check size={12} className="text-blue-500 shrink-0" />
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
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-6">
          <CardContent className="p-5">
            <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-1.5">
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
                              <Check size={14} className="mx-auto text-blue-500" />
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

      {/* ── 6. 部署別ヒートマップ ── */}
      {hasInner && innerScore!.by_department.length > 0 && (
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-6">
          <CardContent className="p-5">
            <h2 className="text-sm font-bold text-foreground mb-4">部署別スコア</h2>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs font-semibold">部署</TableHead>
                    <TableHead className="text-xs font-semibold text-center">WHY</TableHead>
                    <TableHead className="text-xs font-semibold text-center">HOW</TableHead>
                    <TableHead className="text-xs font-semibold text-center">WHAT</TableHead>
                    <TableHead className="text-xs font-semibold text-center">総合</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {innerScore!.by_department.map(d => (
                    <TableRow key={d.department}>
                      <TableCell className="text-sm font-medium">{d.department}</TableCell>
                      <TableCell className={`text-sm text-center font-semibold ${getHeatmapBg(d.why)}`}>
                        {d.why !== null ? d.why.toFixed(1) : '-'}
                      </TableCell>
                      <TableCell className={`text-sm text-center font-semibold ${getHeatmapBg(d.how)}`}>
                        {d.how !== null ? d.how.toFixed(1) : '-'}
                      </TableCell>
                      <TableCell className={`text-sm text-center font-semibold ${getHeatmapBg(d.what)}`}>
                        {d.what !== null ? d.what.toFixed(1) : '-'}
                      </TableCell>
                      <TableCell className={`text-sm text-center font-bold ${getHeatmapBg(d.total)}`}>
                        {d.total !== null ? d.total.toFixed(1) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 7. 自動記録設定 ── */}
      {companyId && (
        <SnapshotScheduleCard companyId={companyId} />
      )}
    </div>
  )
}
