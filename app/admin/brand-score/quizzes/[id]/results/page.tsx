'use client'

// 理解度テスト 結果（集計）ページ ★k匿名前提
// 個人名×スコアは絶対に並べない。participants（受験有無）とは結合しない。
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts'
import { ArrowLeft, Users, ShieldCheck, Info } from 'lucide-react'
import { QuizTabs } from '../QuizTabs'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: '下書き', className: 'bg-gray-100 text-gray-700' },
  active: { label: '実施中', className: 'bg-green-100 text-green-700' },
  closed: { label: '終了', className: 'bg-blue-100 text-blue-700' },
  archived: { label: 'アーカイブ', className: 'bg-gray-100 text-gray-500' },
}

const ROLE_LABELS: Record<string, string> = {
  executive: '経営層',
  manager: '管理職',
  staff: '一般',
}

const CATEGORY_LABELS: Record<string, string> = {
  why: 'WHY（理念）',
  how: 'HOW（戦略・ルール）',
  what: 'WHAT（行動）',
}

const K = 3 // 表示用のしきい値（API 側 K_ANONYMITY_THRESHOLD と一致）

type QuizMeta = { id: string; title: string; status: string }

type Results = {
  overall: { score: number | null; why_score: number | null; how_score: number | null; what_score: number | null } | null
  insufficient: boolean
  response: { attempt_count: number; total_members: number; response_rate: number }
  by_department: { department: string | null; n: number; score: number | null; why_score: number | null; how_score: number | null }[]
  by_role: { role_category: string | null; n: number; score: number | null }[]
  suppressed: { departments: number; questions: number; note: string }
  question_stats: { question_id: string; category: string; question_text: string; correct_rate: number; n: number }[]
}

function barColor(v: number): string {
  if (v >= 80) return '#16a34a'
  if (v >= 60) return '#2563eb'
  if (v >= 40) return '#ca8a04'
  return '#dc2626'
}

function fmt(v: number | null): string {
  return v === null || v === undefined ? '—' : `${v}%`
}

export default function QuizResultsPage() {
  const params = useParams()
  const router = useRouter()
  const quizId = params.id as string

  const [meta, setMeta] = useState<QuizMeta | null>(null)
  const [results, setResults] = useState<Results | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!quizId) return
    try {
      const [quizRes, resultsRes] = await Promise.all([
        fetch(`/api/brand-score/quizzes/${quizId}`),
        fetch(`/api/brand-score/quizzes/${quizId}/results`),
      ])
      if (quizRes.ok) {
        const q = await quizRes.json()
        setMeta({ id: q.quiz.id, title: q.quiz.title, status: q.quiz.status })
      }
      if (resultsRes.ok) {
        setResults(await resultsRes.json())
      }
    } catch (err) {
      console.error('[QuizResults] 取得エラー:', err)
    } finally {
      setLoading(false)
    }
  }, [quizId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const statusConfig = meta ? STATUS_CONFIG[meta.status] || STATUS_CONFIG.draft : null
  const overall = results?.overall
  const insufficient = results?.insufficient ?? true
  const remaining = results ? Math.max(0, K - results.response.attempt_count) : K

  const overallChartData =
    overall
      ? [
          { name: '全体', value: overall.score },
          { name: 'WHY', value: overall.why_score },
          { name: 'HOW', value: overall.how_score },
          ...(overall.what_score !== null ? [{ name: 'WHAT', value: overall.what_score }] : []),
        ].filter((d): d is { name: string; value: number } => d.value !== null)
      : []

  // 弱点把握: 正答率の低い順
  const weakSorted = results
    ? [...results.question_stats].sort((a, b) => a.correct_rate - b.correct_rate)
    : []

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => router.push('/admin/brand-score/quizzes')}>
          <ArrowLeft size={18} />
        </Button>
        <h1 className="text-lg font-bold text-foreground flex-1 truncate">{meta?.title ?? '結果'}</h1>
        {statusConfig && (
          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${statusConfig.className}`}>
            {statusConfig.label}
          </Badge>
        )}
      </div>

      <QuizTabs quizId={quizId} />

      {/* 回答率（件数なので常時表示） */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-4">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Users size={14} /> 受験率
            </span>
            <span className="text-sm font-medium">
              {results?.response.attempt_count ?? 0}/{results?.response.total_members ?? 0}人
              （{results?.response.response_rate ?? 0}%）
            </span>
          </div>
          <Progress value={results?.response.response_rate ?? 0} className="h-1.5" />
        </CardContent>
      </Card>

      {/* 全体スコア（小N時は集計中プレースホルダ） */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-4">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold mb-3">全体スコア（全社平均）</h2>
          {insufficient || !overall ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-md p-4">
              <ShieldCheck size={16} className="shrink-0" />
              回答数が少ないため集計を表示できません（匿名性確保のため。あと {remaining} 件）
            </div>
          ) : (
            <>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overallChartData} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {overallChartData.map((d, i) => (
                        <Cell key={i} fill={barColor(d.value)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm mt-2">
                <span><span className="text-muted-foreground">全体: </span><span className="font-semibold">{fmt(overall.score)}</span></span>
                <span><span className="text-muted-foreground">WHY: </span><span className="font-semibold">{fmt(overall.why_score)}</span></span>
                <span><span className="text-muted-foreground">HOW: </span><span className="font-semibold">{fmt(overall.how_score)}</span></span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 部署別 / 役職別（n>=3 のみ。API が抑制済み） */}
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold mb-3">部署別（3人以上）</h2>
            {results && results.by_department.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">部署</TableHead>
                    <TableHead className="text-xs text-right">人数</TableHead>
                    <TableHead className="text-xs text-right">全体</TableHead>
                    <TableHead className="text-xs text-right">WHY</TableHead>
                    <TableHead className="text-xs text-right">HOW</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.by_department.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{d.department ?? '未設定'}</TableCell>
                      <TableCell className="text-sm text-right">{d.n}</TableCell>
                      <TableCell className="text-sm text-right font-medium">{fmt(d.score)}</TableCell>
                      <TableCell className="text-sm text-right">{fmt(d.why_score)}</TableCell>
                      <TableCell className="text-sm text-right">{fmt(d.how_score)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-xs text-muted-foreground">表示できる部署がありません</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold mb-3">役職別（3人以上）</h2>
            {results && results.by_role.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">役職</TableHead>
                    <TableHead className="text-xs text-right">人数</TableHead>
                    <TableHead className="text-xs text-right">全体</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.by_role.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">
                        {r.role_category ? ROLE_LABELS[r.role_category] ?? r.role_category : '未設定'}
                      </TableCell>
                      <TableCell className="text-sm text-right">{r.n}</TableCell>
                      <TableCell className="text-sm text-right font-medium">{fmt(r.score)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-xs text-muted-foreground">表示できる役職がありません</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 抑制注記 */}
      {results && (results.suppressed.departments > 0 || results.suppressed.questions > 0) && (
        <div className="flex items-start gap-2 mb-4 text-xs text-muted-foreground bg-muted/40 rounded-md p-3">
          <Info size={14} className="shrink-0 mt-0.5" />
          <span>
            3人未満のグループ・設問は匿名性確保のため非表示にしています
            {results.suppressed.departments > 0 && `（非表示の部署: ${results.suppressed.departments}）`}
          </span>
        </div>
      )}

      {/* 設問別正答率（弱点把握） */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold mb-3">設問別 正答率（弱点把握・3人以上）</h2>
          {weakSorted.length > 0 ? (
            <div className="space-y-2.5">
              {weakSorted.map((q) => (
                <div key={q.question_id}>
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <span className="text-xs text-foreground leading-snug flex-1">
                      <span className="text-[10px] text-muted-foreground mr-1.5">
                        {CATEGORY_LABELS[q.category] ?? q.category}
                      </span>
                      {q.question_text}
                    </span>
                    <span className="text-xs font-medium shrink-0 whitespace-nowrap">
                      {q.correct_rate}%（n={q.n}）
                    </span>
                  </div>
                  <Progress value={q.correct_rate} className="h-1.5" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              表示できる設問別データがありません（受験数が3人以上になると表示されます）
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
