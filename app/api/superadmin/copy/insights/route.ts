// コピーAI インサイトAPI（superadmin限定・id渡し人間ゲート）
// POST  /api/superadmin/copy/insights  { projectId } → 生成して is_selected=false で全件INSERT・返す
// PATCH /api/superadmin/copy/insights  { projectId, selectedIds[] } → 指定idのみtrue・他false（上書きセット）
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireSuperadmin } from '@/lib/copy/api-auth'
import { generateInsights } from '@/lib/copy/insights'

export async function POST(request: NextRequest) {
  try {
    const guard = await requireSuperadmin(request)
    if (!guard.ok) return guard.res

    const body = await request.json().catch(() => ({}))
    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : ''
    if (!projectId) return NextResponse.json({ error: 'projectId は必須です' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const { data: project, error: pErr } = await supabase
      .from('copy_projects')
      .select('id, company_id, persona_id')
      .eq('id', projectId)
      .maybeSingle()
    if (pErr) return NextResponse.json({ error: 'プロジェクトの取得に失敗しました' }, { status: 500 })
    if (!project) return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })

    const candidates = await generateInsights(project.company_id, project.persona_id ?? undefined)
    if (candidates.length === 0) {
      return NextResponse.json({ insights: [], note: 'pain_points 未登録または接地候補なし' })
    }

    const rows = candidates.map((c) => ({
      project_id: project.id,
      body: c.body,
      psych_type: c.psych_type,
      rationale: c.rationale,
      source_ref: c.source_ref,
      is_selected: false,
    }))
    const { data: inserted, error: insErr } = await supabase.from('copy_insights').insert(rows).select('*')
    if (insErr) {
      console.error('[copy/insights] INSERT エラー:', insErr)
      return NextResponse.json({ error: 'インサイトの保存に失敗しました' }, { status: 500 })
    }
    return NextResponse.json({ insights: inserted })
  } catch (err) {
    console.error('[copy/insights POST] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await requireSuperadmin(request)
    if (!guard.ok) return guard.res

    const body = await request.json().catch(() => ({}))
    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : ''
    const selectedIds: string[] = Array.isArray(body.selectedIds)
      ? body.selectedIds.filter((x: unknown): x is string => typeof x === 'string')
      : []
    if (!projectId) return NextResponse.json({ error: 'projectId は必須です' }, { status: 400 })

    const supabase = getSupabaseAdmin()

    // 当該 project の全インサイトidを取得（selectedIds の所属検証＝他project混入を拒否）
    const { data: rows, error: rErr } = await supabase
      .from('copy_insights')
      .select('id')
      .eq('project_id', projectId)
    if (rErr) return NextResponse.json({ error: 'インサイトの取得に失敗しました' }, { status: 500 })
    const ownIds = new Set((rows ?? []).map((r) => r.id))
    if (ownIds.size === 0) return NextResponse.json({ error: '対象インサイトがありません' }, { status: 404 })

    const foreign = selectedIds.filter((id) => !ownIds.has(id))
    if (foreign.length > 0) {
      return NextResponse.json({ error: '他プロジェクトのインサイトidが含まれています', foreign }, { status: 400 })
    }

    // 上書きセット: まず全false → 指定idをtrue（同projectのみ）
    const { error: clr } = await supabase.from('copy_insights').update({ is_selected: false }).eq('project_id', projectId)
    if (clr) return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
    if (selectedIds.length > 0) {
      const { error: setErr } = await supabase
        .from('copy_insights')
        .update({ is_selected: true })
        .eq('project_id', projectId)
        .in('id', selectedIds)
      if (setErr) return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
    }

    const { data: updated } = await supabase
      .from('copy_insights')
      .select('id, is_selected')
      .eq('project_id', projectId)
    return NextResponse.json({ insights: updated })
  } catch (err) {
    console.error('[copy/insights PATCH] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
