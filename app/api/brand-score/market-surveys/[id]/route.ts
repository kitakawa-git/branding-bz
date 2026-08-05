// 市場調査の詳細取得・更新・削除
// GET    /api/brand-score/market-surveys/[id]  → 調査 + 設問 + 集計値 + 割り当て + 段階スコア
// PATCH  /api/brand-score/market-surveys/[id]  → メタ情報・status の更新
// DELETE /api/brand-score/market-surveys/[id]
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { fetchAllRows } from '@/lib/brand-score/fetch-all-rows'
import { MARKET_STAGES } from '@/lib/brand-score/market-stages'

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

    return NextResponse.json({
      survey,
      blocks: blocks ?? [],
      cells,
      mappings: mappings ?? [],
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
