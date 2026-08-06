'use client'

// ポータルのダッシュボードに出すブランドスコア（読み取り専用）。
// 表示は管理画面と同じ BrandScoreView を使い、ここは取得だけを担う。
// 出す/出さないの判定は呼び出し側（区分ごとの表示設定）が持つ。
import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BrandScoreView,
  type BrandScoreInner,
  type BrandScoreOuter,
  type BrandScoreSnapshot,
  type TrendPoint,
} from './BrandScoreView'

/**
 * デジタル接点の集計期間。管理画面の既定と揃える。
 * ポータルでは期間を選ばせない（読むだけの画面で、選択肢が増えると迷う）。
 */
const PERIOD_DAYS = '365'
const PERIOD_LABEL = '1年'

export function BrandScorePortalSection({ companyId }: { companyId: string }) {
  const [loading, setLoading] = useState(true)
  const [innerScore, setInnerScore] = useState<BrandScoreInner | null>(null)
  const [outerScore, setOuterScore] = useState<BrandScoreOuter | null>(null)
  const [snapshots, setSnapshots] = useState<BrandScoreSnapshot[]>([])
  const [marketTrend, setMarketTrend] = useState<TrendPoint[]>([])
  const [surveyTrend, setSurveyTrend] = useState<TrendPoint[]>([])
  const [prevDiff, setPrevDiff] = useState<number | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const json = async (url: string) => {
        const res = await fetch(url)
        return res.ok ? await res.json() : null
      }

      const [inner, outer, snaps, market, survey] = await Promise.all([
        json(`/api/brand-score/inner-score?company_id=${companyId}`),
        json(`/api/analytics/outer-score?company_id=${companyId}&period=${PERIOD_DAYS}`),
        json(`/api/brand-score/snapshots?company_id=${companyId}`),
        json(`/api/brand-score/market-surveys/trend?company_id=${companyId}`),
        json(`/api/brand-score/surveys/trend?company_id=${companyId}`),
      ])

      setInnerScore(inner ?? null)
      setOuterScore(outer ?? null)

      const list: BrandScoreSnapshot[] = snaps?.snapshots ?? []
      setSnapshots(list)

      // 前回比。最新から1つ前の記録との差
      if (list.length >= 2) {
        const sorted = [...list].sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date))
        const [latest, prev] = sorted
        if (latest.total_score !== null && prev.total_score !== null) {
          setPrevDiff(Math.round((latest.total_score - prev.total_score) * 10) / 10)
        }
      }

      setMarketTrend(
        (market?.points ?? []).map((p: { date: string; market_score: number | null }) => ({
          date: p.date,
          score: p.market_score,
        }))
      )
      setSurveyTrend(
        (survey?.points ?? []).map((p: { date: string; inner_score: number | null }) => ({
          date: p.date,
          score: p.inner_score,
        }))
      )
    } catch (err) {
      console.error('[BrandScorePortal] 取得エラー:', err)
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  if (loading) {
    return (
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-4">
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-2 w-full" />
        </CardContent>
      </Card>
    )
  }

  // まだ何も測っていない会社では、空のカードを並べても読むものが無い
  const hasAnything =
    (innerScore?.scores.total ?? null) !== null || (outerScore?.outer_score ?? 0) > 0
  if (!hasAnything) return null

  return (
    <BrandScoreView
      innerScore={innerScore}
      outerScore={outerScore}
      snapshots={snapshots}
      marketTrend={marketTrend}
      surveyTrend={surveyTrend}
      prevDiff={prevDiff}
      // 印象一致度（マイクロフィードバックのタグ由来）はポータルでは出さない。
      // 期待タグの設定は管理画面の話で、読み手が動かせるものではない
      impressionScore={null}
      periodLabel={PERIOD_LABEL}
      readOnly
    />
  )
}
