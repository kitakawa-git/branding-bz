'use client'

// ポータルのダッシュボードに出すブランドスコア（読み取り専用）。
// 表示は管理画面と同じ BrandScoreView を使い、ここは取得だけを担う。
// 出す/出さないの判定は呼び出し側（区分ごとの表示設定）が持つ。
import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getPageCache, setPageCache } from '@/lib/page-cache'
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

type CachedData = {
  innerScore: BrandScoreInner | null
  outerScore: BrandScoreOuter | null
  snapshots: BrandScoreSnapshot[]
  marketTrend: TrendPoint[]
  surveyTrend: TrendPoint[]
  prevDiff: number | null
}

export function BrandScorePortalSection({
  companyId,
  surveyHref = null,
  marketSurveyHref = null,
  variant = 'full',
}: {
  companyId: string
  /** サーベイ結果ページへのリンク。区分で見られない場合は null（呼び出し側で判定） */
  surveyHref?: string | null
  /** 市場調査ページへのリンク。区分で見られない場合は null */
  marketSurveyHref?: string | null
  /** 計測の見せ方。呼び出し側で can(company, 'brandScoreFull') を通して決める */
  variant?: 'basic' | 'full'
}) {
  // 同一セッションの再訪では前回取得値でそのまま描画（stale-while-revalidate）
  const cacheKey = `portal-brand-score-${companyId}`
  const cached = getPageCache<CachedData>(cacheKey)

  const [loading, setLoading] = useState(!cached)
  const [innerScore, setInnerScore] = useState<BrandScoreInner | null>(cached?.innerScore ?? null)
  const [outerScore, setOuterScore] = useState<BrandScoreOuter | null>(cached?.outerScore ?? null)
  const [snapshots, setSnapshots] = useState<BrandScoreSnapshot[]>(cached?.snapshots ?? [])
  const [marketTrend, setMarketTrend] = useState<TrendPoint[]>(cached?.marketTrend ?? [])
  const [surveyTrend, setSurveyTrend] = useState<TrendPoint[]>(cached?.surveyTrend ?? [])
  const [prevDiff, setPrevDiff] = useState<number | null>(cached?.prevDiff ?? null)
  const [trendLoading, setTrendLoading] = useState(!cached)

  // 5本すべてを待ってから描くと、いちばん重い inner-score（回答1万行超を
  // 1000件ずつページングするため 0.7〜1秒かかる）に全体が引きずられる。
  // スコアカードに必要なのは inner と outer だけなので、そこが揃った時点で
  // 描き、推移は届き次第あとから差し込む。
  const fetchAll = useCallback(async () => {
    const json = async (url: string) => {
      try {
        const res = await fetch(url)
        return res.ok ? await res.json() : null
      } catch {
        return null
      }
    }

    // 先に全部投げる（直列にしない）
    const innerP = json(`/api/brand-score/inner-score?company_id=${companyId}`)
    const outerP = json(`/api/analytics/outer-score?company_id=${companyId}&period=${PERIOD_DAYS}`)
    const snapsP = json(`/api/brand-score/snapshots?company_id=${companyId}`)
    const marketP = json(`/api/brand-score/market-surveys/trend?company_id=${companyId}`)
    const surveyP = json(`/api/brand-score/surveys/trend?company_id=${companyId}`)

    // 1) スコアカード
    const [inner, outer] = await Promise.all([innerP, outerP])
    // サーベイが1件も無い会社では inner-score API が {score: null, message} を返す。
    // scores を持たない応答は「まだ測っていない」として null に寄せる（管理画面と同じ扱い）。
    // そのまま渡すと描画側の innerScore.scores.total で落ちる
    const innerResult: BrandScoreInner | null = inner?.scores ? inner : null
    const outerResult: BrandScoreOuter | null =
      outer?.outer_score !== undefined ? outer : null
    setInnerScore(innerResult)
    setOuterScore(outerResult)
    setLoading(false)

    // 2) 推移（記録した日 + 調査の実施日）
    const [snaps, market, survey] = await Promise.all([snapsP, marketP, surveyP])
    const snapshotList: BrandScoreSnapshot[] = snaps?.snapshots ?? []

    // 前回比。最新から1つ前の記録との差
    let prevDiffResult: number | null = null
    if (snapshotList.length >= 2) {
      const sorted = [...snapshotList].sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date))
      const [latest, prev] = sorted
      if (latest.total_score !== null && prev.total_score !== null) {
        prevDiffResult = Math.round((latest.total_score - prev.total_score) * 10) / 10
      }
    }

    const marketPoints: TrendPoint[] = (market?.points ?? []).map(
      (p: { date: string; market_score: number | null }) => ({ date: p.date, score: p.market_score })
    )
    const surveyPoints: TrendPoint[] = (survey?.points ?? []).map(
      (p: { date: string; inner_score: number | null }) => ({ date: p.date, score: p.inner_score })
    )

    setSnapshots(snapshotList)
    setPrevDiff(prevDiffResult)
    setMarketTrend(marketPoints)
    setSurveyTrend(surveyPoints)
    setTrendLoading(false)

    setPageCache<CachedData>(cacheKey, {
      innerScore: innerResult,
      outerScore: outerResult,
      snapshots: snapshotList,
      marketTrend: marketPoints,
      surveyTrend: surveyPoints,
      prevDiff: prevDiffResult,
    })
  }, [companyId, cacheKey])

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
  // basic はインナーを見せないので、インナーしか無い会社では空のカードになる。
  // その場合は出さない
  const hasAnything =
    (variant === 'full' && (innerScore?.scores?.total ?? null) !== null) ||
    (outerScore?.outer_score ?? 0) > 0
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
      variant={variant}
      trendLoading={trendLoading}
      // 管理画面と同じく、それぞれの調査結果ページへ飛べるようにする。
      // 区分で見られないページはリンクごと出さない
      innerLink={surveyHref ? { href: surveyHref, label: 'サーベイ結果' } : null}
      outerLink={marketSurveyHref ? { href: marketSurveyHref, label: '市場調査' } : null}
    />
  )
}
