// コピーAI ペルソナ取得API（superadmin限定・読み取り）
// GET /api/superadmin/copy/personas?companyId=...
// brand_personas は RLS が「自社メンバー/管理者のみ閲覧」で superadmin_all を持たないため、
// superadmin の client 直読みは0件になる。service_role(getSupabaseAdmin)でRLSバイパスして返す。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireSuperadmin } from '@/lib/copy/api-auth'

export async function GET(request: NextRequest) {
  try {
    const guard = await requireSuperadmin(request)
    if (!guard.ok) return guard.res

    const companyId = request.nextUrl.searchParams.get('companyId')?.trim() || ''
    if (!companyId) return NextResponse.json({ error: 'companyId は必須です' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('brand_personas')
      .select('id, name, pain_points')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true })
    if (error) {
      console.error('[copy/personas] 取得エラー:', error)
      return NextResponse.json({ error: 'ペルソナの取得に失敗しました' }, { status: 500 })
    }

    const personas = (data ?? []).map((p) => ({
      id: p.id as string,
      name: (p.name as string) ?? '',
      painPointCount: Array.isArray(p.pain_points) ? p.pain_points.length : 0,
    }))
    return NextResponse.json({ personas })
  } catch (err) {
    console.error('[copy/personas] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
