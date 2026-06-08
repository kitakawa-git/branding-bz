// ラーニング カテゴリー 一覧・作成API（管理者・service_role 経由）
// GET  /api/learning/categories   自社のカテゴリー一覧（sort_order順）
// POST /api/learning/categories   作成 body: { name }
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminContext } from '@/lib/learning/auth'

export async function GET() {
  try {
    const admin = await getAdminContext()
    if (!admin) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('learning_categories')
      .select('*')
      .eq('company_id', admin.companyId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ categories: data ?? [] })
  } catch (err) {
    console.error('[Learning Categories GET] エラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminContext()
    if (!admin) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

    const body = await request.json().catch(() => null)
    const name = body && typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'カテゴリー名を入力してください' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const { data: maxRow } = await supabase
      .from('learning_categories')
      .select('sort_order')
      .eq('company_id', admin.companyId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextSortOrder = (maxRow?.sort_order ?? 0) + 1

    const { data, error } = await supabase
      .from('learning_categories')
      .insert({ company_id: admin.companyId, name, sort_order: nextSortOrder })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ category: data }, { status: 201 })
  } catch (err) {
    console.error('[Learning Categories POST] エラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
