/**
 * ブランドオントロジー提供 API（P4-1）。
 *
 * include-bz の Press Release AI（P4）がドラフト作成時に 1 回だけ呼び、
 * 結果を press_releases.brand_ontology_snapshot に固定保存する（再現性）。
 *
 * 契約の正: include-bz `docs/PRESS-RELEASE-AI-P4-BRAND-ONTOLOGY-SPEC.md` §3.2
 * 実装指示: `docs/260809_ブランドオントロジー提供API_実装指示書_v1.md`（v2）
 *
 * 最重要の制約 2 点:
 *   1. fail-closed 認証（秘密が未設定なら素通しさせず 401）。
 *      既存 app/api/cron/brand-score-snapshot/route.ts:17-19 は fail-open。真似しない。
 *   2. voice / governance は空でも必ずオブジェクトで返す（省略・null 禁止）。
 *      include-bz 側は version===1 しか検証せず、voice/governance をオプショナル
 *      チェーンなしで参照するため、欠落すると本文生成が 500 で落ちる。
 *
 * サーバー間通信専用。CORS は開けない。ブラウザから叩かせない。
 */
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { buildCopyOntologyBlocks } from '@/lib/copy/ontology-blocks'

/** 契約バージョン。フィールドを増減するときは include-bz と合意のうえ上げる。 */
const CONTRACT_VERSION = 1 as const

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

/**
 * 共有秘密による認証。fail-closed:
 * BRAND_ONTOLOGY_API_SECRET が未設定なら常に 401（素通しさせない）。
 * ※ include-bz 側の env 名は BRANDING_BZ_API_SECRET。名前は違うが値は同一。
 */
function verifyServiceToken(request: NextRequest): NextResponse | null {
  const secret = process.env.BRAND_ONTOLOGY_API_SECRET
  if (!secret) return unauthorized()

  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(request.headers.get('authorization') ?? '')
  // timingSafeEqual は長さが違うと throw するため、先に長さを比較する
  const ok = expected.length === actual.length && timingSafeEqual(expected, actual)
  return ok ? null : unauthorized()
}

/** rule_text を rule_type ごとに取り出す。空なら必ず [] を返す。 */
function ruleTextsOf(
  rows: { rule_type?: string | null; rule_text?: string | null }[],
  ruleType: string,
): string[] {
  return rows
    .filter((r) => r.rule_type === ruleType)
    .map((r) => (r.rule_text ?? '').trim())
    .filter(Boolean)
}

export async function POST(request: NextRequest) {
  const denied = verifyServiceToken(request)
  if (denied) return denied

  const body = await request.json().catch(() => ({}))
  const companyId = typeof body?.companyId === 'string' ? body.companyId.trim() : ''
  const personaIdRaw = typeof body?.personaId === 'string' ? body.personaId.trim() : ''
  const personaId = personaIdRaw || undefined

  if (!companyId || !UUID_RE.test(companyId)) {
    return NextResponse.json(
      { error: 'companyId は必須です（uuid 形式）' },
      { status: 400 },
    )
  }
  if (personaId && !UUID_RE.test(personaId)) {
    return NextResponse.json(
      { error: 'personaId は uuid 形式である必要があります' },
      { status: 400 },
    )
  }

  try {
    const supabase = getSupabaseAdmin()

    // company の実在確認。不在は 404（空の 200 を返さない）。
    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .select('id, name, name_ja')
      .eq('id', companyId)
      .maybeSingle()
    if (companyErr) throw companyErr
    if (!company) {
      return NextResponse.json({ error: 'company が見つかりません' }, { status: 404 })
    }

    // 集約器は自前で service-role クライアントを作る（引数に渡さない）。
    // slogan / tone_rule / compliance_rule は集約器が外に出さないため個別に取得する。
    const [blocks, guidelineRes, rulesRes] = await Promise.all([
      buildCopyOntologyBlocks(companyId, personaId),
      supabase
        .from('brand_guidelines')
        .select('slogan')
        .eq('company_id', companyId)
        .maybeSingle(),
      supabase
        .from('governance_rules')
        .select('rule_type, rule_text')
        .eq('company_id', companyId)
        .in('rule_type', ['tone_rule', 'compliance_rule'])
        .order('sort_order', { ascending: true }),
    ])

    const ruleRows = Array.isArray(rulesRes.data) ? rulesRes.data : []
    const slogan = ((guidelineRes.data as { slogan?: string | null } | null)?.slogan ?? '').trim()

    // ★ voice / governance は空でも必ずオブジェクト。null・省略にしないこと。
    return NextResponse.json({
      version: CONTRACT_VERSION,
      companyId,
      fetchedAt: new Date().toISOString(),
      companyName: (company.name_ja || company.name || null) as string | null,

      intent: blocks.intentBlock ?? '',
      facts: blocks.factBlock ?? '',
      aspiration: blocks.aspirationBlock ?? '',
      persona: blocks.personaBlock ?? '',

      voice: {
        slogan: slogan || null,
        toneRules: ruleTextsOf(ruleRows, 'tone_rule'),
      },
      governance: {
        bannedTerms: blocks.bannedTerms ?? [],
        complianceNotes: ruleTextsOf(ruleRows, 'compliance_rule'),
      },
      proofIds: blocks.injectedProofIds ?? [],
    })
  } catch (err) {
    // 内部情報（スタック・SQL）はレスポンスに含めない。ログにのみ残す。
    console.error('[external/brand-ontology] 取得に失敗:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
