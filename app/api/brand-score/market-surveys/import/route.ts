// 外部市場調査（GT集計表）の取り込みAPI
// POST /api/brand-score/market-surveys/import
// ============================================================
// multipart/form-data で受け取り、mode で分岐する。
//   mode=preview … シート一覧とパース結果を返すだけ（DB書き込みなし）
//   mode=commit  … 調査・ブロック・セルを新規作成する
//
// インナーの surveys/import と同じ骨格。違いは
//   * シートが複数ある（%表 を選ぶ）
//   * 「どの値がどの指標か」はここでは決めない。取り込み後に人がマッピングする
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminContext } from '@/lib/learning/auth'
import { runAutoMap } from '@/lib/brand-score/market-auto-map-server'
import { defaultStageParams } from '@/lib/brand-score/market-stage-score'
import { listSheetNames, fileSheetToRows } from '@/lib/brand-score/excel-rows'
import {
  parseGtTable,
  pickGtSheet,
  type GtBlock,
  type GtWarning,
} from '@/lib/brand-score/import-gt-table'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
// 1調査で1000セルを超える（実例: 54ブロック1296セル）ため分割して INSERT する
const INSERT_CHUNK_SIZE = 1000

/** プレビューで返すブロックの要約（セル全件は重いので落とす） */
function summarizeBlock(b: GtBlock) {
  return {
    blockKey: b.blockKey,
    questionCode: b.questionCode,
    questionText: b.questionText,
    answerType: b.answerType,
    answerTypeRaw: b.answerTypeRaw,
    blockBaseN: b.blockBaseN,
    columnCount: b.columns?.length ?? 0,
    cellCount: b.cells.length,
    isAttribute: b.isAttribute,
    sourceRow: b.sourceRow,
    warningCount: b.warnings.length,
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminContext()
    if (!admin) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const form = await request.formData()
    const mode = String(form.get('mode') ?? 'preview')
    const file = form.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'ファイルが指定されていません' }, { status: 400 })
    }
    if (file.size === 0) {
      return NextResponse.json({ error: `${file.name} が空です` }, { status: 400 })
    }
    if (!/\.xlsx$/i.test(file.name)) {
      return NextResponse.json(
        { error: `${file.name} は .xlsx ではありません（調査会社のGT集計表を指定してください）` },
        { status: 400 }
      )
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'ファイルサイズは10MB以下にしてください' },
        { status: 400 }
      )
    }

    // シート選択。指定が無ければ %表 を自動で選ぶ
    const sheetNames = await listSheetNames(file)
    const requestedSheet = String(form.get('sheet_name') ?? '').trim()
    const sheetName = requestedSheet || pickGtSheet(sheetNames)

    if (!sheetName) {
      return NextResponse.json(
        {
          error:
            'GT集計表の「%表」シートが見つかりません。取り込めるのは調査会社のGT集計表です。',
          sheetNames,
        },
        { status: 400 }
      )
    }
    if (!sheetNames.includes(sheetName)) {
      return NextResponse.json(
        { error: `シート「${sheetName}」がありません`, sheetNames },
        { status: 400 }
      )
    }

    // パース
    let parsed
    try {
      const rows = await fileSheetToRows(file, sheetName)
      parsed = parseGtTable(sheetName, rows)
    } catch (err) {
      return NextResponse.json(
        {
          error: `${file.name}: ${err instanceof Error ? err.message : 'ファイルを解析できませんでした'}`,
          sheetNames,
        },
        { status: 400 }
      )
    }

    const errors = parsed.warnings.filter((w) => w.severity === 'error')
    const warns = parsed.warnings.filter((w) => w.severity === 'warn')
    const totalCells = parsed.blocks.reduce((s, b) => s + b.cells.length, 0)

    if (mode === 'preview') {
      return NextResponse.json({
        fileName: file.name,
        sheetNames,
        sheetName,
        stats: {
          blockCount: parsed.blocks.length,
          attributeBlockCount: parsed.blocks.filter((b) => b.isAttribute).length,
          cellCount: totalCells,
          errorCount: errors.length,
          warnCount: warns.length,
        },
        blocks: parsed.blocks.map(summarizeBlock),
        warnings: parsed.warnings,
      })
    }

    if (mode !== 'commit') {
      return NextResponse.json({ error: `Unknown mode: ${mode}` }, { status: 400 })
    }

    // ── commit ──────────────────────────────

    // 読めなかった値がある状態で取り込むと、その数字が黙って欠落する
    if (errors.length > 0) {
      return NextResponse.json(
        {
          error: `読み取れない値が${errors.length}件あります。取り込みを中止しました。`,
          details: errors.slice(0, 10).map(
            (w: GtWarning) => `${sheetName} ${w.row ?? '?'}行目 ${w.blockKey}: ${w.detail}`
          ),
        },
        { status: 400 }
      )
    }

    const title = String(form.get('title') ?? '').trim()
    if (!title) {
      return NextResponse.json({ error: '調査名を入力してください' }, { status: 400 })
    }

    const researchFirm = String(form.get('research_firm') ?? '').trim()
    const fieldedFrom = String(form.get('fielded_from') ?? '').trim() || null
    const fieldedTo = String(form.get('fielded_to') ?? '').trim() || null

    const sampleSizeRaw = String(form.get('sample_size') ?? '').trim()
    let sampleSize: number | null = null
    if (sampleSizeRaw) {
      const n = Number(sampleSizeRaw)
      if (!Number.isInteger(n) || n <= 0) {
        return NextResponse.json(
          { error: 'サンプル数は1以上の整数で入力してください' },
          { status: 400 }
        )
      }
      sampleSize = n
    }

    const supabase = getSupabaseAdmin()

    // 1. 調査を作成
    const { data: survey, error: surveyErr } = await supabase
      .from('market_surveys')
      .insert({
        company_id: admin.companyId,
        title,
        research_firm: researchFirm,
        fielded_from: fieldedFrom,
        fielded_to: fieldedTo,
        sample_size: sampleSize,
        source_file_name: file.name,
        source_sheet_name: sheetName,
        status: 'draft',
        // 物差しは取り込み時点の既定値で凍結する。あとで既定値を変えても
        // この調査のスコアは動かない（前年比を壊さないため）
        stage_params: defaultStageParams(),
        parse_warnings: parsed.warnings,
      })
      .select('id')
      .single()

    if (surveyErr || !survey) {
      console.error('[MarketImport] 調査作成エラー:', surveyErr?.message)
      return NextResponse.json(
        { error: surveyErr?.message ?? '調査の作成に失敗しました' },
        { status: 500 }
      )
    }

    // Supabase にトランザクションが無いため、以降の失敗は親を消して巻き戻す
    // （FK の ON DELETE CASCADE で blocks / cells も消える）
    const rollback = async (message: string, detail?: string) => {
      console.error('[MarketImport] ロールバック:', message, detail ?? '')
      await supabase.from('market_surveys').delete().eq('id', survey.id)
      return NextResponse.json({ error: message }, { status: 500 })
    }

    // 2. ブロックを一括作成
    const blockRows = parsed.blocks.map((b) => ({
      survey_id: survey.id,
      block_key: b.blockKey,
      block_index: b.blockIndex,
      question_code: b.questionCode,
      question_text: b.questionText,
      answer_type: b.answerType,
      answer_type_raw: b.answerTypeRaw,
      block_base_n: b.blockBaseN,
      columns: b.columns,
      is_attribute: b.isAttribute,
      source_row: b.sourceRow,
      warnings: b.warnings,
    }))

    const { data: insertedBlocks, error: blockErr } = await supabase
      .from('market_survey_blocks')
      .insert(blockRows)
      .select('id, block_key')

    if (blockErr || !insertedBlocks) {
      return rollback('設問の保存に失敗しました', blockErr?.message)
    }

    const blockIdByKey = new Map<string, string>(
      insertedBlocks.map((b) => [b.block_key as string, b.id as string])
    )

    // 3. セルを展開してチャンク INSERT
    const cellRows: Record<string, unknown>[] = []
    for (const b of parsed.blocks) {
      const blockId = blockIdByKey.get(b.blockKey)
      if (!blockId) {
        return rollback('設問IDの解決に失敗しました', b.blockKey)
      }
      for (const c of b.cells) {
        cellRows.push({
          block_id: blockId,
          row_code: c.rowCode,
          row_label: c.rowLabel,
          row_index: c.rowIndex,
          col_code: c.colCode,
          col_label: c.colLabel,
          col_index: c.colIndex,
          value: c.value,
          value_raw: c.valueRaw,
          base_n: c.baseN,
          kind: c.kind,
          source_row: c.sourceRow,
        })
      }
    }

    for (let i = 0; i < cellRows.length; i += INSERT_CHUNK_SIZE) {
      const chunk = cellRows.slice(i, i + INSERT_CHUNK_SIZE)
      const { error: cellErr } = await supabase.from('market_survey_cells').insert(chunk)
      if (cellErr) {
        return rollback('集計値の保存に失敗しました', cellErr.message)
      }
    }

    // 取り込みに続けて5段階の候補を自動で当てる。
    // 41設問×数十セルを人が当てるのは現実的でないため、ここまで一気にやる。
    // 失敗しても取り込み自体は成功として返す（手動で割り当てられる）
    let autoMap: Awaited<ReturnType<typeof runAutoMap>> | null = null
    try {
      autoMap = await runAutoMap(supabase, survey.id, { apply: true })
    } catch (err) {
      console.error('[MarketImport] 自動割り当てエラー:', err)
    }

    return NextResponse.json({
      surveyId: survey.id,
      blockCount: parsed.blocks.length,
      cellCount: cellRows.length,
      warnCount: warns.length,
      autoMapped: autoMap?.applied.length ?? 0,
      missingStages: autoMap?.missing ?? [],
    })
  } catch (err) {
    console.error('[MarketImport] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
