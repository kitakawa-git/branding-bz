// AI生成ガードレール（証拠・表現ルール）の共通ロジック
//
// 目的:
//   コピー生成・草案提案のプロンプトに、企業ごとの「証拠（proof_points）」と
//   「表現ルール（governance_rules）」を注入し、抽象語への逃げ・実績の創作・禁則違反を防ぐ。
//
// フォールバック方針（重要）:
//   データが0件・取得失敗の企業では空文字を返し、呼び出し側の従来挙動を一切変えない。
//   取得は getSupabaseAdmin()（service_role）経由でRLSをバイパスして確実に読む。
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export type ProofPoint = {
  title: string
  description: string | null
  source_type: string | null
  value_proposition_id: string | null
}

export type GovernanceRule = {
  rule_type: string
  scope: string
  rule_text: string
  ng_example: string | null
  ok_example: string | null
  severity: string
}

export type BrandGuardrails = {
  proofPoints: ProofPoint[]
  governanceRules: GovernanceRule[]
}

const EMPTY: BrandGuardrails = { proofPoints: [], governanceRules: [] }

const SOURCE_TYPE_LABEL: Record<string, string> = {
  jisseki: '実績',
  jirei: '事例',
  data: 'データ',
  voice: '顧客の声',
  award: '受賞',
  other: 'その他',
}
// 区分は3つ（DBの CHECK 制約と一致）。旧 claim_rule / discouraged_expression は compliance_rule へ統合済み。
const RULE_TYPE_LABEL: Record<string, string> = {
  banned_word: '禁止ワード',
  tone_rule: 'トーンルール',
  compliance_rule: 'コンプラルール',
}
const SEVERITY_LABEL: Record<string, string> = {
  info: '参考',
  warn: '原則遵守',
  block: '絶対遵守',
}
const SEVERITY_ORDER: Record<string, number> = { block: 0, warn: 1, info: 2 }

/**
 * 該当企業の証拠（proof_points）・表現ルール（governance_rules）を取得する。
 * @param companyId 対象企業ID
 * @param opts.scopes 指定すると governance_rules を当該スコープ（＋常に 'global'）に絞り込む。
 *                    未指定なら全スコープを返す。proof_points は常に全件（全般＋各提供価値）。
 * 取得失敗時は空（＝フォールバックで従来挙動）。
 */
export async function fetchBrandGuardrails(
  companyId: string,
  opts?: { scopes?: string[] },
): Promise<BrandGuardrails> {
  if (!companyId) return EMPTY
  const supabase = getSupabaseAdmin()

  const scopeFilter =
    opts?.scopes && opts.scopes.length > 0
      ? Array.from(new Set(['global', ...opts.scopes]))
      : null

  const [proofRes, ruleRes] = await Promise.allSettled([
    supabase
      .from('proof_points')
      .select('title, description, source_type, value_proposition_id')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true }),
    (() => {
      let q = supabase
        .from('governance_rules')
        .select('rule_type, scope, rule_text, ng_example, ok_example, severity')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: true })
      if (scopeFilter) q = q.in('scope', scopeFilter)
      return q
    })(),
  ])

  const proofPoints =
    proofRes.status === 'fulfilled' && Array.isArray(proofRes.value.data)
      ? (proofRes.value.data as ProofPoint[])
      : []
  const governanceRules =
    ruleRes.status === 'fulfilled' && Array.isArray(ruleRes.value.data)
      ? (ruleRes.value.data as GovernanceRule[])
      : []

  if (proofRes.status === 'rejected') console.error('[guardrails] proof_points 取得失敗:', proofRes.reason)
  if (ruleRes.status === 'rejected') console.error('[guardrails] governance_rules 取得失敗:', ruleRes.reason)

  return { proofPoints, governanceRules }
}

/**
 * 取得した証拠・表現ルールを、systemプロンプトへ追記するための文字列に整形する。
 * 両方0件なら空文字を返す（＝注入なし＝従来挙動）。
 * taskKind（任意・既定 descriptive）:
 *   - 'descriptive': 紹介文・提案文・ターゲット提案など。事実の引用を推奨（従来挙動）
 *   - 'copy': キャッチコピー等の短文。「最も強い事実を選んで使う」指示に切替（全部盛り防止）
 *   いずれもルール（禁則）は絶対適用で変わらない。
 */
export function buildGuardrailsPrompt(
  g: BrandGuardrails,
  opts?: { taskKind?: 'copy' | 'descriptive' },
): string {
  const sections: string[] = []
  const isCopy = opts?.taskKind === 'copy'

  if (g.proofPoints.length > 0) {
    const lines = g.proofPoints.map((p) => {
      const label = p.source_type
        ? `［${SOURCE_TYPE_LABEL[p.source_type] ?? p.source_type}］`
        : ''
      const desc = p.description ? `：${p.description}` : ''
      return `- ${label}${p.title}${desc}`
    })
    sections.push(
      [
        '# 証拠・実績（ProofPoint）',
        isCopy
          ? '事実を使う場合は、以下から最も強い事実を1〜2個だけ選んで使うこと。登録要素の言葉をなぞるのではなく、選んだ事実そのもので語ること（全部を盛り込まない）。'
          : '提供価値に関する主張は、必ず以下の証拠のいずれかを根拠として用いること。',
        'ここに無い実績・数値・受賞・顧客の声などを創作してはならない（事実の捏造は禁止）。',
        ...lines,
      ].join('\n'),
    )
  }

  if (g.governanceRules.length > 0) {
    const sorted = [...g.governanceRules].sort(
      (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
    )
    const lines = sorted.map((r) => {
      const sev = SEVERITY_LABEL[r.severity] ?? r.severity
      const type = RULE_TYPE_LABEL[r.rule_type] ?? r.rule_type
      const ng = r.ng_example ? ` / NG例:「${r.ng_example}」` : ''
      const ok = r.ok_example ? ` / OK例:「${r.ok_example}」` : ''
      return `- 【${sev}】(${type}) ${r.rule_text}${ng}${ok}`
    })
    sections.push(
      [
        '# 表現ルール・禁則（GovernanceRule）',
        '「絶対遵守」のルールは例外なく必ず守ること。「原則遵守」は特段の理由がない限り守ること。',
        ...lines,
      ].join('\n'),
    )
  }

  return sections.join('\n\n')
}

/**
 * companyId から取得→整形までを一括で行うショートカット。
 * 返り値が空文字なら注入なし（従来挙動）。呼び出し側は
 *   const guardrails = await getGuardrailsPromptForCompany(companyId, { scopes: ['audience'] })
 *   const system = guardrails ? `${SYSTEM_PROMPT}\n\n${guardrails}` : SYSTEM_PROMPT
 * の形で system プロンプトへ追記する。
 */
export async function getGuardrailsPromptForCompany(
  companyId: string,
  opts?: { scopes?: string[] },
): Promise<string> {
  const g = await fetchBrandGuardrails(companyId, opts)
  return buildGuardrailsPrompt(g)
}
