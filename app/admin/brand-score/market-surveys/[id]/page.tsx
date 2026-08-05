'use client'

// 市場調査の詳細（市場浸透の5段階）
// サーベイ詳細の「段階別の詳細」と同じ体裁にして、社内と社外を同じ形で読めるようにする
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Settings2, CalendarDays, Users, Loader2, ClipboardList, Trophy } from 'lucide-react'
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell as RCell,
  ReferenceLine,
  Tooltip,
} from 'recharts'
import {
  MARKET_STAGES,
  MARKET_STAGE_LABELS,
  MARKET_STAGE_QUESTIONS,
  MARKET_PIVOT_STAGE,
  type MarketStage,
} from '@/lib/brand-score/market-stages'
import {
  MIN_BENCHMARK_BASE_N,
  computeMarketScore,
} from '@/lib/brand-score/market-stage-score'

type Survey = {
  id: string
  title: string
  research_firm: string
  fielded_from: string | null
  fielded_to: string | null
  sample_size: number | null
  status: string
}

type RankRow = { name: string; value: number; isSelf: boolean }

type RankedItem = { label: string; value: number }
type Listed = { items: RankedItem[]; baseN: number | null } | null

/** 5段階以外の読みどころ。取れなければ null（0にはしない） */
type Extras = {
  impression: {
    importance: RankedItem[]
    image: RankedItem[]
    matches: {
      label: string
      importanceRank: number
      importanceValue: number
      imageRank: number
      imageValue: number
    }[]
    hits: string[]
    misses: string[]
    overs: string[]
    score: number | null
    importanceBaseN: number | null
    imageBaseN: number | null
  } | null
  personality: {
    items: { positive: string; negative: string; value: number }[]
    baseN: number | null
  } | null
  contactPoints: Listed
  services: Listed
  serviceEvaluation: Listed
}

type StageScore = {
  stage: MarketStage
  status: 'scored' | 'absent' | 'unmapped'
  raw_percent: number | null
  score: number | null
  base_n: number | null
  benchmark: {
    competitorMax: number
    competitorAvg: number
    rank: number
    n: number
    /** 母数不足で比較から外した競合の数（古い記録には無い） */
    excluded?: number
  } | null
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: '設定中', className: 'bg-amber-100 text-amber-700' },
  active: { label: '反映中', className: 'bg-green-100 text-green-700' },
  archived: { label: '過年度', className: 'bg-gray-100 text-gray-500' },
}


/**
 * 項目を降順に並べた横棒。
 * 上位ほど濃くはせず、母数の注記だけを添える（%の絶対値だけで語らないため）。
 */
function RankBars({
  items,
  max = 8,
  suffix = '%',
}: {
  items: { label: string; value: number }[]
  max?: number
  suffix?: string
}) {
  const shown = items.slice(0, max)
  const top = shown.length > 0 ? Math.max(...shown.map((i) => i.value)) : 0
  return (
    <div className="space-y-1.5">
      {shown.map((it) => (
        <div key={it.label} className="flex items-center gap-2">
          <span className="w-[136px] shrink-0 truncate text-[11px] text-muted-foreground" title={it.label}>
            {it.label}
          </span>
          <div className="h-2 min-w-0 flex-1 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-green-500"
              style={{ width: `${top > 0 ? (it.value / top) * 100 : 0}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-foreground">
            {it.value.toFixed(1)}
            {suffix}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function MarketSurveyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const surveyId = params.id as string

  const [survey, setSurvey] = useState<Survey | null>(null)
  const [stageScores, setStageScores] = useState<StageScore[]>([])
  const [ranking, setRanking] = useState<Record<string, RankRow[]>>({})
  const [extras, setExtras] = useState<Extras | null>(null)
  const [blockCount, setBlockCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // タイトルの直接編集。取り込み時のファイル名がそのまま入るので、
  // 後から読みやすい名前に直したい場面のほうが多い（サーベイ詳細と同じ挙動）
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch(`/api/brand-score/market-surveys/${surveyId}`)
      if (!res.ok) return
      const data = await res.json()
      setSurvey(data.survey)
      setTitleDraft(data.survey?.title ?? '')
      setStageScores(data.stageScores ?? [])
      setRanking(data.ranking ?? {})
      setExtras(data.extras ?? null)
      setBlockCount((data.blocks ?? []).length)
    } catch (err) {
      console.error('[MarketSurveyDetail] 取得エラー:', err)
    } finally {
      setLoading(false)
    }
  }, [surveyId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const handleTitleClick = () => {
    setEditingTitle(true)
    setTimeout(() => titleInputRef.current?.focus(), 50)
  }

  // 確定と同時に保存する。保存ボタンを別に置くと押し忘れで戻ってしまう
  const handleTitleBlur = async () => {
    setEditingTitle(false)
    const next = titleDraft.trim()
    if (!next) {
      setTitleDraft(survey?.title ?? '')
      return
    }
    if (next === survey?.title) return

    setSavingTitle(true)
    try {
      const res = await fetch(`/api/brand-score/market-surveys/${surveyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'タイトルの保存に失敗しました')
      setSurvey(data.survey)
      setTitleDraft(data.survey.title)
      toast.success('タイトルを更新しました')
    } catch (err) {
      console.error('[MarketSurveyDetail] タイトル保存エラー:', err)
      toast.error('タイトルを保存できませんでした')
      setTitleDraft(survey?.title ?? '')
    } finally {
      setSavingTitle(false)
    }
  }

  const toggleActive = async (next: 'active' | 'draft') => {
    setSaving(true)
    try {
      const res = await fetch(`/api/brand-score/market-surveys/${surveyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '更新できませんでした')
        return
      }
      toast.success(next === 'active' ? 'アウタースコアに反映しました' : '反映を止めました')
      await fetchAll()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!survey) {
    return <p className="text-sm text-muted-foreground">調査が見つかりません</p>
  }

  const cfg = STATUS_CONFIG[survey.status] ?? STATUS_CONFIG.draft
  const marketScore = computeMarketScore(
    stageScores.map((s) => ({ status: s.status, score: s.score }))
  )
  const scored = stageScores.filter((s) => s.status === 'scored')
  const highest = scored.length > 0 ? Math.max(...scored.map((s) => s.score!)) : null
  const lowest = scored.length > 0 ? Math.min(...scored.map((s) => s.score!)) : null

  const formatDate = (s: string | null) => {
    if (!s) return null
    const d = new Date(s)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  const period = [formatDate(survey.fielded_from), formatDate(survey.fielded_to)]
    .filter(Boolean)
    .join(' 〜 ')

  return (
    <div>
      {/* ヘッダー */}
      <div className="mb-4 flex items-start justify-between gap-4">
        {/* 編集に切り替わると Input が幅いっぱいに伸びる。flex-1 が無いと
            入力欄が文字数ぶんに縮んでしまう（サーベイ詳細と同じ組み方） */}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {editingTitle ? (
              <Input
                ref={titleInputRef}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleBlur()
                }}
                className="h-auto rounded-none border-x-0 border-b border-t-0 px-1 py-0 text-2xl font-bold focus-visible:ring-0"
              />
            ) : (
              <h1
                className="truncate cursor-pointer text-2xl font-bold text-foreground transition-colors hover:text-muted-foreground"
                onClick={handleTitleClick}
                title="クリックして編集"
              >
                {survey.title}
              </h1>
            )}
            {savingTitle && (
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            )}
            <Badge
              variant="secondary"
              className={`shrink-0 px-1.5 py-0 text-[10px] ${cfg.className}`}
            >
              {cfg.label}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {survey.research_firm && <span>{survey.research_firm}</span>}
            {period && (
              <span className="flex items-center gap-1">
                <CalendarDays size={11} />
                {period}
              </span>
            )}
            {survey.sample_size !== null && (
              <span className="flex items-center gap-1">
                <Users size={11} />n = {survey.sample_size}
              </span>
            )}
            <span>設問 {blockCount}件</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              router.push(`/admin/brand-score/market-surveys/${surveyId}/mapping`)
            }
          >
            <Settings2 size={14} />
            指標の割り当て
          </Button>
          {survey.status === 'active' ? (
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => toggleActive('draft')}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              反映を止める
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={saving || scored.length < 3}
              onClick={() => toggleActive('active')}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              アウタースコアに反映
            </Button>
          )}
        </div>
      </div>

      {/* 概要 */}
      <div className="mb-4 grid grid-cols-3 gap-4">
        {[
          { icon: <ClipboardList size={14} />, label: '設問数', value: `${blockCount}`, unit: '問' },
          {
            icon: <Users size={14} />,
            label: 'サンプル数',
            value: survey.sample_size !== null ? `${survey.sample_size}` : '—',
            unit: '名',
          },
          {
            icon: <Trophy size={14} />,
            label: '算出できた段階',
            value: `${scored.length}`,
            unit: '/ 5',
          },
        ].map((s) => (
          <Card key={s.label} className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5 text-center">
              <p className="m-0 mb-1 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                {s.icon}
                {s.label}
              </p>
              <p className="m-0 text-2xl font-bold text-foreground">{s.value}</p>
              <p className="m-0 text-[10px] text-muted-foreground">{s.unit}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 市場浸透スコア */}
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-[minmax(150px,1fr)_3fr]">
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-4 text-center">
            <p className="mb-1 text-xs text-muted-foreground">市場浸透</p>
            <span className="text-3xl font-bold text-green-600">
              {marketScore !== null ? marketScore.toFixed(1) : '-'}
            </span>
            {marketScore === null && (
              <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
                スコアを算出できた段階が3件未満です
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-4">
            <div className="grid grid-cols-5 gap-2">
              {MARKET_STAGES.map((stage, i) => {
                const s = stageScores.find((x) => x.stage === stage)
                const isWeakest =
                  s?.status === 'scored' && lowest !== null && s.score === lowest
                return (
                  <div key={stage} className="rounded-lg px-2 py-1.5 text-center">
                    <p className="m-0 text-xs text-muted-foreground">
                      {i + 1}. {MARKET_STAGE_LABELS[stage]}
                    </p>
                    <span
                      className={`text-xl font-bold ${
                        s?.status === 'scored'
                          ? isWeakest
                            ? 'text-orange-600'
                            : 'text-green-600'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {s?.status === 'scored' ? s.score?.toFixed(1) : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 形と競合ポジション */}
      {scored.length >= 3 && (
        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* 5段階の形。どこが凹んでいるかを一目で見る */}
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5">
              <h2 className="mb-1 text-sm font-bold text-foreground">浸透の形</h2>
              <p className="mb-3 text-xs text-muted-foreground">
                5段階のスコア。凹んでいるところが次に手を打つ段階です。
              </p>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart
                  data={MARKET_STAGES.map((stage) => {
                    const sc = stageScores.find((x) => x.stage === stage)
                    return {
                      stage: MARKET_STAGE_LABELS[stage],
                      score: sc?.status === 'scored' ? sc.score : 0,
                    }
                  })}
                >
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="stage" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#9ca3af' }} />
                  <Radar
                    dataKey="score"
                    stroke="#16a34a"
                    fill="#22c55e"
                    fillOpacity={0.35}
                  />
                  <Tooltip formatter={(v: number) => [`${v}点`, 'スコア']} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 競合ポジション（認知の全社比較） */}
          {(() => {
            // 認知が無ければ、割り当てのある段階のうち競合数が最も多いものを使う
            const stage: MarketStage =
              (ranking.awareness?.length ?? 0) > 1
                ? 'awareness'
                : (MARKET_STAGES.find((st) => (ranking[st]?.length ?? 0) > 1) ?? 'awareness')
            const rows = ranking[stage] ?? []
            if (rows.length < 2) return null
            return (
              <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
                <CardContent className="p-5">
                  <h2 className="mb-1 text-sm font-bold text-foreground">
                    競合ポジション（{MARKET_STAGE_LABELS[stage]}）
                  </h2>
                  <p className="mb-3 text-xs text-muted-foreground">
                    同じ設問での他社との位置関係。緑が自社です。
                    {(() => {
                      const ex = stageScores.find((x) => x.stage === stage)?.benchmark?.excluded
                      return ex ? `回答者${MIN_BENCHMARK_BASE_N}人未満の${ex}社は除いています。` : ''
                    })()}
                  </p>
                  <ResponsiveContainer width="100%" height={Math.max(240, rows.length * 22)}>
                    <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24 }}>
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={128}
                        tick={{ fontSize: 10, fill: '#6b7280' }}
                      />
                      <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, '']} />
                      <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                        {rows.map((r, i) => (
                          <RCell key={i} fill={r.isSelf ? '#16a34a' : '#d1d5db'} />
                        ))}
                      </Bar>
                      {/* 0%の縦線。バーの下に隠れるので、最後に描いて手前に出す */}
                      <ReferenceLine x={0} stroke="#666" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )
          })()}
        </div>
      )}

      {/* 段階別の詳細 */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          <h2 className="mb-1 text-sm font-bold text-foreground">段階別の詳細</h2>
          {/* 色の対応は下の凡例が持つので、ここには読み方を書く。
              サーベイ詳細の「回答の内訳」と同じ分量に揃える */}
          <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
            オレンジは自社以外でいちばん高い会社です。
            右はスコアと順位で、回答者{MIN_BENCHMARK_BASE_N}人未満の会社は順位に入れていません。
          </p>

          <div>
            {MARKET_STAGES.map((stage, i) => {
              const s = stageScores.find((x) => x.stage === stage)
              const bm = s?.benchmark ?? null
              const isWeakest =
                s?.status === 'scored' && lowest !== null && s.score === lowest
              const isBest =
                s?.status === 'scored' && highest !== null && s.score === highest

              // 競合平均は出さない。段階ごとに設問の種類が違い（助成想起・純粋想起・
              // 認知者ベースの評価）、平均の意味が段階ごとにぶれて読み違えるため。
              // 位置関係は「自社 vs 競合トップ」と右の順位で足りる
              const bars = [
                { key: '自社', value: s?.raw_percent ?? null, color: 'bg-green-500' },
                { key: '競合トップ', value: bm?.competitorMax ?? null, color: 'bg-orange-400' },
              ]

              return (
                <div key={stage}>
                  {/* 反転点。ここから先は実際に選ぶ側になる */}
                  {stage === MARKET_PIVOT_STAGE && (
                    <div aria-hidden className="my-2 border-t border-border" />
                  )}

                  <div className="flex items-start gap-3 py-2">
                    <div className="w-[124px] shrink-0">
                      <p className="m-0 text-sm font-bold text-foreground">
                        {i + 1}. {MARKET_STAGE_LABELS[stage]}
                      </p>
                      <p className="m-0 text-[10px] text-muted-foreground">
                        {MARKET_STAGE_QUESTIONS[stage]}
                        {s?.base_n !== null && s?.base_n !== undefined && `・n=${s.base_n}`}
                      </p>
                    </div>

                    <div className="min-w-0 flex-1 pt-0.5">
                      {s?.status === 'scored' ? (
                        <div className="space-y-1">
                          {bars.map((bar) =>
                            bar.value === null ? null : (
                              <div key={bar.key} className="flex items-center gap-2">
                                {/* 幅が足りないと「競合トッ／プ」と折り返す。
                                    行ごとにバーの開始位置がずれるので固定幅＋折り返し禁止 */}
                                <span className="w-[72px] shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">
                                  {bar.key}
                                </span>
                                <div className="h-2 min-w-0 flex-1 rounded-full bg-muted">
                                  <div
                                    className={`h-full rounded-full ${bar.color}`}
                                    style={{ width: `${Math.min(100, bar.value)}%` }}
                                  />
                                </div>
                                <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                                  {bar.value.toFixed(1)}%
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <p className="m-0 py-2 text-[11px] text-muted-foreground">
                          {s?.status === 'absent'
                            ? 'この調査では未計測'
                            : 'まだ割り当てられていません'}
                        </p>
                      )}
                    </div>

                    {/* 右: スコアと順位 */}
                    <div className="w-[92px] shrink-0 text-right">
                      {s?.status === 'scored' && (
                        <>
                          <p
                            className={`m-0 text-base font-bold ${
                              isWeakest
                                ? 'text-orange-600'
                                : isBest
                                  ? 'text-green-600'
                                  : 'text-foreground'
                            }`}
                          >
                            {s.score?.toFixed(1)}
                          </p>
                          {bm && (
                            <p className="m-0 whitespace-nowrap text-[10px] text-muted-foreground">
                              {bm.n}社中 {bm.rank}位
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-sm bg-green-500" />自社
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-sm bg-orange-400" />競合トップ
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── 5段階以外の読みどころ ──
          5段階は「どこまで届いたか」の定点観測。ここから下は「なぜそうなったか」で、
          割り当てを人が決めなくても集計表の構造から機械的に読めるものだけを出す */}

      {/* 印象一致度: 市場が重視する点 × 自社イメージ */}
      {extras?.impression && (
        <Card className="mt-4 bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <div className="mb-1 flex items-center justify-between gap-3">
              <h2 className="m-0 text-sm font-bold text-foreground">
                印象一致度（市場が重視する点 × 自社イメージ）
              </h2>
              {extras.impression.score !== null && (
                <span className="text-2xl font-bold text-green-600">
                  {extras.impression.score}
                </span>
              )}
            </div>
            <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
              市場が企業を選ぶときに重視する上位5項目のうち、いくつが自社の印象としても
              上位5項目に入っているかです。
              {/* 母数が違うので引き算をさせない。ここを書かないと誤読される */}
              重視点はn={extras.impression.importanceBaseN}の全数、イメージはn=
              {extras.impression.imageBaseN}の自社認知者と母数が違うため、%の差は意味を持ちません。
              比べてよいのは順位です。
            </p>

            <div className="mb-4 grid gap-2 sm:grid-cols-2">
              {extras.impression.misses.length > 0 && (
                <div className="rounded-md border bg-background p-3">
                  <p className="m-0 mb-1 text-[11px] font-bold text-orange-600">
                    伝わっていない期待
                  </p>
                  <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">
                    {extras.impression.misses.join('・')}
                    。市場は重視しているのに、自社の印象としては上位に挙がっていません。
                  </p>
                </div>
              )}
              {extras.impression.overs.length > 0 && (
                <div className="rounded-md border bg-background p-3">
                  <p className="m-0 mb-1 text-[11px] font-bold text-foreground">
                    重視されていないのに強い印象
                  </p>
                  <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">
                    {extras.impression.overs.join('・')}
                    。伝わってはいますが、選ぶ理由にはなりにくい項目です。
                  </p>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-xs">
                <thead>
                  <tr className="border-b text-[10px] text-muted-foreground">
                    <th className="py-1 text-left font-normal">項目</th>
                    <th className="py-1 text-right font-normal">市場の重視</th>
                    <th className="py-1 text-right font-normal">自社イメージ</th>
                    <th className="py-1 text-right font-normal">順位差</th>
                  </tr>
                </thead>
                <tbody>
                  {extras.impression.matches.slice(0, 10).map((m) => {
                    const diff = m.importanceRank - m.imageRank
                    return (
                      <tr key={m.label} className="border-b border-border/50">
                        <td className="py-1.5 pr-2">{m.label}</td>
                        <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                          {m.importanceRank}位・{m.importanceValue.toFixed(1)}%
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                          {m.imageRank}位・{m.imageValue.toFixed(1)}%
                        </td>
                        <td
                          className={`py-1.5 text-right tabular-nums font-bold ${
                            diff <= -3
                              ? 'text-orange-600'
                              : diff >= 3
                                ? 'text-green-600'
                                : 'text-muted-foreground'
                          }`}
                        >
                          {diff > 0 ? `+${diff}` : diff}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="m-0 mt-2 text-[10px] text-muted-foreground">
              順位差がマイナスなら「重視されている割に印象が薄い」、プラスなら
              「重視されていない割に印象が強い」。
            </p>
          </CardContent>
        </Card>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ブランドパーソナリティ（SD法） */}
        {extras?.personality && (
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5">
              <h2 className="m-0 mb-1 text-sm font-bold text-foreground">
                ブランドパーソナリティ
              </h2>
              <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                対になる言葉のどちらに近いかを聞いたもの。数字は左の言葉に寄った人の割合です
                （n={extras.personality.baseN}）。
              </p>
              <div className="space-y-1.5">
                {extras.personality.items.map((it) => (
                  <div key={it.positive} className="flex items-center gap-2">
                    <span className="w-[86px] shrink-0 truncate text-[11px] text-foreground">
                      {it.positive}
                    </span>
                    <div className="h-2 min-w-0 flex-1 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-green-500"
                        style={{ width: `${Math.min(100, it.value)}%` }}
                      />
                    </div>
                    <span className="w-11 shrink-0 text-right text-[11px] tabular-nums text-foreground">
                      {it.value.toFixed(1)}%
                    </span>
                    <span className="w-[76px] shrink-0 truncate text-right text-[10px] text-muted-foreground">
                      {it.negative}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 認知経路 */}
        {extras?.contactPoints && extras.contactPoints.items.length > 0 && (
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5">
              <h2 className="m-0 mb-1 text-sm font-bold text-foreground">認知経路</h2>
              <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                自社を知った人が、どこで見聞きしたか（n={extras.contactPoints.baseN}）。
                「認知」の数字が何によって作られているかが分かります。
              </p>
              <RankBars items={extras.contactPoints.items} max={8} />
            </CardContent>
          </Card>
        )}

        {/* 事業浸透度 */}
        {extras?.services && extras.services.items.length > 0 && (
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5">
              <h2 className="m-0 mb-1 text-sm font-bold text-foreground">事業浸透度</h2>
              <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                自社の導入経験者の中で、どのサービスが使われているか（n=
                {extras.services.baseN}）。「利用」の内訳です。
              </p>
              <RankBars items={extras.services.items} max={8} />
            </CardContent>
          </Card>
        )}

        {/* サービス評価 */}
        {extras?.serviceEvaluation && extras.serviceEvaluation.items.length > 0 && (
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5">
              <h2 className="m-0 mb-1 text-sm font-bold text-foreground">サービス評価</h2>
              <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                自社を知っている人による評価。「あてはまる」と答えた割合です（n=
                {extras.serviceEvaluation.baseN}）。「評価」の裏付けになります。
              </p>
              <RankBars items={extras.serviceEvaluation.items} max={8} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
