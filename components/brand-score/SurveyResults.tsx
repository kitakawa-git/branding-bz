'use client'

// サーベイ結果ビュー（読み取り専用・自己完結）。
// 管理画面のサーベイ詳細ページとポータルのサーベイ結果ページの両方で使う。
// props の data(inner-score) と questions(設問の並び順・参照データ) だけで全セクションを描画する。
import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Sparkles, Loader2, AlertCircle } from 'lucide-react'
import {
  calcFunnel,
  resolveStage,
  FUNNEL_STAGES,
  ALL_STAGES,
  INFLECTION_STAGE,
  STAGE_LABELS,
  STAGE_QUESTIONS,
  STAGE_STATES,
  PATTERN_LABELS,
  PATTERN_MEANINGS,
  type FunnelStage,
  type FunnelInputQuestion,
  type GroupFunnel,
} from '@/lib/brand-score/funnel-stages'
import type { Breakdown } from '@/lib/brand-score/question-lens'

// AI考察のキー（API 側と揃える）
export type InsightKey = 'overview' | 'distribution' | 'stages' | 'funnel'

// inner-score API のレスポンス型
export type InnerScoreData = {
  survey: { id: string; title: string; status: string; total_members: number }
  response_rate: number
  response_count: number
  scores: { total: number | null; why: number | null; how: number | null; what: number | null }
  rank: string
  by_department: {
    department: string; count: number
    why: number | null; how: number | null; what: number | null; total: number | null
  }[]
  by_role: {
    role_category: string; count: number
    why: number | null; how: number | null; what: number | null; total: number | null
  }[]
  by_question: {
    question_id: string; question_text: string; category: string
    avg_score: number | null; count: number
  }[]
  breakdown: Breakdown | null
  funnel: {
    pass_threshold: number
    overall: GroupFunnel
    by_department: GroupFunnel[]
  } | null
}

// funnel（パターン判定・段階の設問数）算出に必要な設問メタ
export type SurveyResultsQuestion = {
  id: string
  sort_order: number
  category: string
  reference_data: Record<string, unknown>
}

type QuestionAxis = 'category' | 'stage'

const AXIS_OPTIONS: { key: QuestionAxis; label: string }[] = [
  { key: 'stage', label: '浸透段階' },
  { key: 'category', label: '設問タイプ' },
]

const CATEGORY_LABELS: Record<string, string> = {
  why: '理念浸透（WHY）',
  how: '方針共感（HOW）',
  what: '行動体現（WHAT）',
}
const CATEGORY_SUBS: Record<string, string> = {
  why: '理念・存在意義',
  how: '方針・進め方',
  what: '行動・成果',
}
const CATEGORY_ORDER = ['why', 'how', 'what'] as const

// 部署の表示名。DB の値は取り込み時に指定した文字列なので、画面上の呼び方だけ揃える
const DEPARTMENT_LABELS: Record<string, string> = { BO本社: 'BO（本社含む）' }
const departmentLabel = (department: string) => DEPARTMENT_LABELS[department] ?? department

// スコア色分け（0-100）
function getScoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground'
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-ds-app-accent'
  if (score >= 40) return 'text-amber-600'
  return 'text-red-600'
}
function getScoreProgressColor(score: number | null): string {
  if (score === null) return 'bg-muted'
  if (score >= 80) return '[&>div]:bg-green-500'
  if (score >= 60) return '[&>div]:bg-ds-app-accent-soft'
  if (score >= 40) return '[&>div]:bg-amber-500'
  return '[&>div]:bg-red-500'
}
function getRankBadgeClass(rank: string): string {
  if (rank === 'S') return 'bg-green-100 text-green-700 border-green-200'
  if (rank === 'A+' || rank === 'A') return 'bg-blue-100 text-ds-app-accent-hover border-blue-200'
  if (rank === 'B+' || rank === 'B') return 'bg-amber-100 text-amber-700 border-amber-200'
  if (rank === 'C' || rank === 'D') return 'bg-red-100 text-red-700 border-red-200'
  return 'bg-gray-100 text-gray-500 border-gray-200'
}

// カード末尾のAI考察（考察が無ければ何も出さない）
function InsightNote({ text, loading }: { text?: string; loading?: boolean }) {
  if (!text && !loading) return null
  return (
    <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/30 p-4">
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
  )
}

type Props = {
  data: InnerScoreData
  questions: SurveyResultsQuestion[]
  insights?: Partial<Record<InsightKey, string>>
  insightsLoading?: boolean
}

export function SurveyResults({ data, questions, insights, insightsLoading }: Props) {
  const [questionAxis, setQuestionAxis] = useState<QuestionAxis>('stage')

  // 設問別スコア（by_question）と設問メタ（sort_order・reference_data）を結合して funnel を算出
  const funnel = useMemo(() => {
    if (questions.length === 0) return null
    const byId = new Map(questions.map(q => [q.id, q]))
    const input: FunnelInputQuestion[] = []
    for (const bq of data.by_question) {
      const q = byId.get(bq.question_id)
      if (!q) continue
      input.push({
        questionId: bq.question_id,
        questionText: bq.question_text,
        sortOrder: q.sort_order,
        category: bq.category,
        avgScore: bq.avg_score,
        count: bq.count,
        referenceData: q.reference_data,
      })
    }
    return input.length ? calcFunnel(input) : null
  }, [data, questions])

  const funnelData = data.funnel ?? null
  const breakdown = data.breakdown ?? null

  const stageScoreOf = (stage: FunnelStage): number | null =>
    funnelData?.overall.stageScores.find(s => s.stage === stage)?.score ?? null
  const deptGroup = (department: string): GroupFunnel | undefined =>
    funnelData?.by_department.find(g => g.department === department)
  const deptStageScore = (department: string, stage: FunnelStage): number | null =>
    deptGroup(department)?.stageScores.find(s => s.stage === stage)?.score ?? null
  // 5点満点は API が返す生の平均をそのまま使う。
  // 0〜100 から逆算すると小数第2位がずれる（BOの推奨は 3.13 が正、逆算だと 3.12）
  const stageAvgOf = (stage: FunnelStage): number | null =>
    funnelData?.overall.stageScores.find(s => s.stage === stage)?.avg ?? null
  const deptStageAvg = (department: string, stage: FunnelStage): number | null =>
    deptGroup(department)?.stageScores.find(s => s.stage === stage)?.avg ?? null
  const deptPass = (department: string, stage: FunnelStage): number | null =>
    deptGroup(department)?.cumulative.find(p => p.stage === stage)?.rate ?? null
  const deptPassCount = (department: string, stage: FunnelStage): number | null =>
    deptGroup(department)?.cumulative.find(p => p.stage === stage)?.count ?? null

  const extremeStage = (
    scoreOf: (stage: FunnelStage) => number | null,
    pick: 'min' | 'max',
  ): FunnelStage | null =>
    funnelData
      ? FUNNEL_STAGES.reduce<FunnelStage | null>((best, stage) => {
          const v = scoreOf(stage)
          if (v === null) return best
          if (best === null) return stage
          const bv = scoreOf(best) ?? (pick === 'min' ? Infinity : -Infinity)
          return (pick === 'min' ? v < bv : v > bv) ? stage : best
        }, null)
      : null
  const deptScoreOf = (department: string) => (stage: FunnelStage) => deptStageScore(department, stage)

  const weakestStage = extremeStage(stageScoreOf, 'min')
  const strongestStage = extremeStage(stageScoreOf, 'max')
  const weakestSpStage = extremeStage(deptScoreOf('SP'), 'min')
  const strongestSpStage = extremeStage(deptScoreOf('SP'), 'max')
  const weakestBoStage = extremeStage(deptScoreOf('BO本社'), 'min')
  const strongestBoStage = extremeStage(deptScoreOf('BO本社'), 'max')

  // 設問別スコアの軸ごとのグループ化（各グループ内スコア昇順）
  const categoryOf = new Map(data.by_question.map(bq => [bq.question_id, bq.category]))
  const availableAxes: QuestionAxis[] = []
  const questionsByStageSize = breakdown
    ? new Set(breakdown.byQuestion.map(q => resolveStage(q.sortOrder, breakdown.byQuestion.length, null))).size
    : 0
  if (questionsByStageSize > 0) availableAxes.push('stage')
  if (CATEGORY_ORDER.some(c => [...categoryOf.values()].includes(c))) availableAxes.push('category')
  const effectiveAxis: QuestionAxis =
    availableAxes.includes(questionAxis) ? questionAxis : (availableAxes[0] ?? 'stage')
  const questionAxisOptions = AXIS_OPTIONS.filter(o => availableAxes.includes(o.key))

  const questionGroups = (() => {
    if (!breakdown) return []
    type Q = Breakdown['byQuestion'][number]
    const buckets: { key: string; label: string; sub?: string; questions: Q[] }[] = []
    if (effectiveAxis === 'category') {
      for (const c of CATEGORY_ORDER) {
        const qs = breakdown.byQuestion.filter(q => categoryOf.get(q.questionId) === c)
        if (qs.length) buckets.push({ key: c, label: CATEGORY_LABELS[c], sub: CATEGORY_SUBS[c], questions: qs })
      }
    } else {
      const total = breakdown.byQuestion.length
      for (const st of ALL_STAGES) {
        const qs = breakdown.byQuestion.filter(q => resolveStage(q.sortOrder, total, null) === st)
        if (qs.length) buckets.push({ key: st, label: STAGE_LABELS[st], sub: STAGE_STATES[st], questions: qs })
      }
    }
    return buckets.map(b => {
      const sorted = [...b.questions].sort((a, c) => a.avg - c.avg)
      const totalN = sorted.reduce((a, q) => a + q.responseCount, 0)
      const avg = totalN > 0 ? sorted.reduce((a, q) => a + q.avg * q.responseCount, 0) / totalN : null
      return { ...b, questions: sorted, avg, worstId: sorted[0]?.questionId }
    })
  })()

  // 回答が無い場合
  if (data.response_count === 0) {
    return (
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-10 text-center">
          <AlertCircle size={40} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">まだ回答がありません。</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* スコアカード列（総合 + 5段階） */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(150px,1fr)_3fr]">
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">総合</p>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className={`text-3xl font-bold ${getScoreColor(data.scores.total)}`}>
                {data.scores.total !== null ? data.scores.total.toFixed(1) : '-'}
              </span>
              <Badge variant="outline" className={`text-xs font-bold ${getRankBadgeClass(data.rank)}`}>
                {data.rank}
              </Badge>
            </div>
            <Progress value={data.scores.total ?? 0} className={`h-1.5 ${getScoreProgressColor(data.scores.total)}`} />
          </CardContent>
        </Card>

        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-4">
            {/* 2つの数字の関係が分からないと読めないので必ず添える */}
            <div className="mb-1.5 flex items-center justify-end gap-3 text-[9.5px] text-muted-foreground">
              <span>上＝5点満点</span>
              <span>下＝0〜100</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {FUNNEL_STAGES.map((stage, i) => {
                const s = stageScoreOf(stage)
                const a = stageAvgOf(stage)
                const isInflection = stage === INFLECTION_STAGE
                const isWeakest = weakestStage === stage
                return (
                  <div key={stage} className="relative rounded-lg px-2 py-1.5 text-center">
                    {isInflection && (
                      <span aria-hidden className="absolute inset-y-0 -left-1 border-l border-border" />
                    )}
                    <p className="m-0 text-xs text-muted-foreground">{i + 1}. {STAGE_LABELS[stage]}</p>
                    {/* 主は5点満点。通過率の閾値（3.5点）と物差しが揃う。
                        0〜100 は総合スコアと突き合わせるために併記する */}
                    <span className={`block text-xl font-bold leading-tight ${isWeakest ? 'text-orange-600' : 'text-ds-app-accent'}`}>
                      {a !== null ? a.toFixed(2) : '-'}
                    </span>
                    <span className="block text-[9.5px] leading-tight text-muted-foreground tabular-nums">
                      {s !== null ? s.toFixed(1) : '-'}
                    </span>
                    {/* バーは 0〜100 スケールのまま。5点満点を1点起点で描いたものと
                        同じ形になる。中央の破線は3.0＝どちらとも言えない */}
                    <div className="relative mt-1.5">
                      <Progress
                        value={s ?? 0}
                        className={`h-1.5 ${isWeakest ? '[&>div]:bg-orange-500' : '[&>div]:bg-ds-app-accent-soft'}`}
                      />
                      <span
                        aria-hidden
                        className="pointer-events-none absolute left-1/2 top-0 h-full border-l border-dashed border-orange-400/70"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="m-0 mt-2 text-[10px] leading-relaxed text-muted-foreground">
              たて軸は5点満点。1点が最低なので1から表示している（0点をつけた人はいない）。
              破線の3.0が「どちらとも言えない」。
            </p>
            <InsightNote text={insights?.overview} loading={insightsLoading} />
          </CardContent>
        </Card>
      </div>

      {/* 回答の内訳（肯定 / 中立 / 否定） */}
      {breakdown && (
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <h3 className="text-sm font-bold text-foreground mb-1">回答の内訳</h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              数えているのは人数ではなく回答の数（人数×設問数）です。
              グレー（中立）は反対ではなく、まだよく知らないということ。
            </p>
            <div className="space-y-3">
              {[
                { label: '全社', d: breakdown.overall, strong: true },
                ...breakdown.byDepartment.map(d => ({ label: departmentLabel(d.department), d, strong: false })),
              ].map(row => (
                <div key={row.label} className="flex items-center gap-3">
                  <div className="w-[116px] shrink-0">
                    <p className={`m-0 text-sm ${row.strong ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                      {row.label}
                    </p>
                    <p className="m-0 text-[10px] text-muted-foreground">{row.d.avg.toFixed(2)} / 5</p>
                  </div>
                  <div className="flex h-6 min-w-0 flex-1 overflow-hidden rounded">
                    <div className="flex items-center justify-center bg-ds-app-accent-soft" style={{ width: `${row.d.positiveRate}%` }}>
                      <span className="text-[10px] font-bold text-white whitespace-nowrap">{row.d.positiveRate}%</span>
                    </div>
                    <div className="flex items-center justify-center bg-gray-300" style={{ width: `${row.d.neutralRate}%` }}>
                      <span className="text-[10px] font-bold text-gray-700 whitespace-nowrap">{row.d.neutralRate}%</span>
                    </div>
                    <div className="flex items-center justify-center bg-orange-400" style={{ width: `${row.d.negativeRate}%` }}>
                      <span className="text-[10px] font-bold text-white whitespace-nowrap">{row.d.negativeRate}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-ds-app-accent-soft" />肯定（4〜5点）</span>
              <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-gray-300" />中立（3点）</span>
              <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-orange-400" />否定（1〜2点）</span>
            </div>
            <InsightNote text={insights?.distribution} loading={insightsLoading} />
          </CardContent>
        </Card>
      )}

      {/* 段階別の詳細 */}
      {funnelData && (
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3 mb-1">
              <h3 className="text-sm font-bold text-foreground">段階別の詳細</h3>
              {funnel && (
                <Badge variant="outline" className="text-[10px] shrink-0 bg-background">{PATTERN_LABELS[funnel.pattern]}</Badge>
              )}
            </div>
            {funnel && (
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">{PATTERN_MEANINGS[funnel.pattern]}</p>
            )}
            {/* 2つの数字の関係が分からないと読めないので必ず添える */}
            <div className="flex items-center justify-end gap-1 pr-0.5 text-[9.5px] text-muted-foreground">
              <span className="w-9 text-right">5点満点</span>
              <span className="w-8 text-right">0〜100</span>
            </div>
            <div>
              {FUNNEL_STAGES.map((stage, i) => {
                const s = stageScoreOf(stage)
                const a = stageAvgOf(stage)
                const summary = funnel?.stages.find(x => x.stage === stage)
                const isWeakest = weakestStage === stage
                const boScore = deptStageScore('BO本社', stage)
                const spScore = deptStageScore('SP', stage)
                const boAvg = deptStageAvg('BO本社', stage)
                const spAvg = deptStageAvg('SP', stage)
                return (
                  <div key={stage}>
                    {stage === INFLECTION_STAGE && <div aria-hidden className="my-2 border-t border-border" />}
                    <div className="flex items-start gap-3 py-2">
                      <div className="w-[124px] shrink-0">
                        <p className="m-0 text-sm font-bold text-foreground">{i + 1}. {STAGE_LABELS[stage]}</p>
                        <p className="m-0 text-[10px] text-muted-foreground">{STAGE_QUESTIONS[stage]}・{summary?.questionCount ?? 0}問</p>
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="space-y-1">
                          {([
                            { key: '全社', value: s, avg: a, color: 'bg-ds-app-accent-soft', worst: isWeakest, best: strongestStage === stage },
                            { key: 'SP', value: spScore, avg: spAvg, color: 'bg-green-500', worst: weakestSpStage === stage, best: strongestSpStage === stage },
                            { key: 'BO', value: boScore, avg: boAvg, color: 'bg-orange-400', worst: weakestBoStage === stage, best: strongestBoStage === stage },
                          ] as const).map(bar => bar.value === null ? null : (
                            <div key={bar.key} className="flex items-center gap-2">
                              <span className="w-7 shrink-0 text-[10px] text-muted-foreground">{bar.key}</span>
                              {/* 棒は 0〜100 スケール。5点満点を1点起点で描いたものと
                                  同じ形になる。中央の破線が3.0＝どちらとも言えない */}
                              <div className="relative h-2 min-w-0 flex-1 rounded-full bg-muted">
                                <div className={`h-full rounded-full ${bar.color}`} style={{ width: `${bar.value}%` }} />
                                <span
                                  aria-hidden
                                  className="pointer-events-none absolute left-1/2 top-0 h-full border-l border-dashed border-orange-400/70"
                                />
                              </div>
                              <span className={`w-9 shrink-0 text-right text-[11px] tabular-nums ${
                                bar.worst ? 'font-bold text-orange-600' : bar.best ? 'font-bold text-ds-app-accent' : 'font-bold text-foreground'
                              }`}>
                                {bar.avg !== null ? bar.avg.toFixed(2) : '-'}
                              </span>
                              <span className="w-8 shrink-0 text-right text-[9.5px] tabular-nums text-muted-foreground">
                                {bar.value.toFixed(1)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-ds-app-accent-soft" />全社</span>
              <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-green-500" />SP</span>
              <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-orange-400" />BO（本社含む）</span>
            </div>
            <p className="m-0 mt-2 text-[10px] leading-relaxed text-muted-foreground">
              よこ軸は5点満点。1点が最低なので1から表示している（0点をつけた人はいない）。
              破線の3.0が「どちらとも言えない」。
            </p>
            <InsightNote text={insights?.stages} loading={insightsLoading} />
          </CardContent>
        </Card>
      )}

      {/* 段階の通過率 */}
      {funnelData && (
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <h3 className="text-sm font-bold text-foreground mb-1">段階の通過率</h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              点数ではなく人数。そこまでの段階<span className="font-semibold text-foreground">すべて</span>で
              平均{funnelData.pass_threshold}点以上だった人の割合です。
              上の段階スコアと同じ5点満点の物差しで判定しています。
            </p>
            <div>
              {FUNNEL_STAGES.map((stage, i) => {
                const cum = funnelData.overall.cumulative.find(x => x.stage === stage)
                const solo = funnelData.overall.standalone.find(x => x.stage === stage)
                const bo = deptPass('BO本社', stage)
                const sp = deptPass('SP', stage)
                const boCount = deptPassCount('BO本社', stage)
                const spCount = deptPassCount('SP', stage)
                return (
                  <div key={stage}>
                    {stage === INFLECTION_STAGE && <div aria-hidden className="my-2 border-t border-border" />}
                    <div className="flex items-center gap-3 py-1.5">
                      <div className="w-[124px] shrink-0">
                        <p className="m-0 text-sm font-bold text-foreground">{i + 1}. {STAGE_LABELS[stage]}</p>
                        <p className="m-0 text-[10px] text-muted-foreground">単独では {solo?.rate.toFixed(1)}%</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="h-6 rounded bg-muted">
                          <div className="flex h-full items-center justify-end gap-2 rounded bg-ds-app-accent-soft px-2" style={{ width: `${cum?.rate ?? 0}%` }}>
                            <span className="text-[10px] font-bold text-white whitespace-nowrap">{cum?.rate.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-muted-foreground">
                          {sp !== null && <span>SP {sp.toFixed(1)}%{spCount !== null && `（${spCount}人）`}</span>}
                          {bo !== null && <span>BO {bo.toFixed(1)}%{boCount !== null && `（${boCount}人）`}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <InsightNote text={insights?.funnel} loading={insightsLoading} />
          </CardContent>
        </Card>
      )}

      {/* 設問別スコア（軸切替: 浸透段階 / 設問タイプ） */}
      {breakdown && (
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-bold text-foreground">設問別スコア</h3>
              <div className="flex rounded-md border bg-background p-0.5 text-xs">
                {questionAxisOptions.map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setQuestionAxis(opt.key)}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      effectiveAxis === opt.key ? 'bg-foreground text-background font-semibold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              {questionGroups.map(group => (
                <div key={group.key} className="mb-5 last:mb-0">
                  <div className="mb-2 flex items-baseline gap-2 flex-wrap">
                    <p className="m-0 text-xs font-bold text-foreground">{group.label}</p>
                    {group.sub && <p className="m-0 text-[10px] text-muted-foreground">{group.sub}</p>}
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {group.avg !== null && `平均 ${group.avg.toFixed(2)} / `}{group.questions.length}問
                    </span>
                  </div>
                  <div className="space-y-2">
                    {group.questions.map(q => {
                      const isLow = q.questionId === group.worstId && q.avg < 3.5
                      return (
                        <div key={q.questionId} className={`flex items-center gap-3 py-2 px-3 rounded-md ${isLow ? 'bg-orange-50 border border-orange-200' : 'bg-background'}`}>
                          <span className="w-7 shrink-0 text-right text-[10px] text-muted-foreground">Q{q.sortOrder}</span>
                          <div className="min-w-0 flex-1">
                            <p className={`m-0 text-sm leading-relaxed ${isLow ? 'text-orange-800' : 'text-foreground'}`}>{q.questionText}</p>
                          </div>
                          <div className="hidden sm:flex h-2.5 w-24 shrink-0 overflow-hidden rounded-full">
                            <div className="bg-ds-app-accent-soft" style={{ width: `${q.positiveRate}%` }} />
                            <div className="bg-gray-300" style={{ width: `${q.neutralRate}%` }} />
                            <div className="bg-orange-400" style={{ width: `${q.negativeRate}%` }} />
                          </div>
                          <span className={`w-9 shrink-0 text-right text-sm font-bold ${isLow ? 'text-orange-700' : 'text-foreground'}`}>{q.avg.toFixed(2)}</span>
                          <span className="w-12 shrink-0 text-right text-[10px] text-muted-foreground">{q.responseCount}件</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-ds-app-accent-soft" />肯定</span>
              <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-gray-300" />中立</span>
              <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-orange-400" />否定</span>
              <span>各グループ内はスコア昇順</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
