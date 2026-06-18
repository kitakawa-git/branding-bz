// コピーAI 切り口API（superadmin限定・id渡し人間ゲート）
// POST  /api/superadmin/copy/angles  { projectId } → 選択済みインサイトから5型生成・is_selected=false でINSERT・返す
// PATCH /api/superadmin/copy/angles  { projectId, angleId } → 指定1件true・他false（所有検証）
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireSuperadmin } from '@/lib/copy/api-auth'
import { generateAngles } from '@/lib/copy/angles'

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
      .select('id')
      .eq('id', projectId)
      .maybeSingle()
    if (pErr) return NextResponse.json({ error: 'プロジェクトの取得に失敗しました' }, { status: 500 })
    if (!project) return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })

    // 選択済みインサイト（FKアンカー＝先頭）を確定。0件なら400。
    const { data: selInsights } = await supabase
      .from('copy_insights')
      .select('id')
      .eq('project_id', projectId)
      .eq('is_selected', true)
      .order('created_at', { ascending: true })
    const anchorId = (selInsights ?? [])[0]?.id
    if (!anchorId) {
      return NextResponse.json({ error: '選択済みインサイトがありません。先にインサイトを選択してください。' }, { status: 400 })
    }

    const candidates = await generateAngles(projectId)
    if (candidates.length === 0) {
      return NextResponse.json({ error: '切り口の生成に失敗しました' }, { status: 500 })
    }

    const rows = candidates.map((c) => ({
      project_id: projectId,
      insight_id: anchorId, // copy_angles.insight_id は NOT NULL。選択インサイト先頭をアンカーに張る
      angle_type: c.angle_type,
      stance: c.stance,
      premise: c.premise,
      is_selected: false,
    }))
    const { data: inserted, error: insErr } = await supabase.from('copy_angles').insert(rows).select('*')
    if (insErr) {
      console.error('[copy/angles] INSERT エラー:', insErr)
      return NextResponse.json({ error: '切り口の保存に失敗しました' }, { status: 500 })
    }
    return NextResponse.json({ angles: inserted })
  } catch (err) {
    console.error('[copy/angles POST] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await requireSuperadmin(request)
    if (!guard.ok) return guard.res

    const body = await request.json().catch(() => ({}))
    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : ''
    const angleId = typeof body.angleId === 'string' ? body.angleId.trim() : ''
    if (!projectId || !angleId) return NextResponse.json({ error: 'projectId と angleId は必須です' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    // 所有検証: angleId が当該 project の行か
    const { data: target } = await supabase
      .from('copy_angles')
      .select('id')
      .eq('id', angleId)
      .eq('project_id', projectId)
      .maybeSingle()
    if (!target) return NextResponse.json({ error: '指定の切り口が見つかりません（projectとの不一致）' }, { status: 404 })

    const { error: clr } = await supabase.from('copy_angles').update({ is_selected: false }).eq('project_id', projectId)
    if (clr) return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
    const { error: setErr } = await supabase.from('copy_angles').update({ is_selected: true }).eq('id', angleId)
    if (setErr) return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })

    const { data: updated } = await supabase
      .from('copy_angles')
      .select('id, angle_type, is_selected')
      .eq('project_id', projectId)
    return NextResponse.json({ angles: updated })
  } catch (err) {
    console.error('[copy/angles PATCH] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
