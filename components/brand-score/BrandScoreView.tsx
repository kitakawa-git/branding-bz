'use client'

// ブランドスコアのビュー（読み取り専用・自己完結）。
// 管理画面のブランドスコアと、ポータルのダッシュボード（管理職以上）で使う。
// 集計は props で受け取り、ここでは表示に必要な派生値だけを組み立てる。
// 同じ数字を2箇所で別々に計算すると、画面ごとに違う点数が出るため。
//
// readOnly=true（ポータル）では管理画面へのリンクとボタンを出さない。
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
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
import {
  ArrowRight,
  TrendingUp,
  Users,
  Eye,
  ClipboardList,
  CreditCard,
  Globe,
} from 'lucide-react'
import {
  FUNNEL_STAGES,
  STAGE_LABELS,
  type FunnelStage,
} from '@/lib/brand-score/funnel-stages'
import { MARKET_STAGES, MARKET_STAGE_LABELS } from '@/lib/brand-score/market-stages'
import { MIN_CARD_VIEWS_FOR_DIGITAL } from '@/lib/brand-score/outer-metrics'

// ── 型（各APIのレスポンス） ──

export interface BrandScoreInner {
  survey: { id: string; title: string; status: string; total_members: number }
  response_rate: number
  response_count: number
  scores: { total: number | null; why: number | null; how: number | null; what: number | null }
  rank: string
  funnel: {
    overall: { stageScores: { stage: FunnelStage; score: number | null }[] }
  } | null
}

export interface BrandScoreOuter {
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
  market_score: number | null
  market_stages: Record<string, number> | null
  market_sample_size: number | null
  digital_score: number | null
  digital_unavailable: 'disabled' | 'insufficient_data' | null
}

export interface BrandScoreSnapshot {
  total_score: number | null
  inner_score: number | null
  outer_score: number | null
  rank: string | null
  snapshot_date: string
}

export interface TrendPoint {
  date: string
  score: number | null
}

/** スコア推移グラフの1行。記録した日と調査を実施した日を束ねたもの */
type TrendRow = {
  snapshot_date: string
  total_score: number | null
  inner_score: number | null
  outer_score: number | null
  /** その値が調査の実施日のものか（記録した日ではない）。点の大きさを変える */
  measured: { total: boolean; inner: boolean; outer: boolean }
}

export interface BrandScoreViewProps {
  innerScore: BrandScoreInner | null
  outerScore: BrandScoreOuter | null
  snapshots: BrandScoreSnapshot[]
  /** 市場調査の実施日ごとの市場浸透スコア */
  marketTrend: TrendPoint[]
  /** サーベイの実施日（終了日）ごとのインナースコア */
  surveyTrend: TrendPoint[]
  /** 前回記録との差。null なら「初回測定」と出す */
  prevDiff: number | null
  /** マイクロフィードバックのタグ由来の印象一致度 */
  impressionScore: number | null
  /** デジタル接点の集計期間ラベル（「1年」など） */
  periodLabel: string
  /** ポータルでは管理画面へのリンクとボタンを出さない */
  readOnly?: boolean
  /**
   * 計測の見せ方（v4 で split を入れ替え。以前は basic=アウター / full=インナー だった）。
   * - 'basic' … インナー由来のみ（サーベイのスコア・段階・推移のインナー系列）。
   *             自社だけで完結する自己計測なので Premium から使える。
   *             総合スコアは inner×50%+outer×50% の合成なので basic では出さず、
   *             インナースコアだけを見せる
   * - 'full'  … 統合スコア（インナー×アウター）＋市場調査を含むアウターまで全部。
   *             外の目線は伴走とセットなので Enterprise。
   * 判定は呼び出し側で can(company, 'brandScoreIntegrated') を通すこと。
   */
  variant?: 'basic' | 'full'
  /** 推移のデータだけ遅れて届く場合。空状態ではなくスケルトンを出す */
  trendLoading?: boolean
  /**
   * インナースコアカード末尾のリンク。
   * 省略時は管理画面のサーベイ管理（readOnly なら出さない）。
   * ポータルからは区分で見られる場合だけ `/portal/survey` を渡す。
   */
  innerLink?: { href: string; label: string } | null
  /**
   * 市場浸透ブロック末尾のリンク。
   * 省略時は管理画面の市場調査（readOnly なら出さない）。
   */
  outerLink?: { href: string; label: string } | null
}

// ── 表示ヘルパー ──

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

/**
 * スコア推移の点。調査を実施した日は大きい塗り丸、記録した日は小さい丸。
 * 同じ系列でも「測った日」と「記録した日」で意味が違うため、
 * 線は1本のまま点の見た目だけで出どころを分ける。
 */
function measuredDot(key: 'total' | 'inner' | 'outer', color: string) {
  const Dot = (props: {
    cx?: number
    cy?: number
    payload?: { measured?: { total: boolean; inner: boolean; outer: boolean } }
  }) => {
    const { cx, cy, payload } = props
    if (cx === undefined || cy === undefined) return <g />
    const isMeasured = payload?.measured?.[key] === true
    return (
      <circle
        cx={cx}
        cy={cy}
        r={isMeasured ? 5 : 3}
        fill={isMeasured ? color : '#fff'}
        stroke={color}
        strokeWidth={isMeasured ? 0 : 1.5}
      />
    )
  }
  return Dot
}

export function BrandScoreView({
  innerScore,
  outerScore,
  snapshots,
  marketTrend,
  surveyTrend,
  prevDiff,
  impressionScore,
  periodLabel,
  readOnly = false,
  variant = 'full',
  trendLoading = false,
  innerLink,
  outerLink,
}: BrandScoreViewProps) {
  // basic ではアウター由来と市場調査を見せない。呼び出し側がデータを渡していても
  // ここで落とすので、片方だけ直して漏れる事故が起きない
  const isFull = variant === 'full'

  // scores ごと欠けた応答（サーベイ未実施の会社）でも落ちないよう ?. で見る。
  // 以降の innerScore!.scores.total! はすべてこの hasInner が守る
  const hasInner = innerScore != null && innerScore.scores?.total != null
  // アウター（市場調査を含む外の目線）は Enterprise 側
  const hasOuter = isFull && outerScore !== null && outerScore.outer_score > 0

  // ポータルの basic は出すカードがインナーと推移の2枚だけなので、横に並べる。
  // full はインナー×アウターの対比が主役で、そこに推移を混ぜると組が崩れるため縦のまま。
  // 管理画面は縦に読ませる面なので変えない（readOnly がポータルの目印）
  const sideBySide = readOnly && !isFull

  // 未指定なら従来どおり管理画面へのリンク（readOnly では出さない）。
  // null を明示的に渡した場合はリンクなし。
  const resolvedInnerLink =
    innerLink !== undefined
      ? innerLink
      : readOnly
        ? null
        : { href: '/admin/brand-score/surveys', label: 'サーベイ管理' }
  const resolvedOuterLink =
    outerLink !== undefined
      ? outerLink
      : readOnly
        ? null
        : { href: '/admin/brand-score/market-surveys', label: '市場調査' }

  // 総合ブランドスコア
  let totalBrandScore: number | null = null
  if (hasInner && hasOuter) {
    totalBrandScore =
      Math.round((innerScore!.scores.total! * 0.5 + outerScore!.outer_score * 0.5) * 10) / 10
  } else if (hasInner) {
    totalBrandScore = innerScore!.scores.total
  } else if (hasOuter) {
    totalBrandScore = Math.round(outerScore!.outer_score * 10) / 10
  }
  const totalRank = getRank(totalBrandScore)

  // インナーの5段階。段階が解決できないサーベイだけ WHY/HOW/WHAT に落とす。
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

  // 市場浸透の5段階。インナーと同じ形（最下位をオレンジ）で並べる
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

  // スコア推移。記録した日（スナップショット）と調査を実施した日は別ソースなので、
  // 日付で束ねて1本の時系列にする。市場調査をスナップショットに転記しないのは、
  // あちらが「総合＝インナー×50%＋アウター×50%」の合成値で、
  // 市場浸透だけ過去日に差し込むと総合の意味が壊れるため
  const trendRows: TrendRow[] = (() => {
    // サーベイの終了日はタイムスタンプ（2026-07-27T17:31Z＝JSTの7/28）で来る。
    // 日付だけのスナップショットと束ねるため、表示と同じ現地時刻の日付に丸める
    const dateKey = (v: string) => {
      const d = new Date(v)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    const byDate = new Map<string, TrendRow>()
    const row = (date: string): TrendRow => {
      const key = dateKey(date)
      const hit = byDate.get(key)
      if (hit) return hit
      const created: TrendRow = {
        snapshot_date: key,
        total_score: null,
        inner_score: null,
        outer_score: null,
        measured: { total: false, inner: false, outer: false },
      }
      byDate.set(key, created)
      return created
    }
    for (const s of snapshots) {
      const r = row(s.snapshot_date)
      // basic はインナーだけの推移。総合はアウターとの合成なので出さない。
      // スナップショット自体は全社ぶん記録し続けている（表示だけを絞る）
      r.total_score = isFull ? s.total_score : null
      r.inner_score = s.inner_score
      r.outer_score = isFull ? s.outer_score : null
    }

    // 調査で測った値は、記録日のスコアと同じ系列に入れる。
    // 「7/28に測ったインナー62.0」と「8/5に記録したインナー62.0」は
    // 同じ指標の別の日の値なので、線がつながるのが自然。
    // 記録日に既に値があればそちらを優先する（記録が正本）
    // サーベイの実施日はインナー系列なので basic でも入れる
    {
      for (const t of surveyTrend) {
        if (t.score === null) continue
        const r = row(t.date)
        if (r.inner_score === null) {
          r.inner_score = t.score
          r.measured.inner = true
        }
      }
    }

    // ⚠ 市場浸透をアウターとして扱えるのは、デジタル接点を計測していない
    //    会社だけ。計測していると実際のアウターは市場浸透0.75＋デジタル0.25で、
    //    過去日のデジタル接点（直近30日の集計）は遡って計算できない
    const digitalCounted = outerScore !== null && outerScore.digital_unavailable === null

    // 市場調査は Enterprise 側なので basic では系列に混ぜない
    if (isFull && !digitalCounted) {
      for (const m of marketTrend) {
        if (m.score === null) continue
        const r = row(m.date)
        if (r.outer_score === null) {
          r.outer_score = m.score
          r.measured.outer = true
        }
      }

      // 調査日ベースの総合。インナーと市場調査は実施日が数十日ずれるので、
      // 近い時期どうしを組にして「2つの調査日の中間」に置く。
      // 片方の調査日に寄せると、平均なのに一方の測定に属して見えるうえ、
      // その日の点（インナーなど）と重なって読めなくなる
      const PAIR_WINDOW_DAYS = 180
      for (const t of surveyTrend) {
        if (t.score === null) continue
        const innerTime = new Date(t.date).getTime()
        let nearest: TrendPoint | null = null
        let nearestGap = Infinity
        for (const m of marketTrend) {
          if (m.score === null) continue
          const gap = Math.abs(new Date(m.date).getTime() - innerTime)
          if (gap < nearestGap) {
            nearest = m
            nearestGap = gap
          }
        }
        if (!nearest || nearestGap > PAIR_WINDOW_DAYS * 24 * 60 * 60 * 1000) continue

        const midpoint = new Date(
          (innerTime + new Date(nearest.date).getTime()) / 2
        ).toISOString()
        const r = row(midpoint)
        if (r.total_score === null) {
          r.total_score =
            Math.round(((t.score + (nearest.score as number)) / 2) * 10) / 10
          r.measured.total = true
        }
      }
    }

    return [...byDate.values()].sort((a, b) =>
      a.snapshot_date.localeCompare(b.snapshot_date)
    )
  })()

  return (
    <>
  {/* ── 2. 総合ブランドスコアカード ──
      full では「総合＝インナー×50%＋アウター×50%」で下のカードとは別の数字だが、
      basic は合成相手がいないのでインナースコアそのもの＝下のカードと同じ数字になる。
      ポータルは Enterprise 導線も出さない（readOnly）ので重複しか残らず、丸ごと出さない。
      ⚠️ 「初回測定／前回比」はこのカードにしかないので、basic のポータルでは出なくなる */}
  {!sideBySide && (
  <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-4">
    <CardContent className="p-6">
      <div className="flex items-center justify-between mb-3">
        {/* basic はアウターを含まないので「総合」と名乗れない（合成の半分が無い） */}
        <span className="text-sm text-muted-foreground">
          {isFull ? '総合ブランドスコア' : 'インナースコア'}
        </span>
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
        ) : !isFull ? (
          // basic は社員サーベイだけで出している旨を明示し、
          // その場で総合（Enterprise）への導線を出す。
          // アップセル面も兼ねるので、ここが唯一の入口になる
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1">
              <Users size={12} />
              社員へのインナーサーベイから算出
            </span>
            {!readOnly && (
              <Link
                href="/contact"
                className="flex items-center gap-1 text-foreground hover:underline"
              >
                市場調査を含む総合スコアで見る（Enterprise） <ArrowRight size={12} />
              </Link>
            )}
          </span>
        ) : hasInner ? (
          <span className="flex items-center gap-1">
            <Eye size={12} />
            アウタースコアのデータ収集中（市場調査の取り込み、または名刺の閲覧
            {MIN_CARD_VIEWS_FOR_DIGITAL}件から表示されます）
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
  )}

  {/* ポータルの basic だけ「インナー（左）／推移（右）」の2カラムにする。
      JSX の順序は変えず、親をグリッドにして order で入れ替える */}
  <div
    className={
      sideBySide
        ? 'mb-4 grid overflow-hidden rounded-xl border bg-[hsl(0_0%_97%)] md:grid-cols-2 md:items-stretch'
        : ''
    }
  >

  {/* ── 2.5. スコア推移グラフ ──
      v4 でインナーの推移は Premium の範囲になったので basic でも出す。
      ただし系列は上の trendRows で絞ってあり、basic ではインナー1本だけが引かれる
      （総合とアウターは null）。⚠️ 枠だけ出して系列を null にする作りは、
      「使えないはずの機能の枠が見える」事故のもとなので、
      出す/出さないを分けるときは必ずカードごと出し分けること */}
  <Card
    className={
      sideBySide
        ? 'mb-0 rounded-none border-0 border-t bg-transparent shadow-none md:order-2 md:border-l md:border-t-0'
        : 'bg-[hsl(0_0%_97%)] border shadow-none mb-4'
    }
  >
    <CardContent className="p-5">
      <h2 className="text-xs font-bold text-foreground mb-4 flex items-center gap-1.5">
        <TrendingUp size={14} />
        スコア推移
      </h2>
      {/* 点の意味は凡例では表せないので一文で添える。
          basic は系列がインナー1本だけで、線の読み分けが要らない。
          説明文も凡例も情報を足さないので出さない */}
      {isFull && (
        <p className="m-0 -mt-2 mb-4 text-xs text-muted-foreground">
          塗りつぶした点は調査を実施した日、白い点はスコアを記録した日です。
        </p>
      )}

      {trendRows.length === 0 && trendLoading ? (
        // 推移だけ取得が遅れているとき。「記録がありません」と出すと
        // 一瞬だけ誤った案内が見えてしまう
        <div className="h-64 animate-pulse rounded-lg bg-muted/50" />
      ) : trendRows.length === 0 ? (
        <div className="text-center py-8">
          <TrendingUp size={32} className="mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            スコアを記録すると推移グラフが表示されます
          </p>
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendRows} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
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
                  文字まで色を付けると系列名が読みにくくなる。
                  basic は1本だけなので凡例そのものを出さない */}
              {isFull && (
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
              )}
              {/* ⚠️ basic では総合とアウターの <Line> ごと外す。データを null にするだけだと
                  Recharts が凡例（総合・アウター）を出してしまい、使えないはずの系列が見える */}
              {isFull && (
                <Line
                  type="monotone"
                  dataKey="total_score"
                  stroke="#1f2937"
                  strokeWidth={2.5}
                  dot={measuredDot('total', '#1f2937')}
                  connectNulls
                />
              )}
              <Line
                type="monotone"
                dataKey="inner_score"
                stroke="var(--ds-app-accent-soft)"
                strokeWidth={1.5}
                dot={measuredDot('inner', 'var(--ds-app-accent-soft)')}
                connectNulls
              />
              {isFull && (
                <Line
                  type="monotone"
                  dataKey="outer_score"
                  stroke="#22c55e"
                  strokeWidth={1.5}
                  dot={measuredDot('outer', '#22c55e')}
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </CardContent>
  </Card>

  {/* ── 3. インナー × アウター 2カラム ──
      アウターは Enterprise 側なので basic ではインナーだけを全幅で出す */}
  <div className={`grid ${isFull ? 'gap-4 mb-6 md:grid-cols-2' : sideBySide ? 'mb-0 md:order-1' : 'gap-4 mb-6'}`}>
    {/* 左: インナースコア */}
    <Card
      className={
        sideBySide
          ? 'rounded-none border-0 bg-transparent shadow-none'
          : 'bg-[hsl(0_0%_97%)] border shadow-none'
      }
    >
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

            {resolvedInnerLink && (
              <Link
                href={resolvedInnerLink.href}
                className="flex items-center gap-1 text-xs text-foreground hover:underline"
              >
                {resolvedInnerLink.label} <ArrowRight size={12} />
              </Link>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <ClipboardList size={32} className="mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground mb-3">サーベイを実施するとスコアが表示されます</p>
            {!readOnly && (
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/brand-score/surveys">
                  サーベイを作成 <ArrowRight size={12} />
                </Link>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>

    {/* 右: アウタースコア（市場調査を含む外の目線＝Enterprise 側） */}
    {isFull && (
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
            {/* 市場調査は Enterprise の「計測（伴走つき）」側。basic では出さない */}
            {isFull && outerScore!.market_score !== null && (
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

                {resolvedOuterLink && (
                  <Link
                    href={resolvedOuterLink.href}
                    className="flex items-center gap-1 text-xs text-foreground hover:underline"
                  >
                    {resolvedOuterLink.label} <ArrowRight size={12} />
                  </Link>
                )}
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
                    {periodLabel}で名刺の閲覧が
                    {outerScore!.total_card_views}件で、スコアを出すには
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

                {!readOnly && (
                  <Link
                    href="/admin/analytics"
                    className="flex items-center gap-1 text-xs text-foreground hover:underline"
                  >
                    アナリティクス詳細 <ArrowRight size={12} />
                  </Link>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <CreditCard size={32} className="mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground mb-3">
              名刺の閲覧が{MIN_CARD_VIEWS_FOR_DIGITAL}件たまると表示されます
            </p>
            {!readOnly && (
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/card-template">
                  QRコードを配布 <ArrowRight size={12} />
                </Link>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
    )}
  </div>

  </div>

    </>
  )
}
