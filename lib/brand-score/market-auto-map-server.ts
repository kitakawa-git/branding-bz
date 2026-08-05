// 自動割り当ての実行（DBアクセスを伴う側）。
// 取り込み直後と、マッピング画面の「候補を自動で割り当てる」の両方から呼ぶ。
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAllRows } from './fetch-all-rows'
import {
  autoMapStages,
  type AutoMapBlock,
  type AutoMapCell,
  type AutoMapResult,
} from './market-auto-map'
import {
  computeStageScore,
  resolveStageMethod,
  type MappedCell,
} from './market-stage-score'
import { extractMarketExtras } from './market-extras'

export interface RunAutoMapResult extends AutoMapResult {
  applied: { stage: string; score: number | null; rawPercent: number | null }[]
}

/**
 * 調査の設問・集計値を読んで5段階の候補を出し、そのまま割り当てて
 * 段階スコアまで算出する。
 *
 * 候補が見つからない段階は「未計測」にせず未割当のまま残す
 * （設問の見落としと、本当に無いことは区別が要る）。
 */
export async function runAutoMap(
  supabase: SupabaseClient,
  surveyId: string,
  opts: { apply: boolean }
): Promise<RunAutoMapResult> {
  const { data: survey, error: sErr } = await supabase
    .from('market_surveys')
    .select('id, company_id, stage_params')
    .eq('id', surveyId)
    .single()

  if (sErr || !survey) throw new Error('調査が見つかりません')

  const { data: company } = await supabase
    .from('companies')
    .select('name, name_ja, name_en')
    .eq('id', survey.company_id)
    .single()

  const companyNames = [company?.name, company?.name_ja, company?.name_en].filter(
    (n): n is string => typeof n === 'string' && n.trim().length >= 2
  )

  const { data: blockRows, error: bErr } = await supabase
    .from('market_survey_blocks')
    .select('id, question_code, question_text, is_attribute, columns')
    .eq('survey_id', surveyId)
    .order('block_index')

  if (bErr) throw new Error(bErr.message)

  const blockIds = (blockRows ?? []).map((b) => b.id as string)
  const empty: RunAutoMapResult = {
    proposals: [],
    missing: [],
    matchedSelfLabels: [],
    applied: [],
  }
  if (blockIds.length === 0 || companyNames.length === 0) return empty

  // セルは1調査で1000行を超える。ページングで全件取る
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

  if (cErr) throw new Error(cErr.message)

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
  if (!opts.apply) return { ...result, applied: [] }

  const cellById = new Map(cells.map((c) => [c.id, c]))
  const applied: RunAutoMapResult['applied'] = []

  for (const p of result.proposals) {
    // 置き換え方式。既存の割り当ては一旦消す
    await supabase
      .from('market_survey_stage_mappings')
      .delete()
      .eq('survey_id', surveyId)
      .eq('stage', p.stage)

    const rows = [
      {
        survey_id: surveyId,
        stage: p.stage,
        cell_id: p.cellId,
        subject: 'self',
        competitor_name: null as string | null,
        weight: 1,
      },
      ...p.competitorCellIds.map((c) => ({
        survey_id: surveyId,
        stage: p.stage,
        cell_id: c.cellId,
        subject: 'competitor',
        competitor_name: c.name as string | null,
        weight: 1,
      })),
    ]

    const { error: insErr } = await supabase
      .from('market_survey_stage_mappings')
      .insert(rows)
    if (insErr) throw new Error(`${p.stage} の割り当てに失敗しました: ${insErr.message}`)

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
        survey_id: surveyId,
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
    if (upErr) throw new Error(upErr.message)

    applied.push({
      stage: p.stage,
      score: computed.score,
      rawPercent: computed.rawPercent,
    })
  }

  // 印象一致度は5段階と別枠。毎回1600件のセルを読み直すのは重いので、
  // 段階スコアと同じくここで計算して調査に保存しておく
  const selfName = result.matchedSelfLabels[0] ?? null
  const extras = extractMarketExtras(
    (blockRows ?? []).map((b) => ({
      id: b.id as string,
      question_code: b.question_code as string | null,
      question_text: b.question_text as string | null,
      is_attribute: b.is_attribute as boolean | null,
    })),
    (cellRows ?? []).map((c) => ({
      block_id: c.block_id,
      row_label: c.row_label,
      col_label: c.col_label,
      value: c.value === null ? null : Number(c.value),
      base_n: c.base_n,
    })),
    selfName
  )

  if (extras.impression) {
    const { matches, hits, misses, overs, score, importanceBaseN, imageBaseN } =
      extras.impression
    await supabase
      .from('market_surveys')
      .update({
        impression_score: score,
        impression_detail: { matches, hits, misses, overs, importanceBaseN, imageBaseN },
      })
      .eq('id', surveyId)
  }

  return { ...result, applied }
}
