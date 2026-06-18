// コピーAI レビューAPI（superadmin限定・書込）
// POST /api/superadmin/copy/review  { draftId, autoRewrite?:boolean }
//   1. draft→project→company を引き（所有検証）、buildCopyOntologyBlocks で生成時と同じ素材を再取得
//   2. metrics(コード指標)＋inspector(LLM二値＋処方箋・opus)→ score(craft/brand_fit/red_flag)
//   3. copy_quality_reviews に保存
//   4. autoRewrite かつ red_flag なら rewrite.ts を最大2回（各リライトdraft＋reviewも保存）
//   5. レビュー結果（とリライト案）を返す
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { buildCopyOntologyBlocks } from '@/lib/copy/ontology-blocks'
import { reviewCopyDraft } from '@/lib/copy/inspector'
import { autoRewrite, saveReview } from '@/lib/copy/rewrite'
import { COPY_ROLE_MATRIX, type CopyRole, type Register } from '@/lib/copy/role-matrix'

async function requireSuperadmin(request: NextRequest): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, res: NextResponse.json({ error: '認証が必要です。再ログインしてください。' }, { status: 401 }) }
  }
  const token = authHeader.replace('Bearer ', '')
  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
  if (authError || !user) {
    return { ok: false, res: NextResponse.json({ error: '認証エラー: セッションが無効です。' }, { status: 401 }) }
  }
  const supabaseAdmin = getSupabaseAdmin()
  const { data: adminUser } = await supabaseAdmin
    .from('admin_users')
    .select('is_superadmin')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!adminUser?.is_superadmin) {
    return { ok: false, res: NextResponse.json({ error: 'スーパー管理者権限が必要です。' }, { status: 403 }) }
  }
  return { ok: true }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireSuperadmin(request)
    if (!guard.ok) return guard.res

    const body = await request.json().catch(() => ({}))
    const draftId = typeof body.draftId === 'string' ? body.draftId.trim() : ''
    const doRewrite = body.autoRewrite === true
    if (!draftId) return NextResponse.json({ error: 'draftId は必須です' }, { status: 400 })

    const supabase = getSupabaseAdmin()

    // draft → project（所有検証はサーバ側で project を辿って company を確定）
    const { data: draft, error: dErr } = await supabase
      .from('copy_drafts')
      .select('id, project_id, copy_role, register, body')
      .eq('id', draftId)
      .maybeSingle()
    if (dErr) {
      console.error('[copy/review] draft取得エラー:', dErr)
      return NextResponse.json({ error: 'ドラフトの取得に失敗しました' }, { status: 500 })
    }
    if (!draft) return NextResponse.json({ error: 'ドラフトが見つかりません' }, { status: 404 })

    const role = draft.copy_role as CopyRole
    if (!(role in COPY_ROLE_MATRIX)) {
      return NextResponse.json({ error: `draft の copy_role が不正です: ${role}` }, { status: 400 })
    }
    const register = (draft.register as Register) ?? 'neutral'

    const { data: project, error: pErr } = await supabase
      .from('copy_projects')
      .select('id, company_id, persona_id, brief')
      .eq('id', draft.project_id)
      .maybeSingle()
    if (pErr || !project) {
      console.error('[copy/review] project取得エラー:', pErr)
      return NextResponse.json({ error: 'プロジェクトの取得に失敗しました' }, { status: 500 })
    }

    // 生成時と同じ素材（FACT/INTENT/persona/quotablePhrases/bannedTerms）を再取得
    const ontology = await buildCopyOntologyBlocks(project.company_id, project.persona_id ?? undefined)

    // 批評（コード指標＋LLM二値）→ 合成スコア
    const review = await reviewCopyDraft({ body: draft.body, role, ontology })
    const reviewRow = await saveReview(supabase, draft.id, review)

    // 自動リライト送還（赤旗時のみ・最大2回）
    let rewrite: Awaited<ReturnType<typeof autoRewrite>> | null = null
    if (doRewrite && review.redFlag) {
      rewrite = await autoRewrite({
        supabase,
        project,
        role,
        register,
        ontology,
        current: { draftId: draft.id, body: draft.body, review },
      })
    }

    return NextResponse.json({
      reviewId: reviewRow?.id ?? null,
      review: {
        craftScore: review.craftScore,
        brandFit: review.brandFit,
        redFlag: review.redFlag,
        axes: review.axes,
        critique: review.critique,
        surgicalEdits: review.surgicalEdits,
        reviewerModel: review.reviewerModel,
        code: review.code,
      },
      rewrite: rewrite
        ? {
            stopped: rewrite.stopped,
            iterations: rewrite.iterations.map((it) => ({
              iteration: it.iteration,
              draftId: it.draftId,
              body: it.body,
              craftScore: it.craftScore,
              brandFit: it.brandFit,
              redFlag: it.redFlag,
            })),
          }
        : null,
    })
  } catch (err) {
    console.error('[copy/review] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
