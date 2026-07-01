// 構築ツール共通 セッション一覧API（履歴選択UI用）
// GET /api/tools/mini-app-sessions?userId=&appType=stp|persona|personality|brand_colors
// 各ツールは mini_app_sessions に行を持つ（colors はラベルを brand_color_projects.brand_name から補完）
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

const ALLOWED_APP_TYPES = ['stp', 'persona', 'personality', 'brand_colors'] as const

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const userId = request.nextUrl.searchParams.get('userId') || ''
    const appType = request.nextUrl.searchParams.get('appType') || ''
    if (!userId) {
      return NextResponse.json({ error: 'userId が必要です' }, { status: 400 })
    }
    if (!ALLOWED_APP_TYPES.includes(appType as typeof ALLOWED_APP_TYPES[number])) {
      return NextResponse.json({ error: 'appType が不正です' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('mini_app_sessions')
      .select('id, status, current_step, session_data, created_at, updated_at')
      .eq('user_id', userId)
      .eq('app_type', appType)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(50)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // colors はラベルを brand_color_projects.brand_name から補完（session_data に企業名を持たないため）
    let nameBySessionId: Record<string, string> = {}
    if (appType === 'brand_colors' && data && data.length > 0) {
      const ids = data.map((s) => s.id)
      const { data: projects } = await supabaseAdmin
        .from('brand_color_projects')
        .select('session_id, brand_name')
        .in('session_id', ids)
      nameBySessionId = Object.fromEntries(
        (projects || []).map((p) => [p.session_id as string, (p.brand_name as string) || ''])
      )
    }

    const sessions = (data || []).map((s) => {
      const sd = (s.session_data || {}) as { basic_info?: { company_name?: string } }
      const name = appType === 'brand_colors'
        ? (nameBySessionId[s.id] || '')
        : (sd.basic_info?.company_name || '')
      return {
        id: s.id,
        status: s.status,
        current_step: s.current_step,
        company_name: name,
        created_at: s.created_at,
        updated_at: s.updated_at,
      }
    })
    return NextResponse.json({ sessions })
  } catch (err) {
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
