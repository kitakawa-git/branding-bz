// ラーニング カテゴリー 並び替えAPI（管理者・service_role 経由）
// PATCH /api/learning/categories/reorder  body: [{ id, sort_order }]（{ orders: [...] } 形式も許容）
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminContext } from '@/lib/learning/auth'

type OrderItem = { id: string; sort_order: number }

export async function PATCH(request: NextRequest) {
  try {
    const admin = await getAdminContext()
    if (!admin) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

    const body = await request.json().catch(() => null)
    const orders: OrderItem[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.orders)
        ? body.orders
        : []
    if (orders.length === 0) return NextResponse.json({ error: 'orders array is required' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    for (const item of orders) {
      if (!item || typeof item.id !== 'string' || typeof item.sort_order !== 'number') {
        return NextResponse.json({ error: '各要素は { id, sort_order } を含む必要があります' }, { status: 400 })
      }
      const { error } = await supabase
        .from('learning_categories')
        .update({ sort_order: item.sort_order, updated_at: new Date().toISOString() })
        .eq('id', item.id)
        .eq('company_id', admin.companyId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ updated: orders.length })
  } catch (err) {
    console.error('[Learning Categories Reorder] エラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
