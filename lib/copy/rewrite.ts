// コピーAI 自動リライト送還（Stage3）。
//
// red_flag のドラフトを、生成器（generate.ts）に処方箋つきで再パスして書き直す。
// インスペクターはここで本文を書かない（原則②）。新案は parent_draft_id で系譜を張って保存し再レビュー。
// 無限ループ・コスト暴走を防ぐため最大2回。2回で赤旗が消えなければ「人間の手直しが必要」として停止・記録。
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateCopyDraft } from '@/lib/copy/generate'
import { reviewCopyDraft, type CopyReview } from '@/lib/copy/inspector'
import type { CopyOntologyBlocks } from '@/lib/copy/ontology-blocks'
import type { CopyRole, Register } from '@/lib/copy/role-matrix'

export const MAX_REWRITES = 2
const GENERATION_MODEL = 'claude-sonnet-4-6'

export type ReviewRow = { id: string; craft_score: number; brand_fit_score: number; red_flag: boolean }

// copy_quality_reviews へ1件保存（初回レビュー・リライト後レビュー共通）。
export async function saveReview(
  supabase: SupabaseClient,
  draftId: string,
  review: CopyReview,
): Promise<ReviewRow | null> {
  const { data, error } = await supabase
    .from('copy_quality_reviews')
    .insert({
      draft_id: draftId,
      craft_score: review.craftScore,
      brand_fit_score: review.brandFit,
      axis_scores: review.axes,
      red_flag: review.redFlag,
      critique: review.critique,
      suggestions: review.surgicalEdits,
      reviewer_model: review.reviewerModel,
    })
    .select('id, craft_score, brand_fit_score, red_flag')
    .single()
  if (error) {
    console.error('[copy/rewrite] review保存エラー:', error)
    return null
  }
  return data as ReviewRow
}

export type RewriteIteration = {
  iteration: number
  draftId: string
  body: string
  craftScore: number
  brandFit: number
  redFlag: boolean
  review: CopyReview
}

/**
 * 赤旗ドラフトを最大2回リライトする。各リライト案は copy_drafts(parent_draft_id付き)＋copy_quality_reviews に保存。
 * @returns iterations（生成された各リライト案と再レビュー）, stopped（'clean'=赤旗解消 / 'maxed'=2回で未解消）
 */
export async function autoRewrite(params: {
  supabase: SupabaseClient
  project: { id: string; company_id: string; persona_id: string | null; brief: string | null }
  role: CopyRole
  register: Register
  ontology: CopyOntologyBlocks
  competitorNames?: string[]
  current: { draftId: string; body: string; review: CopyReview }
}): Promise<{ iterations: RewriteIteration[]; stopped: 'clean' | 'maxed' }> {
  const { supabase, project, role, register, ontology } = params
  const iterations: RewriteIteration[] = []
  let current = params.current

  for (let i = 1; i <= MAX_REWRITES; i++) {
    if (!current.review.redFlag) break // 既に赤旗が無ければ終了

    // 1) 生成器に処方箋つきで再パス（本文は生成器が書く）
    const gen = await generateCopyDraft({
      companyId: project.company_id,
      role,
      register,
      brief: project.brief ?? undefined,
      personaId: project.persona_id ?? undefined,
      injectOntology: true,
      rewriteDirectives: { priorBody: current.body, edits: current.review.surgicalEdits },
    })
    const newBody = gen.bodies[0] ?? ''

    // 2) 新案を copy_drafts に保存（parent_draft_id で系譜）
    const { data: newDraft, error: dErr } = await supabase
      .from('copy_drafts')
      .insert({
        project_id: project.id,
        copy_role: role,
        register,
        body: newBody,
        status: 'draft',
        parent_draft_id: current.draftId,
        generation_meta: {
          role,
          register,
          model: GENERATION_MODEL,
          pipeline: 'v1-rewrite',
          iteration: i,
          injectedProofIds: gen.injectedProofIds,
          injectOntology: true,
        },
      })
      .select('id')
      .single()
    if (dErr || !newDraft) {
      console.error('[copy/rewrite] draft保存エラー:', dErr)
      break
    }

    // 3) 再レビュー＋保存
    const review = await reviewCopyDraft({ body: newBody, role, ontology, competitorNames: params.competitorNames })
    await saveReview(supabase, newDraft.id, review)

    iterations.push({
      iteration: i,
      draftId: newDraft.id,
      body: newBody,
      craftScore: review.craftScore,
      brandFit: review.brandFit,
      redFlag: review.redFlag,
      review,
    })
    current = { draftId: newDraft.id, body: newBody, review }
    if (!review.redFlag) break
  }

  return { iterations, stopped: current.review.redFlag ? 'maxed' : 'clean' }
}
