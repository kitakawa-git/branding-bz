// ラーニング テーマ 一覧・作成API（管理者・service_role 経由）
// GET  /api/learning/themes?category_id=xxx   テーマ一覧（category_id 指定で絞り込み）
// POST /api/learning/themes                    作成 body: { category_id, name, description? }
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminContext } from '@/lib/learning/auth'

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminContext()
    if (!admin) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('category_id')

    const supabase = getSupabaseAdmin()
    let query = supabase
      .from('learning_themes')
      .select('*')
      .eq('company_id', admin.companyId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (categoryId) query = query.eq('category_id', categoryId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ themes: data ?? [] })
  } catch (err) {
    console.error('[Learning Themes GET] エラー:', err)
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
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 })
    }
    const b = body as Record<string, unknown>
    const categoryId = typeof b.category_id === 'string' ? b.category_id : ''
    const name = typeof b.name === 'string' ? b.name.trim() : ''
    if (!categoryId) return NextResponse.json({ error: 'category_id is required' }, { status: 400 })
    if (!name) return NextResponse.json({ error: 'テーマ名を入力してください' }, { status: 400 })

    const supabase = getSupabaseAdmin()

    // カテゴリーが自社のものか確認（他社カテゴリ配下に作らせない）
    const { data: cat } = await supabase
      .from('learning_categories')
      .select('id, company_id')
      .eq('id', categoryId)
      .maybeSingle()
    if (!cat || cat.company_id !== admin.companyId) {
      return NextResponse.json({ error: 'カテゴリーが見つかりません' }, { status: 404 })
    }

    const { data: maxRow } = await supabase
      .from('learning_themes')
      .select('sort_order')
      .eq('category_id', categoryId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextSortOrder = (maxRow?.sort_order ?? 0) + 1

    const { data, error } = await supabase
      .from('learning_themes')
      .insert({
        company_id: admin.companyId,
        category_id: categoryId,
        name,
        description: typeof b.description === 'string' ? b.description.trim() || null : null,
        sort_order: nextSortOrder,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ theme: data }, { status: 201 })
  } catch (err) {
    console.error('[Learning Themes POST] エラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
