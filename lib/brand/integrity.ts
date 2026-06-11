// ブランド体系の整合性チェック（第一カット・決定論的・AI不要）。
//
// 目的: 「約束はあるが証拠がない」等の綻びを既存データから検出して可視化する。
// 読み取りのみ（修正アクションは出さない）。getSupabaseAdmin（service_role）で
// RLSをバイパスし確実に読む。データ0件なら該当findingなし（エラーにしない）。
//
// 次段（本カット外）: governance_rules の tone/claim を Claude が評価するAI判定チェック。
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { fetchElementsCatalog, KIND_LABELS, type ElementKind } from '@/lib/brand/elements-catalog'

export type IntegritySeverity = 'warn' | 'info'

export type IntegrityFinding = {
  severity: IntegritySeverity
  category: string
  message: string
  refs?: { kind: string; label: string }[]
}

const PHIL_JP: Record<string, string> = {
  mission: 'ミッション',
  vision: 'ビジョン',
  value: 'バリュー',
  action_guideline: '行動指針',
}

type VP = { id: string; title: string | null; description: string | null }
type PP = { id: string; title: string | null; value_proposition_id: string | null; evidence_date: string | null }
type ER = { source_kind: ElementKind; source_id: string; target_kind: ElementKind; target_id: string; relation_type: string; note: string | null }
type Term = { avoided_term: string | null; preferred_term: string | null }
type BG = { slogan: string | null; brand_statement: string | null; brand_story: string | null }
type Phil = { id: string; element_type: string; title: string | null; body: string | null }

export async function runIntegrityChecks(companyId: string): Promise<IntegrityFinding[]> {
  if (!companyId) return []
  const supabase = getSupabaseAdmin()

  const [vpR, ppR, erR, termsR, bgR, philR, catalog] = await Promise.all([
    supabase.from('value_propositions').select('id, title, description').eq('company_id', companyId).order('sort_order', { ascending: true }),
    supabase.from('proof_points').select('id, title, value_proposition_id, evidence_date').eq('company_id', companyId).order('sort_order', { ascending: true }),
    supabase.from('element_relations').select('source_kind, source_id, target_kind, target_id, relation_type, note').eq('company_id', companyId),
    supabase.from('brand_terms').select('avoided_term, preferred_term').eq('company_id', companyId),
    supabase.from('brand_guidelines').select('slogan, brand_statement, brand_story').eq('company_id', companyId).maybeSingle(),
    supabase.from('philosophy_elements').select('id, element_type, title, body').eq('company_id', companyId),
    fetchElementsCatalog(supabase, companyId),
  ])

  const vps = (vpR.data as VP[] | null) || []
  const pps = (ppR.data as PP[] | null) || []
  const ers = (erR.data as ER[] | null) || []
  const terms = (termsR.data as Term[] | null) || []
  const bg = (bgR.data as BG | null) || null
  const phils = (philR.data as Phil[] | null) || []

  const findings: IntegrityFinding[] = []

  // evidencedBy 関係（value_proposition → proof_point）
  const evidencedVpIds = new Set(ers.filter((r) => r.relation_type === 'evidencedBy' && r.source_kind === 'value_proposition').map((r) => r.source_id))
  const evidencedProofIds = new Set(ers.filter((r) => r.relation_type === 'evidencedBy' && r.target_kind === 'proof_point').map((r) => r.target_id))
  // 直接FK（proof_points.value_proposition_id）
  const vpIdsWithDirectProof = new Set(pps.filter((p) => p.value_proposition_id).map((p) => p.value_proposition_id as string))

  // 1. 裏づけのない約束（warn・旧称: 証拠なき約束）: 直接FK も evidencedBy 関係も無い提供価値
  //    ※ category 文字列はウィザードの点検サマリ（OntologyBuilderSection）と
  //      プロファイリングの改善表示が表示キーとして参照する。リネーム時は両側を同時に更新すること。
  //      （Step5完了判定は category 照合ではなく lib/brand/profiling.ts の uncoveredWarnCount を使う）
  for (const vp of vps) {
    if (!vpIdsWithDirectProof.has(vp.id) && !evidencedVpIds.has(vp.id)) {
      findings.push({
        severity: 'warn',
        category: '裏づけのない約束',
        message: `提供価値「${vp.title || '(無題)'}」を裏づける実績・エピソードが登録されていません`,
        refs: [{ kind: '提供価値', label: vp.title || '(無題)' }],
      })
    }
  }

  // 2. どの約束にも繋がっていない実績（info・旧称: 孤立した証拠）: 直接FK も evidencedBy 関係も無い実績
  for (const pp of pps) {
    if (!pp.value_proposition_id && !evidencedProofIds.has(pp.id)) {
      findings.push({
        severity: 'info',
        category: 'どの約束にも繋がっていない実績',
        message: `実績「${pp.title || '(無題)'}」がどの提供価値にも紐づいていません`,
        refs: [{ kind: '実績・エピソード', label: pp.title || '(無題)' }],
      })
    }
  }

  // 3. 用語規定違反（info）: avoided_term が主要テキストに使われていないか走査（部分一致）。
  //    言い換え推奨の性質上、機械検出は参考情報に留める（v1.1で warn から降格）。
  const texts: { loc: string; text: string }[] = []
  if (bg?.slogan) texts.push({ loc: 'スローガン', text: bg.slogan })
  if (bg?.brand_statement) texts.push({ loc: 'メッセージ', text: bg.brand_statement })
  if (bg?.brand_story) texts.push({ loc: 'ブランドストーリー', text: bg.brand_story })
  for (const vp of vps) {
    if (vp.title) texts.push({ loc: `提供価値「${vp.title}」`, text: vp.title })
    if (vp.description) texts.push({ loc: `提供価値「${vp.title || '(無題)'}」の説明`, text: vp.description })
  }
  for (const p of phils) {
    const jp = PHIL_JP[p.element_type] || p.element_type
    if (p.title) texts.push({ loc: `理念（${jp}）`, text: p.title })
    if (p.body) texts.push({ loc: `理念（${jp}）`, text: p.body })
  }
  for (const term of terms) {
    const av = (term.avoided_term || '').trim()
    if (!av) continue
    for (const { loc, text } of texts) {
      if (text.includes(av)) {
        const rec = term.preferred_term ? `（推奨: ${term.preferred_term}）` : ''
        findings.push({
          severity: 'info',
          category: '用語規定違反',
          message: `避けたい用語「${av}」が ${loc} に使われています${rec}`,
        })
      }
    }
  }

  // 4. 矛盾の明示（info）: conflictsWith を列挙
  const labelMap = new Map(catalog.map((e) => [`${e.kind}:${e.id}`, e.label]))
  const refOf = (kind: ElementKind, id: string) => labelMap.get(`${kind}:${id}`) ?? '不明な要素'
  for (const r of ers.filter((r) => r.relation_type === 'conflictsWith')) {
    const a = refOf(r.source_kind, r.source_id)
    const b = refOf(r.target_kind, r.target_id)
    findings.push({
      severity: 'info',
      category: '矛盾の明示',
      message: `「${a}」と「${b}」が矛盾関係として登録されています。同時に強く打ち出す表現は注意してください${r.note ? `（補足: ${r.note}）` : ''}`,
      refs: [
        { kind: KIND_LABELS[r.source_kind], label: a },
        { kind: KIND_LABELS[r.target_kind], label: b },
      ],
    })
  }

  // 5. 証拠の鮮度（info・任意）: evidence_date が2年より古い証拠
  const twoYearsAgo = new Date()
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
  for (const p of pps) {
    if (!p.evidence_date) continue
    const d = new Date(p.evidence_date)
    if (!isNaN(d.getTime()) && d < twoYearsAgo) {
      findings.push({
        severity: 'info',
        category: '証拠の鮮度',
        message: `証拠「${p.title || '(無題)'}」の日付（${p.evidence_date}）が2年より古いため、再確認を推奨します`,
        refs: [{ kind: '証拠・実績', label: p.title || '(無題)' }],
      })
    }
  }

  return findings
}
