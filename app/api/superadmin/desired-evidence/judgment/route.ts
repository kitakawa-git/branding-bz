// 未来設計 §6 人間判断の記録／クリア（superadmin限定）
// POST /api/superadmin/desired-evidence/judgment
//   - 記録 : {companyId, desiredEvidenceId, evaluationSource, achievementState, progressFraction, reason}
//   - クリア: {companyId, desiredEvidenceId, action:'clear'}  ＝ 現行判断を降ろして自動評価へ戻す
// rule_hash / evidence_version_at_eval は BEFORE INSERT トリガ（dee_fill_snapshot）がDB側で付与する（§14.2）。
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

type AchievementState = 'unmet' | 'partially_met' | 'met'
type EvaluationSource = 'manual_review' | 'automatic_override'

/** §6-4 状態と進捗率の整合（DB側 dee_state_progress_consistent と同じ規則をAPIでも先に弾く） */
function checkStateProgress(state: AchievementState, p: number | null): string | null {
  if (p === null) return null
  if (!Number.isFinite(p) || p < 0 || p > 1) return '進捗率は0〜1の範囲で指定してください'
  if (state === 'met' && p !== 1) return '「達成」の進捗率は 1 または未指定にしてください'
  if (state === 'unmet' && p !== 0) return '「未達」の進捗率は 0 または未指定にしてください'
  if (state === 'partially_met' && !(p > 0 && p < 1)) return '「一部達成」の進捗率は 0 より大きく 1 未満にしてください'
  return null
}

export async function POST(request: NextRequest) {
  try {
    // --- superadmin 認証（integrity route 踏襲） ---
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証が必要です。再ログインしてください。' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '')
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '認証エラー: セッションが無効です。' }, { status: 401 })
    }
    const supabaseAdmin = getSupabaseAdmin()
    const { data: adminUser } = await supabaseAdmin
      .from('admin_users')
      .select('is_superadmin')
      .eq('auth_id', user.id)
      .maybeSingle()
    if (!adminUser?.is_superadmin) {
      return NextResponse.json({ error: 'スーパー管理者権限が必要です。' }, { status: 403 })
    }

    const body = await request.json()
    const companyId: string = body?.companyId
    const desiredEvidenceId: string = body?.desiredEvidenceId
    if (!companyId || !desiredEvidenceId) {
      return NextResponse.json({ error: 'companyId と desiredEvidenceId は必須です' }, { status: 400 })
    }

    // 対象 DE が指定企業のものであることを確認（company跨ぎの書き込みを防ぐ）
    const { data: de } = await supabaseAdmin
      .from('desired_evidence')
      .select('id')
      .eq('id', desiredEvidenceId)
      .eq('company_id', companyId)
      .maybeSingle()
    if (!de) {
      return NextResponse.json({ error: '対象の獲得目標が見つかりません' }, { status: 404 })
    }

    // --- クリア（自動評価に戻す） ---
    if (body?.action === 'clear') {
      const { error } = await supabaseAdmin
        .from('desired_evidence_evaluations')
        .update({ is_current: false, superseded_at: new Date().toISOString() })
        .eq('company_id', companyId)
        .eq('desired_evidence_id', desiredEvidenceId)
        .eq('is_current', true)
      if (error) throw error
      return NextResponse.json({ ok: true, cleared: true })
    }

    // --- 記録 ---
    const evaluationSource: EvaluationSource = body?.evaluationSource
    const achievementState: AchievementState = body?.achievementState
    const reason: string = typeof body?.reason === 'string' ? body.reason.trim() : ''
    const rawProgress = body?.progressFraction
    const progressFraction: number | null =
      rawProgress === null || rawProgress === undefined || rawProgress === '' ? null : Number(rawProgress)

    if (evaluationSource !== 'manual_review' && evaluationSource !== 'automatic_override') {
      return NextResponse.json({ error: 'evaluationSource が不正です' }, { status: 400 })
    }
    if (!['unmet', 'partially_met', 'met'].includes(achievementState)) {
      return NextResponse.json({ error: 'achievementState が不正です' }, { status: 400 })
    }
    if (!reason) {
      return NextResponse.json({ error: '判断の理由は必須です' }, { status: 400 })
    }
    const consistencyError = checkStateProgress(achievementState, progressFraction)
    if (consistencyError) {
      return NextResponse.json({ error: consistencyError }, { status: 400 })
    }

    // 現行を降ろしてから新しい判断を積む（update → insert の順で逐次）
    const { error: supersedeError } = await supabaseAdmin
      .from('desired_evidence_evaluations')
      .update({ is_current: false, superseded_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .eq('desired_evidence_id', desiredEvidenceId)
      .eq('is_current', true)
    if (supersedeError) throw supersedeError

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('desired_evidence_evaluations')
      .insert({
        company_id: companyId,
        desired_evidence_id: desiredEvidenceId,
        evaluation_source: evaluationSource,
        achievement_state: achievementState,
        progress_fraction: progressFraction,
        reason,
        evaluated_by: user.id,
        is_current: true,
      })
      .select('id, evaluated_at, rule_hash, evidence_version_at_eval')
      .single()
    if (insertError) throw insertError

    return NextResponse.json({ ok: true, judgment: inserted })
  } catch (err) {
    console.error('[desired-evidence/judgment] エラー:', err)
    const message = err instanceof Error ? err.message : 'サーバーエラーが発生しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
