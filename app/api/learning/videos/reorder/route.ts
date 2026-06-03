// ラーニング動画 並び替えAPI（管理者・service_role 経由）
// PATCH /api/learning/videos/reorder
// body: [{ id, sort_order }]  （{ orders: [...] } 形式も許容）
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminContext } from '@/lib/learning/auth'

type OrderItem = { id: string; sort_order: number }

export async function PATCH(request: NextRequest) {
  try {
    const admin = await getAdminContext()
    if (!admin) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const orders: OrderItem[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.orders)
        ? body.orders
        : []

    if (orders.length === 0) {
      return NextResponse.json({ error: 'orders array is required' }, { status: 400 })
    }
    for (const o of orders) {
      if (!o || typeof o.id !== 'string' || typeof o.sort_order !== 'number') {
        return NextResponse.json(
          { error: '各要素は { id, sort_order } を含む必要があります' },
          { status: 400 }
        )
      }
    }

    const supabase = getSupabaseAdmin()

    // 各動画の sort_order を更新（自社のレコードのみ対象）
    for (const item of orders) {
      const { error } = await supabase
        .from('learning_videos')
        .update({ sort_order: item.sort_order, updated_at: new Date().toISOString() })
        .eq('id', item.id)
        .eq('company_id', admin.companyId)

      if (error) {
        console.error('[Learning Reorder PATCH] UPDATE エラー:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ updated: orders.length })
  } catch (err) {
    console.error('[Learning Reorder PATCH] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
