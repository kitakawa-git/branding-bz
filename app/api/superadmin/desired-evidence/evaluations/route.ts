// 未来設計 判定/進捗API（superadmin限定・**読み取りのみ**）
// GET /api/superadmin/desired-evidence/evaluations?companyId=...
// lib/brand/future-design の fetch＋evaluate＋resolveEvaluation で各獲得目標の判定を返し、
// vision 単位（requires で辿る）の実証進捗＋判定可能率（§7・§14.6）も返す。DB書き込みなし。
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { fetchEvaluationBundles } from '@/lib/brand/future-design/fetch'
import { resolveEvaluation } from '@/lib/brand/future-design/human-judgment'
import { computeProgress, type ProgressItem } from '@/lib/brand/future-design/progress'
import type { AchievementEvaluation } from '@/lib/brand/future-design/types'

export type DesiredEvidenceEvaluationDto = {
  id: string
  title: string
  importance_weight: number
  execution_state: string
  evaluation: AchievementEvaluation
}

export type VisionProgressDto = {
  vision_id: string
  vision_label: string
  progress_fraction: number | null
  coverage_weight: number
  coverage_count: { evaluable: number; total: number }
}

export async function GET(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId は必須です' }, { status: 400 })
    }

    // superadmin 認証（integrity と同方針: Bearer → getUser → is_superadmin）
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

    // --- 判定（人間判断が0件でも自動評価で動く） ---
    const bundles = await fetchEvaluationBundles(companyId)
    const evaluations: DesiredEvidenceEvaluationDto[] = bundles.map((b) => ({
      id: b.row.id,
      title: b.row.title,
      importance_weight: Number(b.row.importance_weight ?? 1),
      execution_state: b.row.execution_state,
      evaluation: resolveEvaluation(b.de, b.proofs, b.humanJudgment, { currentRuleHash: b.currentRuleHash }),
    }))
    const evalById = new Map(evaluations.map((e) => [e.id, e]))

    // --- vision 単位の進捗（requires: philosophy(vision) → desired_evidence で辿る） ---
    const [{ data: visions }, { data: rels }] = await Promise.all([
      supabaseAdmin
        .from('philosophy_elements')
        .select('id, title, body')
        .eq('company_id', companyId)
        .eq('element_type', 'vision')
        .order('sort_order', { ascending: true }),
      supabaseAdmin
        .from('element_relations')
        .select('source_id, target_id')
        .eq('company_id', companyId)
        .eq('relation_type', 'requires')
        .eq('source_kind', 'philosophy_element')
        .eq('target_kind', 'desired_evidence'),
    ])

    const relations = (rels ?? []) as Array<{ source_id: string; target_id: string }>
    const snippet = (s: string | null) => (s || '').replace(/\s+/g, ' ').trim().slice(0, 40)

    const toItems = (deIds: string[]): ProgressItem[] =>
      deIds
        .map((id) => evalById.get(id))
        .filter((e): e is DesiredEvidenceEvaluationDto => !!e)
        // §7 分母は非cancelled
        .filter((e) => e.execution_state !== 'cancelled')
        .map((e) => ({ weight: e.importance_weight, evaluation: e.evaluation }))

    const visionProgress: VisionProgressDto[] = ((visions ?? []) as Array<{ id: string; title: string | null; body: string | null }>)
      .map((v) => {
        const deIds = relations.filter((r) => r.source_id === v.id).map((r) => r.target_id)
        const res = computeProgress(toItems(deIds))
        return {
          vision_id: v.id,
          vision_label: snippet(v.title || v.body) || 'ビジョン',
          ...res,
        }
      })
      // requires が1本も無いビジョンは表示対象外（未設定の空カードを増やさない）
      .filter((v) => v.coverage_count.total > 0)

    // 会社全体（vision に紐づかない獲得目標も含む・非cancelled）
    const overall = computeProgress(toItems(evaluations.map((e) => e.id)))

    return NextResponse.json({ evaluations, visionProgress, overall })
  } catch (err) {
    console.error('[desired-evidence/evaluations] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
