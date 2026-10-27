// ペルソナビルダー branding.bz連携API
// POST /api/tools/persona/connect
// セッションデータをbrand_personasテーブルに反映
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { mapSessionToPersonaColumns } from '@/lib/tools/persona-mapping'
import {guardCompanyFeature, requireCallerCompany } from '@/lib/billing/guard'
import { syncPersonaRows } from '@/lib/tools/persona-connect'

export async function POST(request: NextRequest) {

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId が必要です' },
        { status: 400 }
      )
    }

    // ⚠️ companyId はクライアントから受け取らない。連携は「ログインしている人が
    //    自分の会社に取り込む」操作で、受け取ると他社の ID を渡すだけでその会社に
    //    書き込めてしまう。UI 側も未ログインならログイン画面へ送っている
    const scope = await requireCallerCompany()
    if (scope.error) return scope.error
    const companyId = scope.companyId


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

    // 既存レコード（sort_order順）に位置で対応づけて sync（update/insert/delete・冪等。空なら触らない）
    const synced = await syncPersonaRows(supabaseAdmin, companyId, personas.map((p, i) => buildValues(p, i)))
    if (synced.error) {
      return NextResponse.json({ error: synced.error }, { status: 500 })
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
