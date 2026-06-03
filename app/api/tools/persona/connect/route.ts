// ペルソナビルダー branding.bz連携API
// POST /api/tools/persona/connect
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
    const demographics = sessionData.demographics || {}
    const goalsData = sessionData.goals || {}
    const journeyData = sessionData.journey_map || {}

    // 2. brand_personas を更新/作成
    const personaData = {
      persona_name: demographics.persona_name || '',
      age: demographics.age || null,
      gender: demographics.gender || '',
      occupation: demographics.occupation || '',
      company_role: demographics.company_role || '',
      company_size: demographics.company_size || '',
      location: demographics.location || '',
      annual_income: demographics.annual_income || '',
      family: demographics.family || '',
      education: demographics.education || '',
      hobbies: demographics.hobbies || [],
      media_channels: demographics.media_channels || [],
      personality_traits: demographics.personality_traits || [],
      daily_routine: demographics.daily_routine || '',
      quote: demographics.quote || '',
      goals: goalsData,
    }

    const journeyMapData = {
      stages: journeyData.stages || [],
    }

    // 既存レコード検索
    const { data: existingPersonas } = await supabaseAdmin
      .from('brand_personas')
      .select('id, sort_order')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true })

    if (existingPersonas && existingPersonas.length > 0) {
      // 最初のレコードを更新
      const firstPersona = existingPersonas[0]
      const { error: updateError } = await supabaseAdmin
        .from('brand_personas')
        .update({
          name: demographics.persona_name || '',
          persona_data: personaData,
          journey_map_data: journeyMapData,
        })
        .eq('id', firstPersona.id)

      if (updateError) {
        console.error('[Persona Connect] 更新エラー:', updateError)
        return NextResponse.json(
          { error: 'ペルソナの更新に失敗しました' },
          { status: 500 }
        )
      }
    } else {
      // 新規作成
      const { error: insertError } = await supabaseAdmin
        .from('brand_personas')
        .insert({
          company_id: companyId,
          name: demographics.persona_name || '',
          sort_order: 0,
          persona_data: personaData,
          journey_map_data: journeyMapData,
        })

      if (insertError) {
        console.error('[Persona Connect] 挿入エラー:', insertError)
        return NextResponse.json(
          { error: 'ペルソナの作成に失敗しました' },
          { status: 500 }
        )
      }
    }

    // 3. セッションを完了に更新
    const { error: completeError } = await supabaseAdmin
      .from('mini_app_sessions')
      .update({
        session_data: { ...sessionData, completed: true },
        status: 'completed',
      })
      .eq('id', sessionId)

    if (completeError) {
      console.error('[Persona Connect] セッション更新エラー:', completeError)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Persona Connect] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
