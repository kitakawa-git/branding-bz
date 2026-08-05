// 5段階への候補の自動割り当て
// POST /api/brand-score/market-surveys/[id]/auto-map
//   body: { apply?: boolean }
//     apply=false（既定） … 候補を返すだけ
//     apply=true          … 候補をそのまま割り当てて段階スコアまで算出する
//
// 41設問×数十セルを人が全部当てるのは現実的でないので機械的に候補を出す。
// 見つからない段階は勝手に「未計測」にせず missing として返す。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { fetchAllRows } from '@/lib/brand-score/fetch-all-rows'
import {
  autoMapStages,
  type AutoMapBlock,
  type AutoMapCell,
} from '@/lib/brand-score/market-auto-map'
import {
  computeStageScore,
  resolveStageMethod,
  type MappedCell,
} from '@/lib/brand-score/market-stage-score'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const apply = body?.apply === true

    const supabase = getSupabaseAdmin()

    const { data: survey, error: sErr } = await supabase
      .from('market_surveys')
      .select('id, company_id, stage_params')
      .eq('id', id)
      .single()

    if (sErr || !survey) {
      return NextResponse.json({ error: '調査が見つかりません' }, { status: 404 })
    }

    // 自社名（表記ゆれの吸収は autoMapStages 側でやる）
    const { data: company } = await supabase
      .from('companies')
      .select('name, name_ja, name_en')
      .eq('id', survey.company_id)
      .single()

    const companyNames = [company?.name, company?.name_ja, company?.name_en].filter(
      (n): n is string => typeof n === 'string' && n.trim().length >= 2
    )
    if (companyNames.length === 0) {
      return NextResponse.json(
        { error: '会社名が登録されていないため、自社の行を特定できません' },
        { status: 400 }
      )
    }

    const { data: blockRows, error: bErr } = await supabase
      .from('market_survey_blocks')
      .select('id, question_code, question_text, is_attribute, columns')
      .eq('survey_id', id)
      .order('block_index')

    if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 })

    const blockIds = (blockRows ?? []).map((b) => b.id as string)
    if (blockIds.length === 0) {
      return NextResponse.json({ error: '設問が取り込まれていません' }, { status: 400 })
    }

    // セルは1000行を超えるのでページングで全件取る
    const { data: cellRows, error: cErr } = await fetchAllRows<{
      id: string
      block_id: string
      row_label: string
      col_label: string | null
      value: number | null
      base_n: number | null
      kind: string
    }>(() =>
      supabase
        .from('market_survey_cells')
        .select('id, block_id, row_label, col_label, value, base_n, kind')
        .in('block_id', blockIds)
        .order('id')
    )

    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })

    const blocks: AutoMapBlock[] = (blockRows ?? []).map((b) => ({
      id: b.id as string,
      questionCode: b.question_code as string,
      questionText: b.question_text as string,
      isAttribute: b.is_attribute as boolean,
      columns: b.columns as { code: string | null; label: string }[] | null,
    }))

    const cells: AutoMapCell[] = (cellRows ?? []).map((c) => ({
      id: c.id,
      blockId: c.block_id,
      rowLabel: c.row_label,
      colLabel: c.col_label,
      value: c.value === null ? null : Number(c.value),
      baseN: c.base_n,
      kind: c.kind,
    }))

    const result = autoMapStages(blocks, cells, companyNames)

    if (!apply) {
      return NextResponse.json(result)
    }

    // ── 候補をそのまま割り当てる ──
    const cellById = new Map(cells.map((c) => [c.id, c]))
    const applied: { stage: string; score: number | null; rawPercent: number | null }[] = []

    for (const p of result.proposals) {
      // 置き換え方式。既存の割り当ては一旦消す
      await supabase
        .from('market_survey_stage_mappings')
        .delete()
        .eq('survey_id', id)
        .eq('stage', p.stage)

      const rows = [
        { survey_id: id, stage: p.stage, cell_id: p.cellId, subject: 'self', competitor_name: null, weight: 1 },
        ...p.competitorCellIds.map((c) => ({
          survey_id: id,
          stage: p.stage,
          cell_id: c.cellId,
          subject: 'competitor',
          competitor_name: c.name,
          weight: 1,
        })),
      ]

      const { error: insErr } = await supabase
        .from('market_survey_stage_mappings')
        .insert(rows)
      if (insErr) {
        return NextResponse.json(
          { error: `${p.stage} の割り当てに失敗しました: ${insErr.message}` },
          { status: 500 }
        )
      }

      const method = resolveStageMethod(p.stage, survey.stage_params)
      const mapped: MappedCell[] = rows.map((r) => {
        const c = cellById.get(r.cell_id)!
        return {
          value: c.value,
          baseN: c.baseN,
          weight: 1,
          subject: r.subject as 'self' | 'competitor',
          competitorName: r.competitor_name,
        }
      })

      const computed = computeStageScore(p.stage, mapped, method)

      const { error: upErr } = await supabase.from('market_survey_stage_scores').upsert(
        {
          survey_id: id,
          stage: p.stage,
          status: computed.status,
          raw_percent: computed.rawPercent,
          score: computed.score,
          method: computed.method,
          benchmark: computed.benchmark,
          base_n: computed.baseN,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'survey_id,stage' }
      )
      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 })
      }

      applied.push({
        stage: p.stage,
        score: computed.score,
        rawPercent: computed.rawPercent,
      })
    }

    return NextResponse.json({ ...result, applied })
  } catch (err) {
    console.error('[MarketAutoMap] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
