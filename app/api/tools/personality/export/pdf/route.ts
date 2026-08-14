// ブランドパーソナリティ診断レポート PDF出力API
// POST /api/tools/personality/export/pdf
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { renderToBuffer } from '@react-pdf/renderer'
import { PersonalityPdfDocument } from '@/app/tools/personality/app/components/PersonalityPdfDocument'
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
      .eq('app_type', 'personality')
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 })
    }

    const sd = session.session_data || {}
    const diagnosis = sd.diagnosis
    if (!diagnosis || !Array.isArray(diagnosis.aaker_scores)) {
      return NextResponse.json({ error: '診断結果がありません。AI診断を実行してください。' }, { status: 400 })
    }

    const companyName = sd.basic_info?.company_name || 'ブランドパーソナリティ診断'
    const framework = sd.framework === 'archetype' ? 'archetype' : 'aaker'
    const generatedDate = new Date().toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })

    // PDF生成
    const buffer = await renderToBuffer(
      PersonalityPdfDocument({
        data: { companyName, framework, diagnosis, generatedDate },
      })
    )

    const dateStr = generatedDate.replace(/\//g, '')
    const fileName = `personality-${companyName}-${dateStr}.pdf`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    })
  } catch (err) {
    console.error('[Personality PDF Export] エラー:', err)
    return NextResponse.json(
      { error: `PDF生成エラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
