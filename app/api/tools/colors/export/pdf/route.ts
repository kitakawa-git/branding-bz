// カラーパレット PDF 出力API
// POST /api/tools/colors/export/pdf
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { renderToBuffer } from '@react-pdf/renderer'
import { PalettePdfDocument } from '@/app/tools/colors/app/components/PalettePdfDocument'
import { FREE_LIMITS } from '@/lib/types/color-tool'

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId が必要です' }, { status: 400 })
    }

    // プロジェクトデータ取得
    const { data: project, error: projectError } = await supabaseAdmin
      .from('brand_color_projects')
      .select('*, mini_app_sessions!inner(user_id)')
      .eq('session_id', sessionId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    const palette = project.final_palette || project.current_palette
    if (!palette) {
      return NextResponse.json({ error: 'パレットがありません' }, { status: 400 })
    }

    // PDF生成
    const buffer = await renderToBuffer(
      PalettePdfDocument({
        palette,
        brandName: project.brand_name || 'Brand',
        showWatermark: FREE_LIMITS.pdfWatermark,
      })
    )

    // exported_formats 更新
    const formats = project.exported_formats || []
    if (!formats.includes('pdf')) {
      await supabaseAdmin
        .from('brand_color_projects')
        .update({ exported_formats: [...formats, 'pdf'] })
        .eq('session_id', sessionId)
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${project.brand_name || 'palette'}-colors.pdf"`,
      },
    })
  } catch (err) {
    console.error('[PDF Export] エラー:', err)
    return NextResponse.json(
      { error: `PDF生成エラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
