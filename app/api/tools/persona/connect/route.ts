// ペルソナビルダー branding.bz連携API
// POST /api/tools/persona/connect
// セッションデータをbrand_personasテーブルに反映（複数ペルソナ対応）
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  console.log('[Persona Connect] ===== 連携開始 =====')

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
    const personasData = sessionData.personas as Array<Record<string, unknown>> || []
    const goalsData = sessionData.goals || {}
    const journeyData = sessionData.journey_map || {}
    const isSingle = personasData.length <= 1

    // 既存レコード取得
    const { data: existingPersonas } = await supabaseAdmin
      .from('brand_personas')
      .select('id, sort_order')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true })

    if (personasData.length === 0) {
      // 旧形式互換: demographics がある場合
      const demographics = sessionData.demographics || {}
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
      const journeyMapData = { stages: journeyData.stages || [] }

      if (existingPersonas && existingPersonas.length > 0) {
        await supabaseAdmin.from('brand_personas').update({
          name: demographics.persona_name || '',
          persona_data: personaData,
          journey_map_data: journeyMapData,
        }).eq('id', existingPersonas[0].id)
      } else {
        await supabaseAdmin.from('brand_personas').insert({
          company_id: companyId,
          name: demographics.persona_name || '',
          sort_order: 0,
          persona_data: personaData,
          journey_map_data: journeyMapData,
        })
      }
    } else {
      // 新形式: personas 配列から複数レコードを作成/更新
      for (let i = 0; i < personasData.length; i++) {
        const p = personasData[i]
        const candidateId = p.candidate_id as string
        const pGoals = isSingle ? goalsData : ((goalsData as Record<string, unknown>)[candidateId] || {})
        const pJourney = isSingle
          ? (journeyData.stages ? journeyData : { stages: [] })
          : ((journeyData as Record<string, unknown>)[candidateId] || { stages: [] })

        const personaData = {
          persona_name: p.name || '',
          age: p.age || null,
          gender: p.gender || '',
          occupation: p.occupation || '',
          company_role: p.title || '',
          location: p.location || '',
          annual_income: p.income || '',
          family: p.family || '',
          hobbies: p.hobbies || '',
          info_sources: p.info_sources || '',
          personality: p.personality || '',
          values: p.values || '',
          daily_routine: p.daily_routine || '',
          challenges: p.challenges || '',
          catchcopy: p.catchcopy || '',
          keywords: p.keywords || [],
          goals: pGoals,
        }

        const journeyMapData = (pJourney as Record<string, unknown>).stages
          ? pJourney
          : { stages: [] }

        if (existingPersonas && existingPersonas[i]) {
          // 既存レコードを更新
          const { error: updateError } = await supabaseAdmin
            .from('brand_personas')
            .update({
              name: (p.name as string) || '',
              sort_order: i,
              persona_data: personaData,
              journey_map_data: journeyMapData,
            })
            .eq('id', existingPersonas[i].id)

          if (updateError) {
            console.error(`[Persona Connect] 更新エラー (${i}):`, updateError)
          }
        } else {
          // 新規作成
          const { error: insertError } = await supabaseAdmin
            .from('brand_personas')
            .insert({
              company_id: companyId,
              name: (p.name as string) || '',
              sort_order: i,
              persona_data: personaData,
              journey_map_data: journeyMapData,
            })

          if (insertError) {
            console.error(`[Persona Connect] 挿入エラー (${i}):`, insertError)
          }
        }
      }

      // 余分な既存レコードを削除（ペルソナ数が減った場合）
      if (existingPersonas && existingPersonas.length > personasData.length) {
        const deleteIds = existingPersonas.slice(personasData.length).map(p => p.id)
        if (deleteIds.length > 0) {
          await supabaseAdmin
            .from('brand_personas')
            .delete()
            .in('id', deleteIds)
        }
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

    console.log('[Persona Connect] ===== 連携完了（%d人）=====', personasData.length || 1)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Persona Connect] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
