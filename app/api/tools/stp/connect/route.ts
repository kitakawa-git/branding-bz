// STP分析ツール branding.bz連携API
// POST /api/tools/stp/connect
// セッションデータを shared-profile 共通関数経由で brand_personas テーブルに反映
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { updateBrandPersonasSTP } from '@/lib/brand-personas-stp'

export async function POST(request: NextRequest) {
  console.log('[STP Connect] ===== 連携開始 =====')

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { sessionId, companyId } = await request.json()

    if (!sessionId || !companyId) {
      return NextResponse.json(
        { error: 'sessionId と companyId が必要です' },
        { status: 400 }
      )
    }

    // 1. セッションデータ取得
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('mini_app_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      )
    }

    const sessionData = session.session_data
    const targeting = sessionData.targeting || {}
    const positioning = sessionData.positioning || {}
    const segmentation = sessionData.segmentation || {}

    // 2. positioning_map_data を既存の管理画面形式に変換
    //    STPのis_selfフィールド → PositioningMapDataのsizeフィールド
    const positioningMapData = {
      x_axis: positioning.x_axis || { left: '', right: '' },
      y_axis: positioning.y_axis || { bottom: '', top: '' },
      items: (positioning.items || []).map((item: {
        name: string
        color: string
        x: number
        y: number
        is_self: boolean
      }) => ({
        name: item.name,
        color: item.color,
        x: item.x,
        y: item.y,
        size: item.is_self ? 'lg' : 'md',
      })),
    }

    // 3. segmentation_data に targeting 情報も含めて構築
    const segmentationWithTargeting = {
      ...segmentation,
      targeting: {
        main_target: targeting.main_target || null,
        sub_targets: targeting.sub_targets || [],
        target_description: targeting.target_description || null,
        evaluations: targeting.evaluations || [],
      },
    }

    // 4. 共通関数で brand_personas を更新
    const result = await updateBrandPersonasSTP(supabaseAdmin, companyId, {
      segmentation_data: segmentationWithTargeting,
      positioning_map_data: positioningMapData,
      persona_target: targeting.target_description || null,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: 'ブランド戦略の更新に失敗しました' },
        { status: 500 }
      )
    }

    // 5. セッションの completed を true に更新
    const { error: completeError } = await supabaseAdmin
      .from('mini_app_sessions')
      .update({
        session_data: { ...sessionData, completed: true },
        status: 'completed',
      })
      .eq('id', sessionId)

    if (completeError) {
      console.error('[STP Connect] セッション更新エラー:', completeError)
    }

    console.log('[STP Connect] ===== 連携完了 =====')
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[STP Connect] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
