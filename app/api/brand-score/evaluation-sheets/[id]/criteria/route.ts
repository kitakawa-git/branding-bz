// 評価項目 一覧取得・追加API
// GET  /api/brand-score/evaluation-sheets/[id]/criteria          … 一覧
// POST /api/brand-score/evaluation-sheets/[id]/criteria          … 手動追加（source_type='custom'）
// ※ 認証は getAdminContext。親シートが自社のものであることを必ず確認する。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminContext } from '@/lib/learning/auth'
import { emptyLevels, normalizeLevels } from '@/lib/brand-score/evaluation'

type RouteContext = { params: Promise<{ id: string }> }

// 親シートを取得し、自社のものか検証する（不正 company の id を弾く）
async function loadOwnedSheet(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  sheetId: string,
  companyId: string
) {
  return supabase
    .from('evaluation_sheets')
    .select('id, company_id')
    .eq('id', sheetId)
    .eq('company_id', companyId)
    .single()
}

// GET: 評価項目一覧
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const ctx = await getAdminContext()
    if (!ctx) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: 'Sheet ID is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { error: sheetError } = await loadOwnedSheet(supabase, id, ctx.companyId)
    if (sheetError) {
      const status = sheetError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json({ error: sheetError.message }, { status })
    }

    const { data: criteria, error: criteriaError } = await supabase
      .from('evaluation_criteria')
      .select('*')
      .eq('sheet_id', id)
      .order('sort_order', { ascending: true })

    if (criteriaError) {
      console.error('[Criteria GET] クエリエラー:', criteriaError.message)
      return NextResponse.json({ error: criteriaError.message }, { status: 500 })
    }

    return NextResponse.json({ criteria: criteria ?? [] })
  } catch (err) {
    console.error('[Criteria GET] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST: 評価項目を手動追加（source_type='custom'）
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await getAdminContext()
    if (!ctx) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: 'Sheet ID is required' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))

    const supabase = getSupabaseAdmin()

    const { error: sheetError } = await loadOwnedSheet(supabase, id, ctx.companyId)
    if (sheetError) {
      const status = sheetError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json({ error: sheetError.message }, { status })
    }

    // 既存の最大 sort_order を取得して末尾に追加
    const { data: maxOrderData } = await supabase
      .from('evaluation_criteria')
      .select('sort_order')
      .eq('sheet_id', id)
      .order('sort_order', { ascending: false })
      .limit(1)

    const maxSortOrder =
      maxOrderData && maxOrderData.length > 0 ? (maxOrderData[0].sort_order as number) : -1

    const title =
      typeof body?.title === 'string' && body.title.trim()
        ? body.title.trim()
        : '新しい評価項目'

    const { data: criterion, error: insertError } = await supabase
      .from('evaluation_criteria')
      .insert({
        sheet_id: id,
        company_id: ctx.companyId,
        source_type: 'custom',
        source_id: null,
        title,
        description: typeof body?.description === 'string' ? body.description : null,
        levels: body?.levels ? normalizeLevels(body.levels) : emptyLevels(),
        weight: typeof body?.weight === 'number' ? body.weight : 1,
        sort_order: maxSortOrder + 1,
        is_active: true,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[Criteria POST] INSERT エラー:', insertError.message)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ criterion }, { status: 201 })
  } catch (err) {
    console.error('[Criteria POST] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
