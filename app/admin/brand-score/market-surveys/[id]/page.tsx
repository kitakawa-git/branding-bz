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
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CalendarDays,
  Users,
  Loader2,
  ClipboardList,
  Trophy,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
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
import { MarketSurveyResults } from '@/components/brand-score/MarketSurveyResults'

type Survey = {
  id: string
  title: string
  research_firm: string
  fielded_from: string | null
  fielded_to: string | null
  sample_size: number | null
  status: string
  /** カード別のAI考察。キーは insights API の SECTIONS と対応 */
  insights: Record<string, string> | null
  insights_generated_at: string | null
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
 *
 * バーの長さは0〜100%の実寸。最大値を全幅にすると、認知経路のように
 * 全項目が3割未満の表でも1位が満杯に見えて、実際より大きく読める。
 */
/** カード末尾に添えるAI考察。装飾はサーベイ詳細の InsightNote と同じ */
function InsightNote({
  text,
  loading,
  /** 2カラムに並ぶカードで、左右の考察の上端を揃えるために下寄せする */
  pushDown = false,
}: {
  text?: string
  loading: boolean
  pushDown?: boolean
}) {
  if (!text && !loading) return null
  // 下寄せは外側の余白で作る。枠に mt-auto を付けると、本文が長いカードでは
  // 余白が 0 になって最後の行に貼りついてしまう
  return (
    <div className={pushDown ? 'mt-auto pt-4' : 'mt-4'}>
      <div className="rounded-lg border border-blue-100 bg-blue-50/30 p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-ds-app-accent" />
          <p className="m-0 text-xs font-bold text-ds-app-accent">考察（AI生成）</p>
        </div>
        {text ? (
          <p className="m-0 text-[13px] leading-relaxed text-foreground/80">{text}</p>
        ) : (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            考察を生成中...
          </div>
        )}
      </div>
    </div>
  )
}

function RankBars({
  items,
  max = 8,
  suffix = '%',
}: {
  items: { label: string; value: number }[]
  max?: number
  suffix?: string
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-1.5">
        {items.slice(0, max).map((it) => (
          <div key={it.label} className="flex items-center gap-2">
            {/* 選択肢名は「同業者の（眼科医の間での）口コミ」のように長く、
                幅を広げるとバーが潰れる。省略した名前はホバーで全文を出す */}
            <UITooltip>
              <TooltipTrigger asChild>
                <span className="w-[136px] shrink-0 truncate text-left text-[11px] text-muted-foreground">
                  {it.label}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {it.label}
              </TooltipContent>
            </UITooltip>
            <div className="h-2 min-w-0 flex-1 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-green-500"
                style={{ width: `${Math.min(100, Math.max(0, it.value))}%` }}
              />
            </div>
            <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-foreground">
              {it.value.toFixed(1)}
              {suffix}
            </span>
          </div>
        ))}
      </div>
    </TooltipProvider>
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
  const [generatingInsights, setGeneratingInsights] = useState(false)
  const insightsTriedRef = useRef(false)
  const [blockCount, setBlockCount] = useState(0)
  const [loading, setLoading] = useState(true)

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

  // ── AI考察 ──
  // 画面に出ている数字だけを渡し、生成側が新しい数値を作れないようにする
  const buildInsightSummary = useCallback(() => {
    const stageRows = MARKET_STAGES.map((stage) => {
      const x = stageScores.find((v) => v.stage === stage)
      if (!x || x.status !== 'scored') return null
      return {
        段階: MARKET_STAGE_LABELS[stage],
        スコア: x.score,
        生の割合: x.raw_percent,
        回答者数: x.base_n,
        順位: x.benchmark ? `${x.benchmark.n}社中${x.benchmark.rank}位` : null,
        競合トップの割合: x.benchmark?.competitorMax ?? null,
      }
    }).filter(Boolean)

    const list = (v: { items: { label: string; value: number }[]; baseN: number | null } | null) =>
      v ? { 回答者数: v.baseN, 項目: v.items.slice(0, 10) } : null

    return {
      調査名: survey?.title,
      サンプル数: survey?.sample_size,
      市場浸透スコア: computeMarketScore(
        stageScores.map((x) => ({ status: x.status, score: x.score }))
      ),
      五段階: stageRows.length > 0 ? stageRows : null,
      市場の期待と自社イメージ: extras?.impression
        ? {
            注記: '重視点は全数ベース、イメージは自社を知っている人ベースで分母が違う',
            項目: extras.impression.matches.slice(0, 10).map((m) => ({
              項目: m.label,
              市場の重視順位: m.importanceRank,
              市場の重視割合: m.importanceValue,
              自社イメージ順位: m.imageRank,
              自社イメージ割合: m.imageValue,
            })),
          }
        : null,
      ブランドパーソナリティ: extras?.personality
        ? {
            回答者数: extras.personality.baseN,
            項目: extras.personality.items.map((i) => ({
              性格: i.positive,
              寄った割合: i.value,
            })),
          }
        : null,
      認知経路: list(extras?.contactPoints ?? null),
      事業浸透度: list(extras?.services ?? null),
      サービス評価: list(extras?.serviceEvaluation ?? null),
    }
  }, [survey, stageScores, extras])

  const generateInsights = useCallback(async () => {
    if (generatingInsights) return
    setGeneratingInsights(true)
    try {
      const res = await fetch(`/api/brand-score/market-surveys/${surveyId}/insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: buildInsightSummary() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || '考察の生成に失敗しました')
      }
      const data = await res.json()
      setSurvey((prev) =>
        prev
          ? {
              ...prev,
              insights: data.insights,
              insights_generated_at: data.insights_generated_at,
            }
          : prev
      )
    } catch (err) {
      console.error('[MarketSurveyDetail] AI考察生成エラー:', err)
      toast.error(err instanceof Error ? err.message : '考察の生成に失敗しました')
    } finally {
      setGeneratingInsights(false)
    }
  }, [surveyId, buildInsightSummary, generatingInsights])

  // 未生成のときだけ自動で一度走らせる。失敗しても再試行はしない
  useEffect(() => {
    if (!survey || survey.insights || stageScores.length === 0) return
    if (insightsTriedRef.current) return
    insightsTriedRef.current = true
    generateInsights()
  }, [survey, stageScores, generateInsights])

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
  // 初回生成のあいだだけスケルトンを出す。再生成中は前回の考察を出したままにする
  const insightsLoading = generatingInsights && !survey.insights
  const marketScore = computeMarketScore(
    stageScores.map((s) => ({ status: s.status, score: s.score }))
  )
  const scored = stageScores.filter((s) => s.status === 'scored')
  const highest = scored.length > 0 ? Math.max(...scored.map((s) => s.score!)) : null
  const lowest = scored.length > 0 ? Math.min(...scored.map((s) => s.score!)) : null

  // 一覧・サーベイ管理と同じ書式。月までだと開始と終了が同じ月のとき
  // 「2026/06 〜 2026/06」になって期間が読めない
  const formatDate = (s: string | null) => {
    if (!s) return null
    const d = new Date(s)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
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
            onClick={generateInsights}
            disabled={generatingInsights}
          >
            {generatingInsights ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            AI考察を再生成
          </Button>
        </div>
      </div>

      <MarketSurveyResults
        survey={survey}
        stageScores={stageScores}
        ranking={ranking}
        blockCount={blockCount}
        extras={extras}
        insightsLoading={insightsLoading}
      />
    </div>
  )
}
