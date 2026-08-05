// 市場調査の詳細取得・更新・削除
// GET    /api/brand-score/market-surveys/[id]  → 調査 + 設問 + 集計値 + 割り当て + 段階スコア
// PATCH  /api/brand-score/market-surveys/[id]  → メタ情報・status の更新
// DELETE /api/brand-score/market-surveys/[id]
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { fetchAllRows } from '@/lib/brand-score/fetch-all-rows'
import { MARKET_STAGES } from '@/lib/brand-score/market-stages'
import { MIN_BENCHMARK_BASE_N } from '@/lib/brand-score/market-stage-score'
import { extractMarketExtras } from '@/lib/brand-score/market-extras'

type RouteContext = { params: Promise<{ id: string }> }

type CellRow = {
  id: string
  block_id: string
  row_code: string | null
  row_label: string
  row_index: number
  col_code: string | null
  col_label: string | null
  col_index: number | null
  value: number | null
  value_raw: string
  base_n: number | null
  kind: string
  source_row: number | null
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const supabase = getSupabaseAdmin()

    const { data: survey, error: surveyErr } = await supabase
      .from('market_surveys')
      .select('*')
      .eq('id', id)
      .single()

    if (surveyErr) {
      const status = surveyErr.code === 'PGRST116' ? 404 : 500
      return NextResponse.json({ error: surveyErr.message }, { status })
    }

    const { data: blocks, error: blockErr } = await supabase
      .from('market_survey_blocks')
      .select('*')
      .eq('survey_id', id)
      .order('block_index', { ascending: true })

    if (blockErr) {
      return NextResponse.json({ error: blockErr.message }, { status: 500 })
    }

    const blockIds = (blocks ?? []).map((b) => b.id as string)

    // 1調査で1000セルを超える（実例1296）。PostgREST の既定上限で
    // 黙って切られるためページングで全件取る
    let cells: CellRow[] = []
    if (blockIds.length > 0) {
      const { data, error } = await fetchAllRows<CellRow>(() =>
        supabase
          .from('market_survey_cells')
          .select('*')
          .in('block_id', blockIds)
          .order('id')
      )
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      cells = data ?? []
    }

    const [{ data: mappings }, { data: scores }] = await Promise.all([
      supabase.from('market_survey_stage_mappings').select('*').eq('survey_id', id),
      supabase.from('market_survey_stage_scores').select('*').eq('survey_id', id),
    ])

    // 段階ごとの「自社＋競合」の並び。詳細画面のランキング表示に使う。
    // 母数の小さい競合は順位を歪めるので外す（段階スコアの benchmark と同じ基準）。
    // 自社は母数に関わらず必ず残す
    const cellIndex = new Map(cells.map((c) => [c.id, c]))
    const ranking: Record<string, { name: string; value: number; isSelf: boolean }[]> = {}
    for (const m of mappings ?? []) {
      const c = cellIndex.get(m.cell_id as string)
      if (!c || c.value === null) continue
      const isSelf = m.subject === 'self'
      if (!isSelf && c.base_n !== null && c.base_n < MIN_BENCHMARK_BASE_N) continue
      const stage = m.stage as string
      if (!ranking[stage]) ranking[stage] = []
      ranking[stage].push({
        name: isSelf ? c.row_label : ((m.competitor_name as string) ?? c.row_label),
        value: Number(c.value),
        isSelf,
      })
    }
    for (const k of Object.keys(ranking)) {
      ranking[k].sort((a, b) => b.value - a.value)
    }

    // 段階ごとの「元の設問」。レポートと突き合わせるときに、
    // 画面の『評価』が調査票のどの設問だったのかが分からないと確認できない
    const blockIndex = new Map((blocks ?? []).map((b) => [b.id as string, b]))
    const stageSources: Record<string, { code: string | null; label: string | null }> = {}
    for (const m of mappings ?? []) {
      if (m.subject !== 'self') continue
      const c = cellIndex.get(m.cell_id as string)
      if (!c) continue
      const b = blockIndex.get(c.block_id)
      // 列見出し（「ロイヤリティあり・計」など）が無いときは
      // 設問文の末尾にある【第1想起】のような目印を使う
      const bracket = ((b?.question_text as string) ?? '').match(/【([^】]+)】\s*$/)
      stageSources[m.stage as string] = {
        code: (b?.question_code as string) ?? null,
        label: c.col_label ?? bracket?.[1] ?? null,
      }
    }

    // 5段階以外の読みどころ（印象一致度・パーソナリティ・認知経路・事業浸透度・サービス評価）。
    // 自社名は5段階の割り当てから取る。人が「これが自社」と決めた唯一の情報のため
    const selfName =
      (mappings ?? []).find((m) => m.subject === 'self')
        ? (cellIndex.get(
            (mappings ?? []).find((m) => m.subject === 'self')!.cell_id as string
          )?.row_label ?? null)
        : null
    const extras = extractMarketExtras(blocks ?? [], cells, selfName)

    return NextResponse.json({
      survey,
      blocks: blocks ?? [],
      cells,
      mappings: mappings ?? [],
      ranking,
      stageSources,
      selfName,
      extras,
      // 未登録の段階も unmapped として必ず5件返す（画面がスロットを常に5つ出せるように）
      stageScores: MARKET_STAGES.map((stage) => {
        const hit = (scores ?? []).find((s) => s.stage === stage)
        return (
          hit ?? {
            survey_id: id,
            stage,
            status: 'unmapped',
            raw_percent: null,
            score: null,
            method: {},
            benchmark: null,
            base_n: null,
          }
        )
      }),
    })
  } catch (err) {
    console.error('[MarketSurvey GET] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const supabase = getSupabaseAdmin()

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof body.title === 'string') update.title = body.title.trim()
    if (typeof body.research_firm === 'string') update.research_firm = body.research_firm.trim()
    if (body.fielded_from !== undefined) update.fielded_from = body.fielded_from || null
    if (body.fielded_to !== undefined) update.fielded_to = body.fielded_to || null
    if (body.sample_size !== undefined) update.sample_size = body.sample_size || null

    if (body.status !== undefined) {
      if (!['draft', 'active', 'archived'].includes(body.status)) {
        return NextResponse.json({ error: 'status が不正です' }, { status: 400 })
      }

      // active にするには5段階のうち3つ以上が決まっている必要がある。
      // 部分的な割り当てのままスコアに反映すると実態とずれる
      if (body.status === 'active') {
        const { data: scores } = await supabase
          .from('market_survey_stage_scores')
          .select('status')
          .eq('survey_id', id)

        const resolved = (scores ?? []).filter((s) => s.status === 'scored').length
        if (resolved < 3) {
          return NextResponse.json(
            {
              error: `スコアを算出できた段階が${resolved}件です。3件以上ないとアウタースコアに反映できません。`,
            },
            { status: 400 }
          )
        }
      }
      update.status = body.status
    }

    const { data, error } = await supabase
      .from('market_surveys')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ survey: data })
  } catch (err) {
    console.error('[MarketSurvey PATCH] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = getSupabaseAdmin()

    // blocks / cells / mappings / scores は FK CASCADE で消える
    const { error } = await supabase.from('market_surveys').delete().eq('id', id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[MarketSurvey DELETE] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
