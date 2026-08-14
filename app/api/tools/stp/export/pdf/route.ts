// STP分析レポート PDF出力API
// POST /api/tools/stp/export/pdf
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { renderToBuffer } from '@react-pdf/renderer'
import { StpPdfDocument } from '@/app/tools/stp/app/components/StpPdfDocument'
import { checkConsistency } from '@/lib/stp/consistency-check'
import type { STPSessionData } from '@/app/tools/stp/app/[sessionId]/page'
import { guardCompanyFeature, fetchCompanyIdForSession } from '@/lib/billing/guard'

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId が必要です' }, { status: 400 })
    }

    // PDF 出力は standard 以上。未ログイン・会社なしのセッションは free 相当で弾かれる
    const denied = await guardCompanyFeature(await fetchCompanyIdForSession(sessionId), 'pdfExport')
    if (denied) return denied

    // セッションデータ取得
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('mini_app_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 })
    }

    const sd = session.session_data
    const companyName = sd.basic_info?.company_name || 'STP分析'

    // PDF生成
    const buffer = await renderToBuffer(
      StpPdfDocument({
        data: {
          companyName,
          segmentation: sd.segmentation || { variables: [] },
          targeting: sd.targeting || {
            evaluations: [],
            main_target: '',
            sub_targets: [],
            target_description: '',
          },
          positioning: sd.positioning || {
            x_axis: { left: '', right: '' },
            y_axis: { bottom: '', top: '' },
            items: [],
          },
          targetFitMap: sd.targeting?.target_fit_map || null,
          brandStance: sd.brand_stance_statements?.statements || [],
          consistency: checkConsistency(sd as STPSessionData),
        },
      })
    )

    // ファイル名生成
    const dateStr = new Date().toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).replace(/\//g, '')
    const fileName = `stp-analysis-${companyName}-${dateStr}.pdf`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    })
  } catch (err) {
    console.error('[STP PDF Export] エラー:', err)
    return NextResponse.json(
      { error: `PDF生成エラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
