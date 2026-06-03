// STP分析ツール branding.bz連携API
// POST /api/tools/stp/connect
// セッションデータをbrand_personasテーブルに反映
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {

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

    // 3. brand_personas の最初のレコードを更新
    //    既存レコードがある場合: sort_order=0 のレコードを更新
    //    ない場合: 新規作成
    const { data: existingPersonas } = await supabaseAdmin
      .from('brand_personas')
      .select('id, sort_order')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true })

    if (existingPersonas && existingPersonas.length > 0) {
      // 最初のレコード（sort_order=0）を更新
      const firstPersona = existingPersonas[0]
      const { error: updateError } = await supabaseAdmin
        .from('brand_personas')
        .update({
          segmentation_data: segmentation,
          target: targeting.target_description || null,
          positioning_map_data: positioningMapData,
        })
        .eq('id', firstPersona.id)

      if (updateError) {
        console.error('[STP Connect] brand_personas更新エラー:', updateError)
        return NextResponse.json(
          { error: 'ブランド戦略の更新に失敗しました' },
          { status: 500 }
        )
      }
    } else {
      // レコードがない場合は新規作成
      const { error: insertError } = await supabaseAdmin
        .from('brand_personas')
        .insert({
          company_id: companyId,
          name: '',
          sort_order: 0,
          segmentation_data: segmentation,
          target: targeting.target_description || null,
          positioning_map_data: positioningMapData,
        })

      if (insertError) {
        console.error('[STP Connect] brand_personas挿入エラー:', insertError)
        return NextResponse.json(
          { error: 'ブランド戦略の作成に失敗しました' },
          { status: 500 }
        )
      }
    }

    // 4. セッションの completed を true に更新
    const { error: completeError } = await supabaseAdmin
      .from('mini_app_sessions')
      .update({
        session_data: { ...sessionData, completed: true },
        status: 'completed',
      })
      .eq('id', sessionId)

    if (completeError) {
      console.error('[STP Connect] セッション更新エラー:', completeError)
      // brand_personasは更新済みなので警告のみ
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[STP Connect] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
