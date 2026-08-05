// 段階への割り当てと段階スコアの再計算
// PUT /api/brand-score/market-surveys/[id]/stages
//
// body: { stage, absent?: boolean, cells?: [{ cellId, subject, competitorName?, weight? }] }
//
// 1段階ぶんの割り当てを丸ごと置き換えて、その段階のスコアを算出し直す。
// absent=true なら割り当てを消して「この調査では未計測」として記録する。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { MARKET_STAGES, type MarketStage } from '@/lib/brand-score/market-stages'
import {
  computeStageScore,
  resolveStageMethod,
  type MappedCell,
} from '@/lib/brand-score/market-stage-score'

type RouteContext = { params: Promise<{ id: string }> }

interface CellAssignment {
  cellId: string
  subject?: 'self' | 'competitor'
  competitorName?: string | null
  weight?: number
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()

    const stage = body.stage as MarketStage
    if (!MARKET_STAGES.includes(stage)) {
      return NextResponse.json({ error: 'stage が不正です' }, { status: 400 })
    }

    const absent = body.absent === true
    const assignments: CellAssignment[] = Array.isArray(body.cells) ? body.cells : []

    const supabase = getSupabaseAdmin()

    const { data: survey, error: surveyErr } = await supabase
      .from('market_surveys')
      .select('id, stage_params')
      .eq('id', id)
      .single()

    if (surveyErr || !survey) {
      return NextResponse.json({ error: '調査が見つかりません' }, { status: 404 })
    }

    // 1. この段階の割り当てを一旦すべて消す（置き換え方式）
    const { error: delErr } = await supabase
      .from('market_survey_stage_mappings')
      .delete()
      .eq('survey_id', id)
      .eq('stage', stage)

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    // 2. absent なら割り当てを持たせず、状態だけ記録して終わり
    if (absent || assignments.length === 0) {
      const method = resolveStageMethod(stage, survey.stage_params)
      const computed = computeStageScore(stage, [], method, absent)

      const { error: upErr } = await supabase.from('market_survey_stage_scores').upsert(
        {
          survey_id: id,
          stage,
          status: computed.status,
          raw_percent: null,
          score: null,
          method,
          benchmark: null,
          base_n: null,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'survey_id,stage' }
      )
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

      return NextResponse.json({ stageScore: computed })
    }

    // 3. 割り当て対象のセルを取得して、この調査のものか検証する
    const cellIds = assignments.map((a) => a.cellId)
    const { data: cellRows, error: cellErr } = await supabase
      .from('market_survey_cells')
      .select('id, value, base_n, row_label, col_label, block_id, market_survey_blocks!inner(survey_id)')
      .in('id', cellIds)

    if (cellErr) {
      return NextResponse.json({ error: cellErr.message }, { status: 500 })
    }

    const cellById = new Map<string, { value: number | null; base_n: number | null }>()
    for (const c of cellRows ?? []) {
      const parent = c.market_survey_blocks as unknown as { survey_id: string }
      if (parent?.survey_id !== id) continue // 他調査のセルは受け付けない
      cellById.set(c.id as string, {
        value: c.value === null ? null : Number(c.value),
        base_n: c.base_n as number | null,
      })
    }

    const missing = cellIds.filter((cid) => !cellById.has(cid))
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `この調査に属さない集計値が${missing.length}件含まれています` },
        { status: 400 }
      )
    }

    // 4. 割り当てを保存
    const rows = assignments.map((a) => ({
      survey_id: id,
      stage,
      cell_id: a.cellId,
      subject: a.subject === 'competitor' ? 'competitor' : 'self',
      competitor_name: a.competitorName ?? null,
      weight: typeof a.weight === 'number' && a.weight > 0 ? a.weight : 1,
    }))

    const { error: insErr } = await supabase
      .from('market_survey_stage_mappings')
      .insert(rows)

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    // 5. スコアを算出して保存
    const method = resolveStageMethod(stage, survey.stage_params)
    const mapped: MappedCell[] = rows.map((r) => {
      const c = cellById.get(r.cell_id)!
      return {
        value: c.value,
        baseN: c.base_n,
        weight: r.weight,
        subject: r.subject as 'self' | 'competitor',
        competitorName: r.competitor_name,
      }
    })

    const computed = computeStageScore(stage, mapped, method)

    const { error: upErr } = await supabase.from('market_survey_stage_scores').upsert(
      {
        survey_id: id,
        stage,
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

    return NextResponse.json({ stageScore: computed })
  } catch (err) {
    console.error('[MarketStages PUT] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
