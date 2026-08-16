// サーベイ詳細取得・更新・削除API
// GET    /api/brand-score/surveys/[id]
// PATCH  /api/brand-score/surveys/[id]
// DELETE /api/brand-score/surveys/[id]
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireResourceCompany } from '@/lib/billing/guard'

type RouteContext = { params: Promise<{ id: string }> }

// GET: サーベイ詳細（設問 + 回答率付き）
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    // URL のリソース ID から会社を引き、呼び出し元の所属を照合する
    // （generate-questions で確立した形。これが無いと他社の ID で中身が返る）
    const scope = await requireResourceCompany('brand_surveys', id)
    if (scope.error) return scope.error

    if (!id) {
      return NextResponse.json({ error: 'Survey ID is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // サーベイ取得
    const { data: survey, error: surveyError } = await supabase
      .from('brand_surveys')
      .select('*')
      .eq('id', id)
      .single()

    if (surveyError) {
      console.error('[Survey GET] クエリエラー:', surveyError.message)
      const status = surveyError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json({ error: surveyError.message }, { status })
    }

    // 設問取得（sort_order ASC）
    const { data: questions, error: questionsError } = await supabase
      .from('brand_survey_questions')
      .select('*')
      .eq('survey_id', id)
      .order('sort_order', { ascending: true })

    if (questionsError) {
      console.error('[Survey GET] questions クエリエラー:', questionsError.message)
      return NextResponse.json({ error: questionsError.message }, { status: 500 })
    }

    // 回答率計算
    const { data: participants, error: partError } = await supabase
      .from('survey_participants')
      .select('responded_at')
      .eq('survey_id', id)

    if (partError) {
      console.error('[Survey GET] participants クエリエラー:', partError.message)
      return NextResponse.json({ error: partError.message }, { status: 500 })
    }

    // 外部調査の取り込み（source='imported'）は survey_participants を持たないため、
    // 取り込み時に記録した respondent_count を分子として使う。
    const respondedCount = survey.respondent_count ?? (participants ?? []).filter(p => p.responded_at).length
    const responseRate = survey.total_members > 0
      ? Math.round(respondedCount / survey.total_members * 100)
      : 0

    return NextResponse.json({
      survey: {
        ...survey,
        response_rate: responseRate,
        responded_count: respondedCount,
      },
      questions: questions ?? [],
    })
  } catch (err) {
    console.error('[Survey GET] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PATCH: サーベイ更新
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    // URL のリソース ID から会社を引き、呼び出し元の所属を照合する
    // （generate-questions で確立した形。これが無いと他社の ID で中身が返る）
    const scope = await requireResourceCompany('brand_surveys', id)
    if (scope.error) return scope.error
    const body = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Survey ID is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // 現在のサーベイを取得（company_id が必要）
    const { data: currentSurvey, error: fetchError } = await supabase
      .from('brand_surveys')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('[Survey PATCH] 取得エラー:', fetchError.message)
      const status = fetchError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json({ error: fetchError.message }, { status })
    }

    // 更新フィールド組み立て
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.title !== undefined) updateData.title = body.title
    if (body.status !== undefined) updateData.status = body.status
    if (body.starts_at !== undefined) updateData.starts_at = body.starts_at
    if (body.ends_at !== undefined) updateData.ends_at = body.ends_at
    if (body.target_response_rate !== undefined) updateData.target_response_rate = body.target_response_rate

    // status → 'active' への変更時の処理
    if (body.status === 'active' && currentSurvey.status !== 'active') {
      // starts_at 自動セット
      if (!body.starts_at && !currentSurvey.starts_at) {
        updateData.starts_at = new Date().toISOString()
      }

      // total_members 再計算
      const { count: memberCount, error: memberError } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', currentSurvey.company_id)

      if (memberError) {
        console.error('[Survey PATCH] profiles count エラー:', memberError.message)
        return NextResponse.json({ error: memberError.message }, { status: 500 })
      }
      updateData.total_members = memberCount ?? 0

      // survey_participants に対象メンバー全員を登録（ON CONFLICT DO NOTHING）
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id')
        .eq('company_id', currentSurvey.company_id)

      if (profilesError) {
        console.error('[Survey PATCH] profiles取得エラー:', profilesError.message)
        return NextResponse.json({ error: profilesError.message }, { status: 500 })
      }

      if (profiles && profiles.length > 0) {
        const participantRows = profiles.map(p => ({
          survey_id: id,
          profile_id: p.id,
          responded_at: null,
          reminded_at: null,
        }))

        // UPSERT: 既存レコードはスキップ（ON CONFLICT DO NOTHING）
        const { error: upsertError } = await supabase
          .from('survey_participants')
          .upsert(participantRows, {
            onConflict: 'survey_id,profile_id',
            ignoreDuplicates: true,
          })

        if (upsertError) {
          console.error('[Survey PATCH] participants UPSERT エラー:', upsertError.message)
          return NextResponse.json({ error: upsertError.message }, { status: 500 })
        }
      }
    }

    // status → 'closed' への変更時の処理
    if (body.status === 'closed' && currentSurvey.status !== 'closed') {
      if (!body.ends_at && !currentSurvey.ends_at) {
        updateData.ends_at = new Date().toISOString()
      }
    }

    // サーベイ更新
    const { data: updated, error: updateError } = await supabase
      .from('brand_surveys')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('[Survey PATCH] UPDATE エラー:', updateError.message)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ survey: updated })
  } catch (err) {
    console.error('[Survey PATCH] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE: サーベイ削除（draftのみ）
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    // URL のリソース ID から会社を引き、呼び出し元の所属を照合する
    // （generate-questions で確立した形。これが無いと他社の ID で中身が返る）
    const scope = await requireResourceCompany('brand_surveys', id)
    if (scope.error) return scope.error

    if (!id) {
      return NextResponse.json({ error: 'Survey ID is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // 現在のサーベイを取得してステータス確認
    const { data: survey, error: fetchError } = await supabase
      .from('brand_surveys')
      .select('id, status, source')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('[Survey DELETE] 取得エラー:', fetchError.message)
      const status = fetchError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json({ error: fetchError.message }, { status })
    }

    // 取り込み（source='imported'）は外部ファイルの写しなので、closed でも消して入れ直せる。
    // 社内配信ぶんは回答者が提出したデータそのものなので draft 以外は消させない。
    if (survey.status !== 'draft' && survey.source !== 'imported') {
      return NextResponse.json(
        { error: '配信済みのサーベイは削除できません' },
        { status: 400 }
      )
    }

    // 削除（brand_survey_questions は ON DELETE CASCADE で自動削除）
    const { error: deleteError } = await supabase
      .from('brand_surveys')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[Survey DELETE] DELETE エラー:', deleteError.message)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ deleted: true })
  } catch (err) {
    console.error('[Survey DELETE] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
