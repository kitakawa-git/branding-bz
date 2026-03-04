// brandconnect本体連携API
// POST /api/tools/colors/link
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { PaletteProposal } from '@/lib/types/color-tool'

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId が必要です' }, { status: 400 })
    }

    // セッション＋プロジェクト取得
    const { data: session } = await supabaseAdmin
      .from('mini_app_sessions')
      .select('user_id, company_id')
      .eq('id', sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 })
    }

    if (!session.company_id) {
      return NextResponse.json(
        { error: 'brandconnectアカウントとの連携が必要です。管理画面からアカウントを作成してください。', needsAccount: true },
        { status: 400 }
      )
    }

    const { data: project } = await supabaseAdmin
      .from('brand_color_projects')
      .select('final_palette, current_palette, brand_name')
      .eq('session_id', sessionId)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    const palette: PaletteProposal | null = project.final_palette || project.current_palette
    if (!palette) {
      return NextResponse.json({ error: 'パレットがありません' }, { status: 400 })
    }

    // brand_visuals に連携（upsert）
    const colorPalette = {
      brand_colors: [{ name: palette.primary.name, hex: palette.primary.hex }],
      secondary_colors: palette.secondary.map(s => ({ name: s.name, hex: s.hex })),
      accent_colors: [{ name: palette.accent.name, hex: palette.accent.hex }],
      utility_colors: [
        { name: palette.neutrals.light.name, hex: palette.neutrals.light.hex },
        { name: palette.neutrals.dark.name, hex: palette.neutrals.dark.hex },
      ],
    }

    // 既存の brand_visuals があるかチェック
    const { data: existing } = await supabaseAdmin
      .from('brand_visuals')
      .select('id')
      .eq('company_id', session.company_id)
      .single()

    if (existing) {
      // 更新
      const { error: updateError } = await supabaseAdmin
        .from('brand_visuals')
        .update({
          color_palette: colorPalette,
          color_source: 'mini_app',
          color_source_session_id: sessionId,
        })
        .eq('company_id', session.company_id)

      if (updateError) {
        return NextResponse.json({ error: `連携エラー: ${updateError.message}` }, { status: 500 })
      }
    } else {
      // 新規作成
      const { error: insertError } = await supabaseAdmin
        .from('brand_visuals')
        .insert({
          company_id: session.company_id,
          color_palette: colorPalette,
          color_source: 'mini_app',
          color_source_session_id: sessionId,
        })

      if (insertError) {
        return NextResponse.json({ error: `連携エラー: ${insertError.message}` }, { status: 500 })
      }
    }

    // プロジェクト側を更新
    await supabaseAdmin
      .from('brand_color_projects')
      .update({ linked_to_brandconnect: true })
      .eq('session_id', sessionId)

    // exported_formats 更新
    const { data: proj } = await supabaseAdmin
      .from('brand_color_projects')
      .select('exported_formats')
      .eq('session_id', sessionId)
      .single()

    const formats = proj?.exported_formats || []
    if (!formats.includes('brandconnect')) {
      await supabaseAdmin
        .from('brand_color_projects')
        .update({ exported_formats: [...formats, 'brandconnect'] })
        .eq('session_id', sessionId)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Link] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
