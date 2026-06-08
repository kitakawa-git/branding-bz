// ラーニング カテゴリー 更新・削除API（管理者・service_role 経由）
// PATCH  /api/learning/categories/[id]   body: { name?, sort_order? }
// DELETE /api/learning/categories/[id]    配下テーマはCASCADE削除、各動画は theme_id=NULL（FK）に戻る
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
      if (!b.name.trim()) return NextResponse.json({ error: 'カテゴリー名は空にできません' }, { status: 400 })
      updates.name = b.name.trim()
    }
    if (typeof b.sort_order === 'number') updates.sort_order = Math.round(b.sort_order)
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '更新対象の項目がありません' }, { status: 400 })
    }
    updates.updated_at = new Date().toISOString()

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('learning_categories')
      .update(updates)
      .eq('id', id)
      .eq('company_id', admin.companyId)
      .select()
      .single()

    if (error) {
      const status = error.code === 'PGRST116' ? 404 : 500
      return NextResponse.json(
        { error: status === 404 ? 'カテゴリーが見つかりません' : error.message },
        { status }
      )
    }
    return NextResponse.json({ category: data })
  } catch (err) {
    console.error('[Learning Category PATCH] エラー:', err)
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
      .from('learning_categories')
      .delete()
      .eq('id', id)
      .eq('company_id', admin.companyId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Learning Category DELETE] エラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
