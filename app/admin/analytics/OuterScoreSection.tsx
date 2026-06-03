'use client'

// アウターブランドスコア セクション
// GET /api/analytics/outer-score からデータ取得し、指標カードを表示
import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Activity, Users, Download, ExternalLink, Timer } from 'lucide-react'

// スコアに応じたカラー
function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e' // green-500
  if (score >= 60) return '#3b82f6' // blue-500
  if (score >= 40) return '#eab308' // yellow-500
  return '#ef4444' // red-500
}

// スコアに応じたTailwindテキスト色
function scoreTextClass(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-blue-600'
  if (score >= 40) return 'text-yellow-600'
  return 'text-red-500'
}

// ランクに応じたバッジ色クラス
function rankBadgeClass(rank: string): string {
  switch (rank) {
    case 'S': return 'bg-green-600 text-white border-green-600'
    case 'A+': return 'bg-blue-600 text-white border-blue-600'
    case 'A': return 'bg-blue-500 text-white border-blue-500'
    case 'B+': return 'bg-yellow-500 text-white border-yellow-500'
    case 'B': return 'bg-yellow-400 text-gray-900 border-yellow-400'
    case 'C': return 'bg-orange-500 text-white border-orange-500'
    default: return 'bg-gray-400 text-white border-gray-400'
  }
}

type ScoreDetail = {
  value: number
  score: number
  weight: number
}

type OuterScoreData = {
  period_days: number
  total_card_views: number
  unique_visitors: number
  member_count: number
  scores: {
    reach: ScoreDetail
    interest: ScoreDetail
    transition: ScoreDetail
    engagement: ScoreDetail
    impression: null
  }
  outer_score: number
  rank: string
}

export function OuterScoreSection({ companyId }: { companyId: string }) {
  const [data, setData] = useState<OuterScoreData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<string>('30')

  const fetchScore = useCallback(async (days: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/analytics/outer-score?company_id=${companyId}&period=${days}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (err) {
      console.error('[OuterScore] fetch エラー:', err)
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    if (!companyId) return
    fetchScore(period)
  }, [companyId, period, fetchScore])

  const handlePeriodChange = (value: string) => {
    setPeriod(value)
  }

  // ローディング
  if (loading) {
    return (
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-3">
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-6">
              <Skeleton className="h-4 w-32 mb-4" />
              <Skeleton className="h-16 w-24 mx-auto mb-2" />
              <Skeleton className="h-6 w-12 mx-auto" />
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="bg-[hsl(0_0%_97%)] border shadow-none">
                <CardContent className="p-4">
                  <Skeleton className="h-3 w-16 mb-2" />
                  <Skeleton className="h-7 w-12 mb-2" />
                  <Skeleton className="h-2 w-full mb-1" />
                  <Skeleton className="h-3 w-28" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    )
  }

  // データなし（PV0件かつ社員0人）
  if (!data || (data.total_card_views === 0 && data.member_count === 0)) {
    return (
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-foreground tracking-wide m-0">
            アウターブランドスコア
          </h2>
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">直近7日</SelectItem>
              <SelectItem value="30">直近30日</SelectItem>
              <SelectItem value="90">直近90日</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-8 text-center">
            <Activity size={32} className="mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground m-0">
              データ収集中です。名刺ページへのアクセスが記録されるとスコアが表示されます。
            </p>
          </CardContent>
        </Card>
      </section>
    )
  }

  const { scores, outer_score, rank } = data

  // 指標カードデータ
  const metrics = [
    {
      key: 'reach',
      label: '到達力',
      icon: Users,
      score: scores.reach.score,
      detail: data.member_count > 0
        ? `社員1人あたり ${(data.unique_visitors / data.member_count).toFixed(1)}人にリーチ`
        : 'リーチ算出中',
    },
    {
      key: 'interest',
      label: '関心度',
      icon: Download,
      score: scores.interest.score,
      detail: `vCard保存率 ${scores.interest.value.toFixed(1)}%`,
    },
    {
      key: 'transition',
      label: 'ブランド遷移率',
      icon: ExternalLink,
      score: scores.transition.score,
      detail: `遷移率 ${scores.transition.value.toFixed(1)}%`,
    },
    {
      key: 'engagement',
      label: 'ブランド関与度',
      icon: Timer,
      score: scores.engagement.score,
      detail: `平均滞在 ${Math.round(scores.engagement.value)}秒`,
    },
  ]

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold text-foreground tracking-wide m-0">
          アウターブランドスコア
        </h2>
        <Select value={period} onValueChange={handlePeriodChange}>
          <SelectTrigger className="w-[130px] h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">直近7日</SelectItem>
            <SelectItem value="30">直近30日</SelectItem>
            <SelectItem value="90">直近90日</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-3">
        {/* メインスコアカード */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-6 flex flex-col items-center justify-center h-full">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={18} className="text-foreground" />
              <h3 className="text-sm font-semibold text-foreground m-0">アウタースコア</h3>
            </div>
            <div className="flex items-baseline gap-1 mb-3">
              <span className={`text-5xl font-bold ${scoreTextClass(outer_score)}`}>
                {outer_score}
              </span>
              <span className="text-lg text-muted-foreground font-medium">/100</span>
            </div>
            <Badge className={`text-sm px-3 py-1 ${rankBadgeClass(rank)}`}>
              {rank}
            </Badge>
            <p className="text-xs text-muted-foreground mt-3 m-0">
              直近{data.period_days}日 / PV {data.total_card_views}件 / UU {data.unique_visitors}人
            </p>
          </CardContent>
        </Card>

        {/* 指標カード 2×2グリッド */}
        <div className="grid grid-cols-2 gap-3">
          {metrics.map(metric => {
            const Icon = metric.icon
            const color = scoreColor(metric.score)
            return (
              <Card key={metric.key} className="bg-[hsl(0_0%_97%)] border shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon size={14} className="text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground">{metric.label}</span>
                  </div>
                  <p className={`text-2xl font-bold m-0 mb-2 ${scoreTextClass(metric.score)}`}>
                    {metric.score}
                  </p>
                  {/* プログレスバー */}
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full rounded-full transition-[width] duration-700 ease-out"
                      style={{
                        width: `${metric.score}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground m-0 leading-tight">
                    {metric.detail}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
