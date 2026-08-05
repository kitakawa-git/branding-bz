'use client'

// 市場調査の指標マッピング画面
// ============================================================
// 左に5段階のスロット、右に設問一覧。
// まず「候補を自動で割り当てる」で機械的に当て、違うところだけ手で直す。
// 自動割り当ては列ラベルの規約（〜・計）に乗せた決定論的な判定で、
// 当たらなければ提案0件になるだけ。誤った候補を黙って確定はしない。
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAuth } from '../../../../components/AdminDataProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Loader2,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Check,
  Users,
  Wand2,
} from 'lucide-react'
import {
  MARKET_STAGES,
  MARKET_STAGE_LABELS,
  MARKET_STAGE_QUESTIONS,
  MARKET_STAGE_HINTS,
  type MarketStage,
} from '@/lib/brand-score/market-stages'

type Survey = {
  id: string
  title: string
  research_firm: string
  sample_size: number | null
  status: string
  source_sheet_name: string
}

type Block = {
  id: string
  block_key: string
  block_index: number
  question_code: string
  question_text: string
  answer_type: string
  block_base_n: number | null
  columns: { code: string | null; label: string }[] | null
  is_attribute: boolean
}

type Cell = {
  id: string
  block_id: string
  row_code: string | null
  row_label: string
  row_index: number
  col_code: string | null
  col_label: string | null
  col_index: number | null
  value: number | null
  base_n: number | null
  kind: string
}

type Mapping = {
  id: string
  stage: MarketStage
  cell_id: string
  subject: 'self' | 'competitor'
  competitor_name: string | null
  weight: number
}

type StageScore = {
  stage: MarketStage
  status: 'scored' | 'absent' | 'unmapped'
  raw_percent: number | null
  score: number | null
  base_n: number | null
  benchmark: { competitorMax: number; competitorAvg: number; rank: number; n: number } | null
}

export default function MarketSurveyMappingPage() {
  const params = useParams()
  const router = useRouter()
  const { company } = useAuth()
  const surveyId = params.id as string

  const [survey, setSurvey] = useState<Survey | null>(null)
  const [blocks, setBlocks] = useState<Block[]>([])
  const [cells, setCells] = useState<Cell[]>([])
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [stageScores, setStageScores] = useState<StageScore[]>([])
  const [loading, setLoading] = useState(true)
  const [savingStage, setSavingStage] = useState<MarketStage | null>(null)
  const [activating, setActivating] = useState(false)
  const [autoMapping, setAutoMapping] = useState(false)

  // 右ペインの状態
  const [query, setQuery] = useState('')
  const [showAttributes, setShowAttributes] = useState(false)
  const [openBlockId, setOpenBlockId] = useState<string | null>(null)
  // いま「どの段階に割り当てるか」を選んでいる状態。null なら選択モードではない
  const [targetStage, setTargetStage] = useState<MarketStage | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch(`/api/brand-score/market-surveys/${surveyId}`)
      if (!res.ok) {
        toast.error('調査を取得できませんでした')
        return
      }
      const data = await res.json()
      setSurvey(data.survey)
      setBlocks(data.blocks ?? [])
      setCells(data.cells ?? [])
      setMappings(data.mappings ?? [])
      setStageScores(data.stageScores ?? [])
    } catch (err) {
      console.error('[MarketMapping] 取得エラー:', err)
    } finally {
      setLoading(false)
    }
  }, [surveyId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const cellsByBlock = useMemo(() => {
    const m = new Map<string, Cell[]>()
    for (const c of cells) {
      if (!m.has(c.block_id)) m.set(c.block_id, [])
      m.get(c.block_id)!.push(c)
    }
    return m
  }, [cells])

  const cellById = useMemo(() => new Map(cells.map((c) => [c.id, c])), [cells])
  const blockById = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks])

  const mappingsByStage = useMemo(() => {
    const m = new Map<MarketStage, Mapping[]>()
    for (const mp of mappings) {
      if (!m.has(mp.stage)) m.set(mp.stage, [])
      m.get(mp.stage)!.push(mp)
    }
    return m
  }, [mappings])

  // 自社行らしきものにバッジを付ける。表記ゆれ（リィツ/リッツ）が実在するので
  // 自動確定はせず、視線誘導だけに使う
  const companyHints = useMemo(() => {
    const names = [company?.name, company?.name_ja, company?.name_en]
      .filter((n): n is string => typeof n === 'string' && n.length >= 2)
      .map((n) => n.replace(/[\s　株式会社有限合同]/g, ''))
    return names.filter((n) => n.length >= 2)
  }, [company])

  const looksLikeSelf = useCallback(
    (label: string) => {
      if (companyHints.length === 0) return false
      const norm = label.replace(/[\s　株式会社有限合同]/g, '')
      return companyHints.some(
        (h) => norm.includes(h.slice(0, 3)) || h.includes(norm.slice(0, 3))
      )
    },
    [companyHints]
  )

  // 検索は設問コード・設問文・行ラベル・列ラベルを横断する。
  // 「リィツ」で自社行を含む設問だけに絞れることが実用上いちばん効く
  const visibleBlocks = useMemo(() => {
    const q = query.trim().toLowerCase()
    return blocks.filter((b) => {
      if (!showAttributes && b.is_attribute) return false
      if (!q) return true
      if (
        b.question_code.toLowerCase().includes(q) ||
        b.question_text.toLowerCase().includes(q)
      ) {
        return true
      }
      const bc = cellsByBlock.get(b.id) ?? []
      return bc.some(
        (c) =>
          c.row_label.toLowerCase().includes(q) ||
          (c.col_label ?? '').toLowerCase().includes(q)
      )
    })
  }, [blocks, query, showAttributes, cellsByBlock])

  const attributeCount = blocks.filter((b) => b.is_attribute).length

  // ── 段階への割り当て ──
  const saveStage = async (
    stage: MarketStage,
    body: { absent?: boolean; cells?: { cellId: string; subject: string; competitorName?: string | null }[] }
  ) => {
    setSavingStage(stage)
    try {
      const res = await fetch(`/api/brand-score/market-surveys/${surveyId}/stages`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, ...body }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '保存に失敗しました')
        return
      }
      await fetchAll()
    } catch {
      toast.error('保存に失敗しました')
    } finally {
      setSavingStage(null)
    }
  }

  /** セルを段階に割り当てる（自社として1つ） */
  const assignCell = async (stage: MarketStage, cell: Cell, withCompetitors: boolean) => {
    const list: { cellId: string; subject: string; competitorName?: string | null }[] = [
      { cellId: cell.id, subject: 'self' },
    ]

    // 同じ列の他の行を競合として一緒に登録する（順位・トップとの差の算出に使う）
    if (withCompetitors) {
      const siblings = (cellsByBlock.get(cell.block_id) ?? []).filter(
        (c) =>
          c.id !== cell.id &&
          c.col_index === cell.col_index &&
          c.kind === 'option' &&
          c.value !== null
      )
      for (const s of siblings) {
        list.push({ cellId: s.id, subject: 'competitor', competitorName: s.row_label })
      }
    }

    await saveStage(stage, { cells: list })
    setTargetStage(null)
    toast.success(
      `${MARKET_STAGE_LABELS[stage]}に割り当てました${withCompetitors ? '（競合も登録）' : ''}`
    )
  }

  // 候補を機械的に当てる。41設問×数十セルを人が全部当てるのは現実的でないため。
  // 当てた結果は左のスロットに出るので、違っていれば個別に割り当て直せる
  const handleAutoMap = async () => {
    setAutoMapping(true)
    try {
      const res = await fetch(
        `/api/brand-score/market-surveys/${surveyId}/auto-map`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apply: true }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '自動割り当てに失敗しました')
        return
      }

      const n = (data.applied ?? []).length
      if (n === 0) {
        toast.error(
          'この調査からは候補を見つけられませんでした。手動で割り当ててください。'
        )
      } else {
        const missing: MarketStage[] = data.missing ?? []
        toast.success(
          `${n}段階を自動で割り当てました` +
            (missing.length > 0
              ? `。${missing.map((m) => MARKET_STAGE_LABELS[m]).join('・')}は候補が見つかりませんでした`
              : '')
        )
      }
      await fetchAll()
    } catch {
      toast.error('自動割り当てに失敗しました')
    } finally {
      setAutoMapping(false)
    }
  }

  const clearStage = async (stage: MarketStage) => {
    await saveStage(stage, { cells: [] })
  }

  const markAbsent = async (stage: MarketStage, absent: boolean) => {
    await saveStage(stage, { absent, cells: [] })
  }

  const handleActivate = async () => {
    setActivating(true)
    try {
      const res = await fetch(`/api/brand-score/market-surveys/${surveyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '反映できませんでした')
        return
      }
      toast.success('アウタースコアに反映しました')
      router.push(`/admin/brand-score/market-surveys/${surveyId}`)
    } catch {
      toast.error('反映できませんでした')
    } finally {
      setActivating(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  if (!survey) {
    return <p className="text-sm text-muted-foreground">調査が見つかりません</p>
  }

  const scoredCount = stageScores.filter((s) => s.status === 'scored').length

  return (
    <div>
      {/* ヘッダー */}
      <div className="mb-4">
        <h1 className="truncate text-2xl font-bold text-foreground">{survey.title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {survey.research_firm && `${survey.research_firm}・`}
          {survey.sample_size !== null && `n=${survey.sample_size}・`}
          設問{blocks.length}件
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        {/* ── 左: 5段階のスロット ── */}
        <div className="space-y-4">
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5">
              <h2 className="mb-1 text-xs font-bold text-foreground">市場浸透の5段階</h2>
              <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
                どの設問のどの値をどの段階に使うかを決めます。該当する設問が無い段階は
                「この調査では未計測」にしてください。0点として扱われるのを防ぎます。
              </p>

              {/* まず自動で当てて、違うところだけ直す運用を想定している */}
              <Button
                variant="outline"
                size="sm"
                className="mb-4 w-full"
                onClick={handleAutoMap}
                disabled={autoMapping || savingStage !== null}
              >
                {autoMapping ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Wand2 size={14} />
                )}
                候補を自動で割り当てる
              </Button>

              <div className="space-y-2">
                {MARKET_STAGES.map((stage, i) => {
                  const sc = stageScores.find((s) => s.stage === stage)
                  const mps = mappingsByStage.get(stage) ?? []
                  const selfMp = mps.find((m) => m.subject === 'self')
                  const selfCell = selfMp ? cellById.get(selfMp.cell_id) : null
                  const block = selfCell ? blockById.get(selfCell.block_id) : null
                  const competitorCount = mps.filter((m) => m.subject === 'competitor').length
                  const isTarget = targetStage === stage
                  const busy = savingStage === stage

                  return (
                    <div
                      key={stage}
                      className={`rounded-md border p-3 transition-colors ${
                        isTarget ? 'border-ds-app-accent bg-blue-50' : 'bg-background'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="m-0 text-sm font-bold text-foreground">
                            {i + 1}. {MARKET_STAGE_LABELS[stage]}
                          </p>
                          <p className="m-0 text-[10px] text-muted-foreground">
                            {MARKET_STAGE_QUESTIONS[stage]}
                          </p>
                        </div>
                        {busy ? (
                          <Loader2 size={14} className="mt-0.5 shrink-0 animate-spin" />
                        ) : sc?.status === 'scored' ? (
                          <div className="shrink-0 text-right">
                            <p className="m-0 text-base font-bold text-ds-app-accent">
                              {sc.score?.toFixed(1)}
                            </p>
                            <p className="m-0 text-[10px] text-muted-foreground">
                              {sc.raw_percent?.toFixed(1)}%
                              {sc.base_n !== null && ` n=${sc.base_n}`}
                            </p>
                          </div>
                        ) : null}
                      </div>

                      {/* 割り当て済みの中身 */}
                      {sc?.status === 'scored' && selfCell && (
                        <div className="mt-2 rounded bg-muted/50 px-2 py-1.5">
                          <p className="m-0 truncate text-[10px] text-muted-foreground">
                            {block?.question_code} × {selfCell.row_label}
                            {selfCell.col_label && ` × ${selfCell.col_label}`}
                          </p>
                          {competitorCount > 0 && (
                            <p className="m-0 mt-0.5 text-[10px] text-muted-foreground">
                              競合{competitorCount}社を登録
                              {sc.benchmark && `・${sc.benchmark.n}社中${sc.benchmark.rank}位`}
                            </p>
                          )}
                        </div>
                      )}

                      {sc?.status === 'absent' && (
                        <p className="m-0 mt-2 text-[10px] text-muted-foreground">
                          この調査では未計測
                        </p>
                      )}

                      {/* 操作 */}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {sc?.status !== 'absent' && (
                          <Button
                            variant={isTarget ? 'default' : 'outline'}
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            disabled={busy}
                            onClick={() => setTargetStage(isTarget ? null : stage)}
                          >
                            {isTarget
                              ? '選択中…（右で値をクリック）'
                              : sc?.status === 'scored'
                                ? '割り当て直す'
                                : '割り当てる'}
                          </Button>
                        )}
                        {sc?.status === 'scored' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] text-muted-foreground"
                            disabled={busy}
                            onClick={() => clearStage(stage)}
                          >
                            解除
                          </Button>
                        )}
                        <label className="ml-auto flex cursor-pointer items-center gap-1 text-[10px] text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={sc?.status === 'absent'}
                            disabled={busy}
                            onChange={(e) => markAbsent(stage, e.target.checked)}
                            className="size-3"
                          />
                          該当設問がない
                        </label>
                      </div>

                      {isTarget && (
                        <p className="m-0 mt-2 text-[10px] leading-relaxed text-ds-app-accent">
                          {MARKET_STAGE_HINTS[stage]}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* 反映ボタン */}
              <div className="mt-4 border-t pt-3">
                <p className="mb-2 text-[10px] text-muted-foreground">
                  スコアを算出できた段階 {scoredCount} / 5
                  {scoredCount < 3 && '（3件以上でアウタースコアに反映できます）'}
                </p>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={scoredCount < 3 || activating || survey.status === 'active'}
                  onClick={handleActivate}
                >
                  {activating && <Loader2 size={14} className="animate-spin" />}
                  {survey.status === 'active'
                    ? 'アウタースコアに反映済み'
                    : 'アウタースコアに反映する'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── 右: 設問一覧 ── */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="設問・選択肢・社名で絞り込む"
                  className="h-9 pl-8"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {attributeCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAttributes((v) => !v)}
                  className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  {showAttributes ? '属性設問を隠す' : `属性設問も表示（${attributeCount}）`}
                </button>
              )}
            </div>

            {targetStage && (
              <div className="mb-3 rounded-md border border-ds-app-accent bg-blue-50 px-3 py-2">
                <p className="m-0 text-[11px] text-ds-app-accent">
                  <span className="font-bold">
                    {MARKET_STAGE_LABELS[targetStage]}に割り当てます。
                  </span>
                  設問を開いて、使いたい値をクリックしてください。
                </p>
              </div>
            )}

            <div className="max-h-[calc(100vh-320px)] space-y-1 overflow-y-auto">
              {visibleBlocks.length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  該当する設問がありません
                </p>
              )}

              {visibleBlocks.map((b) => {
                const open = openBlockId === b.id
                const bc = cellsByBlock.get(b.id) ?? []
                const assignedIds = new Set(mappings.map((m) => m.cell_id))

                return (
                  <div key={b.id} className="rounded-md border bg-background">
                    <button
                      type="button"
                      onClick={() => setOpenBlockId(open ? null : b.id)}
                      className="flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left"
                    >
                      {open ? (
                        <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
                      )}
                      <span className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground">
                        {b.question_code || b.block_key}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs" title={b.question_text}>
                        {b.question_text || '（設問文なし）'}
                      </span>
                      {b.is_attribute && (
                        <Badge
                          variant="secondary"
                          className="shrink-0 px-1 py-0 text-[9px] text-muted-foreground"
                        >
                          属性
                        </Badge>
                      )}
                      <span className="w-14 shrink-0 text-right text-[10px] text-muted-foreground">
                        {b.block_base_n !== null ? `n=${b.block_base_n}` : ''}
                      </span>
                    </button>

                    {open && (
                      <div className="border-t px-3 py-2">
                        {/* 値の一覧。マトリクスは 行 × 列 */}
                        <div className="max-h-72 overflow-auto">
                          <table className="w-full text-[11px]">
                            <tbody>
                              {bc.map((c) => {
                                const assigned = assignedIds.has(c.id)
                                const self = looksLikeSelf(c.row_label)
                                const clickable = targetStage !== null && c.value !== null
                                return (
                                  <tr
                                    key={c.id}
                                    className={`border-b last:border-0 ${
                                      clickable ? 'cursor-pointer hover:bg-blue-50' : ''
                                    } ${assigned ? 'bg-blue-50/60' : ''}`}
                                    onClick={() => {
                                      if (!clickable) return
                                      assignCell(targetStage, c, false)
                                    }}
                                  >
                                    <td className="py-1 pr-2">
                                      <span
                                        className={
                                          self ? 'font-bold text-foreground' : 'text-foreground'
                                        }
                                      >
                                        {c.row_label}
                                      </span>
                                      {self && (
                                        <span className="ml-1 text-[9px] text-ds-app-accent">
                                          自社？
                                        </span>
                                      )}
                                      {c.kind !== 'option' && (
                                        <span className="ml-1 text-[9px] text-muted-foreground">
                                          {c.kind === 'net' ? '計' : '無回答'}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-1 pr-2 text-muted-foreground">
                                      {c.col_label ?? ''}
                                    </td>
                                    <td className="w-16 py-1 text-right tabular-nums">
                                      {c.value !== null ? `${c.value.toFixed(1)}%` : '—'}
                                    </td>
                                    <td className="w-12 py-1 text-right text-[10px] text-muted-foreground">
                                      {c.base_n !== null ? `n=${c.base_n}` : ''}
                                    </td>
                                    <td className="w-8 py-1 text-right">
                                      {assigned && (
                                        <Check size={12} className="ml-auto text-ds-app-accent" />
                                      )}
                                    </td>
                                    {clickable && c.col_index !== null && (
                                      <td className="w-8 py-1 text-right">
                                        <button
                                          type="button"
                                          title="この行を自社、同じ列の他社を競合として登録"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            assignCell(targetStage, c, true)
                                          }}
                                          className="text-muted-foreground hover:text-ds-app-accent"
                                        >
                                          <Users size={12} />
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                        {targetStage && (
                          <p className="m-0 mt-2 text-[10px] text-muted-foreground">
                            行をクリックで自社として割り当て。
                            <Users size={10} className="mx-1 inline" />
                            を押すと同じ列の他社も競合として登録します（順位の算出に使います）。
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
