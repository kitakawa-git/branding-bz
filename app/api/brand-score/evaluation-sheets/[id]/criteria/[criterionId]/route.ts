// 評価項目 更新・削除API
// PATCH  /api/brand-score/evaluation-sheets/[id]/criteria/[criterionId]
// DELETE /api/brand-score/evaluation-sheets/[id]/criteria/[criterionId]
// ※ 認証は getAdminContext。company_id / sheet_id でガードする。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminContext } from '@/lib/learning/auth'
import { normalizeLevels } from '@/lib/brand-score/evaluation'

type RouteContext = { params: Promise<{ id: string; criterionId: string }> }

// PATCH: 評価項目更新（title / description / levels / weight / sort_order / is_active）
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await getAdminContext()
    if (!ctx) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const { id, criterionId } = await context.params
    // 空ボディ・中断リクエストでも 500 にしない（保存中のリロード等で起こり得る）
    const body = await request.json().catch(() => ({}))

    if (!id || !criterionId) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || !body.title.trim()) {
        return NextResponse.json({ error: '評価項目名を入力してください' }, { status: 400 })
      }
      updateData.title = body.title.trim()
    }
    if (body.description !== undefined) {
      updateData.description =
        typeof body.description === 'string' ? body.description : null
    }
    if (body.levels !== undefined) {
      // 常に level 1..5 の5要素に正規化して保存
      updateData.levels = normalizeLevels(body.levels)
    }
    if (body.weight !== undefined) {
      const w = Number(body.weight)
      updateData.weight = Number.isFinite(w) ? w : 1
    }
    if (body.sort_order !== undefined) {
      const s = Number(body.sort_order)
      if (Number.isFinite(s)) updateData.sort_order = Math.floor(s)
    }
    if (body.is_active !== undefined) {
      updateData.is_active = !!body.is_active
    }

    const supabase = getSupabaseAdmin()

    const { data: updated, error: updateError } = await supabase
      .from('evaluation_criteria')
      .update(updateData)
      .eq('id', criterionId)
      .eq('sheet_id', id)
      .eq('company_id', ctx.companyId)
      .select()
      .single()

    if (updateError) {
      console.error('[Criterion PATCH] UPDATE エラー:', updateError.message)
      const status = updateError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json({ error: updateError.message }, { status })
    }

    return NextResponse.json({ criterion: updated })
  } catch (err) {
    console.error('[Criterion PATCH] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE: 評価項目削除
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const ctx = await getAdminContext()
    if (!ctx) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const { id, criterionId } = await context.params
    if (!id || !criterionId) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { error: deleteError } = await supabase
      .from('evaluation_criteria')
      .delete()
      .eq('id', criterionId)
      .eq('sheet_id', id)
      .eq('company_id', ctx.companyId)

    if (deleteError) {
      console.error('[Criterion DELETE] DELETE エラー:', deleteError.message)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ deleted: true })
  } catch (err) {
    console.error('[Criterion DELETE] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
