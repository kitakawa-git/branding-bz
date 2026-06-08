// ラーニング テーマ 更新・削除API（管理者・service_role 経由）
// PATCH  /api/learning/themes/[id]   body: { name?, description?, sort_order?, category_id? }
// DELETE /api/learning/themes/[id]    配下動画は theme_id=NULL（未分類に戻る・FK ON DELETE SET NULL）
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminContext } from '@/lib/learning/auth'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const admin = await getAdminContext()
    if (!admin) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 })
    }
    const b = body as Record<string, unknown>
    const updates: Record<string, unknown> = {}
    if (typeof b.name === 'string') {
      if (!b.name.trim()) return NextResponse.json({ error: 'テーマ名は空にできません' }, { status: 400 })
      updates.name = b.name.trim()
    }
    if ('description' in b) {
      updates.description = typeof b.description === 'string' ? b.description.trim() || null : null
    }
    if (typeof b.sort_order === 'number') updates.sort_order = Math.round(b.sort_order)

    const supabase = getSupabaseAdmin()

    // カテゴリー移動（任意）。移動先カテゴリが自社のものか確認
    if (typeof b.category_id === 'string' && b.category_id) {
      const { data: cat } = await supabase
        .from('learning_categories')
        .select('id, company_id')
        .eq('id', b.category_id)
        .maybeSingle()
      if (!cat || cat.company_id !== admin.companyId) {
        return NextResponse.json({ error: '移動先カテゴリーが見つかりません' }, { status: 404 })
      }
      updates.category_id = b.category_id
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '更新対象の項目がありません' }, { status: 400 })
    }
    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('learning_themes')
      .update(updates)
      .eq('id', id)
      .eq('company_id', admin.companyId)
      .select()
      .single()

    if (error) {
      const status = error.code === 'PGRST116' ? 404 : 500
      return NextResponse.json(
        { error: status === 404 ? 'テーマが見つかりません' : error.message },
        { status }
      )
    }
    return NextResponse.json({ theme: data })
  } catch (err) {
    console.error('[Learning Theme PATCH] エラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const admin = await getAdminContext()
    if (!admin) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('learning_themes')
      .delete()
      .eq('id', id)
      .eq('company_id', admin.companyId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Learning Theme DELETE] エラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
