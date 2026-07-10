// 表現ルール（governance_rules の rule_type='tone_rule'）CRUD API
// governance_rules の SELECT は RLS で管理者のみ・書き込みは superadmin のみのため、
// ポータル表示（メンバー）と管理画面CRUD（管理者）はこの API（service role）経由で行う。
//
// - GET    : 自社の tone_rule 一覧（管理者 or ポータルメンバー）。管理者には element_relations のエッジ数も返す
// - PUT    : 一括保存（管理者のみ）。id ありは UPDATE、id なしは INSERT（rule_type='tone_rule'・scope='global' 固定・sort_order 末尾連番）
// - DELETE : 1件削除（管理者のみ）。element_relations の該当エッジ（source/target いずれか）を同時削除（ダングリング防止）
//
// 対象は rule_type='tone_rule' のみ。claim_rule / compliance_rule / banned_word はオントロジー側の管轄のため触れない。
// governance_rules のスキーマ変更は禁止（行の CRUD のみ）。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminContext, getMemberContext } from '@/lib/learning/auth'

const SEVERITIES = new Set(['info', 'warn', 'block'])

interface ToneRuleInput {
  id?: string
  rule_text?: string
  ng_example?: string
  ok_example?: string
  severity?: string
}

// 会社の tone_rule に張られた element_relations エッジを ruleId ごとに数える
async function countEdgesByRule(companyId: string): Promise<Map<string, number>> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data } = await supabaseAdmin
    .from('element_relations')
    .select('source_kind, source_id, target_kind, target_id')
    .eq('company_id', companyId)
    .or('source_kind.eq.governance_rule,target_kind.eq.governance_rule')

  const counts = new Map<string, number>()
  for (const r of data || []) {
    if (r.source_kind === 'governance_rule') counts.set(r.source_id, (counts.get(r.source_id) ?? 0) + 1)
    if (r.target_kind === 'governance_rule') counts.set(r.target_id, (counts.get(r.target_id) ?? 0) + 1)
  }
  return counts
}

export async function GET() {
  try {
    // 管理者 → ポータルメンバー の順で所属を解決（cookie ベース）
    const adminCtx = await getAdminContext()
    const memberCtx = adminCtx ? null : await getMemberContext()
    const companyId = adminCtx?.companyId ?? memberCtx?.companyId
    if (!companyId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: rules, error } = await supabaseAdmin
      .from('governance_rules')
      .select('id, rule_text, ng_example, ok_example, severity, sort_order')
      .eq('company_id', companyId)
      .eq('rule_type', 'tone_rule')
      .order('sort_order', { ascending: true })

    if (error) {
      return NextResponse.json({ error: `取得エラー: ${error.message}` }, { status: 500 })
    }

    // エッジ数は管理者（削除確認に使用）のみ付与
    let edgeCounts: Map<string, number> | null = null
    if (adminCtx) {
      edgeCounts = await countEdgesByRule(companyId)
    }

    return NextResponse.json({
      rules: (rules || []).map(r => ({
        ...r,
        edge_count: edgeCounts?.get(r.id) ?? 0,
      })),
    })
  } catch (err) {
    console.error('[ToneRules GET] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ctx = await getAdminContext()
    if (!ctx) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }
    const companyId = ctx.companyId
    const supabaseAdmin = getSupabaseAdmin()

    const body = await request.json()
    const inputs = (Array.isArray(body.rules) ? body.rules : []) as ToneRuleInput[]

    // バリデーション: rule_text 必須・severity は info/warn/block
    const normalized = inputs.map(r => ({
      id: typeof r.id === 'string' ? r.id : undefined,
      rule_text: (r.rule_text || '').trim(),
      ng_example: (r.ng_example || '').trim(),
      ok_example: (r.ok_example || '').trim(),
      severity: SEVERITIES.has(r.severity || '') ? (r.severity as string) : 'warn',
    }))
    if (normalized.some(r => !r.rule_text)) {
      return NextResponse.json({ error: 'ルール文は必須です' }, { status: 400 })
    }

    let updated = 0
    let inserted = 0

    // UPDATE（自社の tone_rule であることをサーバー側で強制）
    for (const r of normalized.filter(r => r.id)) {
      const { error, count } = await supabaseAdmin
        .from('governance_rules')
        .update({
          rule_text: r.rule_text,
          ng_example: r.ng_example || null,
          ok_example: r.ok_example || null,
          severity: r.severity,
        }, { count: 'exact' })
        .eq('id', r.id as string)
        .eq('company_id', companyId)
        .eq('rule_type', 'tone_rule')
      if (error) {
        return NextResponse.json({ error: `更新エラー: ${error.message}` }, { status: 500 })
      }
      updated += count ?? 0
    }

    // INSERT（rule_type='tone_rule'・scope='global' 固定、sort_order は末尾連番）
    const toInsert = normalized.filter(r => !r.id)
    if (toInsert.length > 0) {
      const { data: maxRow } = await supabaseAdmin
        .from('governance_rules')
        .select('sort_order')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle()
      const baseOrder = (maxRow?.sort_order ?? 0) + 1

      const { error } = await supabaseAdmin.from('governance_rules').insert(
        toInsert.map((r, i) => ({
          company_id: companyId,
          rule_type: 'tone_rule',
          scope: 'global',
          source: 'manual',
          rule_text: r.rule_text,
          ng_example: r.ng_example || null,
          ok_example: r.ok_example || null,
          severity: r.severity,
          sort_order: baseOrder + i,
        })),
      )
      if (error) {
        return NextResponse.json({ error: `登録エラー: ${error.message}` }, { status: 500 })
      }
      inserted = toInsert.length
    }

    return NextResponse.json({ ok: true, updated, inserted })
  } catch (err) {
    console.error('[ToneRules PUT] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await getAdminContext()
    if (!ctx) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }
    const companyId = ctx.companyId
    const id = request.nextUrl.searchParams.get('id') || ''
    if (!id) {
      return NextResponse.json({ error: 'id が必要です' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // 自社の tone_rule であることを確認（他社行・他 rule_type は対象外）
    const { data: rule } = await supabaseAdmin
      .from('governance_rules')
      .select('id')
      .eq('id', id)
      .eq('company_id', companyId)
      .eq('rule_type', 'tone_rule')
      .maybeSingle()
    if (!rule) {
      return NextResponse.json({ error: '対象の表現ルールが見つかりません' }, { status: 404 })
    }

    // 1. element_relations の該当エッジを先に削除（constrainedBy 等のダングリング防止）
    const { data: deletedEdges, error: edgeError } = await supabaseAdmin
      .from('element_relations')
      .delete()
      .eq('company_id', companyId)
      .or(`and(source_kind.eq.governance_rule,source_id.eq.${id}),and(target_kind.eq.governance_rule,target_id.eq.${id})`)
      .select('id')
    if (edgeError) {
      return NextResponse.json({ error: `関係エッジ削除エラー: ${edgeError.message}` }, { status: 500 })
    }

    // 2. ルール本体を削除
    const { error: ruleError } = await supabaseAdmin
      .from('governance_rules')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId)
      .eq('rule_type', 'tone_rule')
    if (ruleError) {
      return NextResponse.json({ error: `削除エラー: ${ruleError.message}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true, deletedEdges: deletedEdges?.length ?? 0 })
  } catch (err) {
    console.error('[ToneRules DELETE] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    )
  }
}
