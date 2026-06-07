// バリュー評価シート 詳細取得・更新・削除API
// GET    /api/brand-score/evaluation-sheets/[id]   … シート＋評価項目
// PATCH  /api/brand-score/evaluation-sheets/[id]   … title / status 更新
// DELETE /api/brand-score/evaluation-sheets/[id]   … シート削除（criteria はカスケード）
// ※ 既存 quizzes/[id]/route.ts と同型。認証は getAdminContext、
//   全クエリで company_id をガードする。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminContext } from '@/lib/learning/auth'

type RouteContext = { params: Promise<{ id: string }> }

const ALLOWED_STATUS = ['draft', 'active', 'archived'] as const

// GET: シート詳細（評価項目一覧つき）
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

    const { data: sheet, error: sheetError } = await supabase
      .from('evaluation_sheets')
      .select('*')
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .single()

    if (sheetError) {
      console.error('[EvaluationSheet GET] クエリエラー:', sheetError.message)
      const status = sheetError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json({ error: sheetError.message }, { status })
    }

    const { data: criteria, error: criteriaError } = await supabase
      .from('evaluation_criteria')
      .select('*')
      .eq('sheet_id', id)
      .order('sort_order', { ascending: true })

    if (criteriaError) {
      console.error('[EvaluationSheet GET] criteria クエリエラー:', criteriaError.message)
      return NextResponse.json({ error: criteriaError.message }, { status: 500 })
    }

    return NextResponse.json({ sheet, criteria: criteria ?? [] })
  } catch (err) {
    console.error('[EvaluationSheet GET] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PATCH: シート更新（title / status）
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await getAdminContext()
    if (!ctx) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const { id } = await context.params
    // 空ボディ・中断リクエストでも 500 にしない
    const body = await request.json().catch(() => ({}))

    if (!id) {
      return NextResponse.json({ error: 'Sheet ID is required' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || !body.title.trim()) {
        return NextResponse.json({ error: 'タイトルを入力してください' }, { status: 400 })
      }
      updateData.title = body.title.trim()
    }
    if (body.status !== undefined) {
      if (!ALLOWED_STATUS.includes(body.status)) {
        return NextResponse.json({ error: '不正なステータスです' }, { status: 400 })
      }
      updateData.status = body.status
    }

    const supabase = getSupabaseAdmin()

    const { data: updated, error: updateError } = await supabase
      .from('evaluation_sheets')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .select()
      .single()

    if (updateError) {
      console.error('[EvaluationSheet PATCH] UPDATE エラー:', updateError.message)
      const status = updateError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json({ error: updateError.message }, { status })
    }

    return NextResponse.json({ sheet: updated })
  } catch (err) {
    console.error('[EvaluationSheet PATCH] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE: シート削除（評価項目は ON DELETE CASCADE）
export async function DELETE(_request: NextRequest, context: RouteContext) {
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

    const { error: deleteError } = await supabase
      .from('evaluation_sheets')
      .delete()
      .eq('id', id)
      .eq('company_id', ctx.companyId)

    if (deleteError) {
      console.error('[EvaluationSheet DELETE] DELETE エラー:', deleteError.message)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ deleted: true })
  } catch (err) {
    console.error('[EvaluationSheet DELETE] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
