// ペルソナビルダー branding.bz連携API
// POST /api/tools/persona/connect
// セッションデータをbrand_personasテーブルに反映
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { mapSessionToPersonaColumns } from '@/lib/tools/persona-mapping'
import { guardCompanyFeature } from '@/lib/billing/guard'

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

    // 本体連携は standard 以上
    const denied = await guardCompanyFeature(companyId, 'portalSync')
    if (denied) return denied

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
    // 後方互換: 旧・単一 journey_map（personas[i].journey_map 不在の先頭ペルソナ用フォールバック）
    const legacyJourney = sessionData.journey_map || { stages: [] }

    // マルチペルソナ: personas[] を正とする。無ければ旧 demographics/goals(単一) を1件として後方互換。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const personas: Array<{ target_name?: string; demographics: any; goals: any; journey_map?: any }> =
      Array.isArray(sessionData.personas) && sessionData.personas.length > 0
        ? sessionData.personas
        : sessionData.demographics || sessionData.goals
          ? [{ demographics: sessionData.demographics || {}, goals: sessionData.goals || {} }]
          : []

    // 1ペルソナぶんの書き込み値を作る（rich persona_data ＋ 離散カラム写像）。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buildValues = (p: { target_name?: string; demographics: any; goals: any; journey_map?: any }, i: number) => {
      const demographics = p.demographics || {}
      const goalsData = p.goals || {}
      const personaData = {
        target_name: p.target_name || '', // ターゲット紐づけ（brand_personasのカラム追加はせず persona_data に格納）
        persona_name: demographics.persona_name || '',
        age: demographics.age || null,
        gender: demographics.gender || '',
        occupation: demographics.occupation || '',
        description: demographics.description || '',
        avatar_emoji: demographics.avatar_emoji || '',
        company_role: demographics.company_role || '',
        company_size: demographics.company_size || '',
        media_channels: demographics.media_channels || [],
        personality_traits: demographics.personality_traits || [],
        goals: goalsData,
      }
      // 離散カラム写像（pain_points/needs/age_range/occupation/description）。1ペルソナ分を渡す。
      const mapped = mapSessionToPersonaColumns({ demographics, goals: goalsData })
      // 各ペルソナ自身の journey_map を書く（マルチペルソナ対応）。
      // 後方互換: 先頭ペルソナに journey が無く旧・単一 journey_map がある場合のみフォールバック。
      const journeyMapData = (i === 0 && !(p.journey_map?.stages?.length))
        ? { stages: legacyJourney.stages || [] }
        : { stages: p.journey_map?.stages || [] }
      return {
        name: demographics.persona_name || '',
        sort_order: i,
        avatar_emoji: demographics.avatar_emoji || '', // 離散カラム（管理画面・ポータルが参照）
        persona_data: personaData,
        journey_map_data: journeyMapData,
        ...mapped,
      }
    }

    // 既存レコード（sort_order順）を取得して sync（update/insert/delete・冪等）。
    const { data: existingPersonas } = await supabaseAdmin
      .from('brand_personas')
      .select('id, sort_order')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true })
    const existing = existingPersonas || []
    const N = personas.length

    // 空セッションで既存を全消ししないようガード（書くものが無ければ触らない）。
    if (N > 0) {
      for (let i = 0; i < N; i++) {
        const values = buildValues(personas[i], i)
        if (existing[i]) {
          const { error: upErr } = await supabaseAdmin.from('brand_personas').update(values).eq('id', existing[i].id)
          if (upErr) {
            console.error('[Persona Connect] 更新エラー:', upErr)
            return NextResponse.json({ error: 'ペルソナの更新に失敗しました' }, { status: 500 })
          }
        } else {
          const { error: insErr } = await supabaseAdmin.from('brand_personas').insert({ company_id: companyId, ...values })
          if (insErr) {
            console.error('[Persona Connect] 挿入エラー:', insErr)
            return NextResponse.json({ error: 'ペルソナの作成に失敗しました' }, { status: 500 })
          }
        }
      }
      // 余剰（sort_order >= N）を削除
      if (existing.length > N) {
        const surplusIds = existing.slice(N).map((r) => r.id)
        const { error: delErr } = await supabaseAdmin.from('brand_personas').delete().in('id', surplusIds)
        if (delErr) {
          console.error('[Persona Connect] 余剰削除エラー:', delErr)
          return NextResponse.json({ error: 'ペルソナの整理に失敗しました' }, { status: 500 })
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

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Persona Connect] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
