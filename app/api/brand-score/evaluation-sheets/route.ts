// バリュー評価シート 一覧取得・新規作成API
// GET  /api/brand-score/evaluation-sheets
// POST /api/brand-score/evaluation-sheets
// ============================================================
// 既存 brand-score/quizzes/route.ts と同型。ただし認証は getAdminContext
// （セッション由来の company_id）を使用し、クライアントから渡される
// company_id は信用しない。実アクセスは service_role（getSupabaseAdmin）。
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminContext } from '@/lib/learning/auth'
import { emptyLevels } from '@/lib/brand-score/evaluation'

// GET: 評価シート一覧（評価項目数つき）
export async function GET() {
  try {
    const ctx = await getAdminContext()
    if (!ctx) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const supabase = getSupabaseAdmin()

    const { data: sheets, error: sheetsError } = await supabase
      .from('evaluation_sheets')
      .select('*')
      .eq('company_id', ctx.companyId)
      .order('created_at', { ascending: false })

    if (sheetsError) {
      console.error('[EvaluationSheets GET] クエリエラー:', sheetsError.message)
      return NextResponse.json({ error: sheetsError.message }, { status: 500 })
    }

    if (!sheets || sheets.length === 0) {
      return NextResponse.json({ sheets: [] })
    }

    const sheetIds = sheets.map((s) => s.id)

    // 評価項目数（sheet_id ごと）
    const { data: criteria, error: criteriaError } = await supabase
      .from('evaluation_criteria')
      .select('sheet_id')
      .in('sheet_id', sheetIds)

    if (criteriaError) {
      console.error('[EvaluationSheets GET] criteria クエリエラー:', criteriaError.message)
      return NextResponse.json({ error: criteriaError.message }, { status: 500 })
    }

    const criteriaCountMap = new Map<string, number>()
    for (const c of criteria ?? []) {
      criteriaCountMap.set(c.sheet_id, (criteriaCountMap.get(c.sheet_id) || 0) + 1)
    }

    const sheetsWithCounts = sheets.map((s) => ({
      ...s,
      criteria_count: criteriaCountMap.get(s.id) || 0,
    }))

    return NextResponse.json({ sheets: sheetsWithCounts })
  } catch (err) {
    console.error('[EvaluationSheets GET] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST: 評価シート新規作成（status=draft）＋ バリューから評価項目を初期生成
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAdminContext()
    if (!ctx) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const title =
      typeof body?.title === 'string' && body.title.trim()
        ? body.title.trim()
        : 'バリュー評価シート'

    const supabase = getSupabaseAdmin()

    // 1. 評価シート作成
    const { data: sheet, error: sheetError } = await supabase
      .from('evaluation_sheets')
      .insert({
        company_id: ctx.companyId,
        title,
        status: 'draft',
        created_by: ctx.authId,
      })
      .select()
      .single()

    if (sheetError || !sheet) {
      console.error('[EvaluationSheets POST] シート作成エラー:', sheetError?.message)
      return NextResponse.json(
        { error: sheetError?.message || 'シートの作成に失敗しました' },
        { status: 500 }
      )
    }

    // 2. ブランド方針（/admin/brand/guidelines）のバリュー＝行動規範を取得して評価項目を初期生成
    //    ※ 保存先は brand_guidelines.values（jsonb配列）。
    //      評価軸（行動評価）の起点は「社員がどう振る舞うか＝行動規範のバリュー」であり、
    //      提供価値（brand_values／顧客起点）は評価軸の起点にしない。
    //      新規企業は brand_guidelines 行が未作成のため maybeSingle（0件でもエラーにしない）。
    //    ※ バリュー名のキーは実データに新形式 name と旧形式 value が混在しているため両対応する
    //      （guidelines編集画面の現行型は name だが、未移行の既存データは value を使う）。
    const { data: guidelines, error: guidelinesError } = await supabase
      .from('brand_guidelines')
      .select('values')
      .eq('company_id', ctx.companyId)
      .maybeSingle()

    if (guidelinesError) {
      // バリュー取得失敗はシート作成自体を巻き戻さない（項目0件として続行）
      console.error('[EvaluationSheets POST] ブランド方針バリュー取得エラー:', guidelinesError.message)
    }

    // バリュー名を name（新）→ value（旧）の順に解決する
    const valueName = (v: Record<string, unknown>): string => {
      const n = typeof v.name === 'string' ? v.name.trim() : ''
      if (n) return n
      return typeof v.value === 'string' ? v.value.trim() : ''
    }

    // jsonb 配列を安全に正規化（名前が空の要素は除外。並び順は配列順を踏襲）
    const rawValues = Array.isArray(guidelines?.values) ? guidelines.values : []
    const valueRows = rawValues
      .map((v) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {}))
      .filter((v) => valueName(v) !== '')

    let criteriaCount = 0
    if (valueRows.length > 0) {
      const rows = valueRows.map((v, i) => ({
        sheet_id: sheet.id,
        company_id: ctx.companyId,
        source_type: 'value' as const,
        // ブランド方針のバリューは配列要素でID概念が無いため null（sort_order で対応関係を保つ）
        source_id: null,
        title: valueName(v),
        description: typeof v.description === 'string' ? v.description : null,
        levels: emptyLevels(),
        weight: 1,
        sort_order: i,
        is_active: true,
      }))

      const { error: insertError } = await supabase
        .from('evaluation_criteria')
        .insert(rows)

      if (insertError) {
        console.error('[EvaluationSheets POST] 評価項目INSERTエラー:', insertError.message)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
      criteriaCount = rows.length
    }

    return NextResponse.json({ sheet, criteria_count: criteriaCount }, { status: 201 })
  } catch (err) {
    console.error('[EvaluationSheets POST] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
