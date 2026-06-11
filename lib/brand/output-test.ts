// オントロジー出力テスト（読み取り専用・DB書込なし）。
//
// 目的: 現在のオントロジーがAI出力に与える効果を、同じお題の2回生成で比較する。
//   A: オントロジー注入あり（理念/提供価値＋guardrails〔実績・ルール〕＋relations）
//   B: 注入なし（会社名・業種だけの素のプロンプト）
// グラウンディング: Aの出力に含まれる数値が注入事実に実在するかを照合し、実在値を返す。
// コスト: 1テスト＝Claude 2回呼び出し（注入データが全く無い会社は1回で A=B）。
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { callClaude } from '@/lib/claude-api'
import { fetchBrandGuardrails, buildGuardrailsPrompt } from '@/lib/brand/guardrails'
import { getRelationsPromptForCompany } from '@/lib/brand/relations'
import { extractNumberValues } from '@/lib/brand/profiling'
import { OUTPUT_TEST_TOPICS, type OutputTestResult, type OutputTestTopic } from '@/lib/brand/output-test-types'

const TOPIC_INSTRUCTION: Record<OutputTestTopic, { instruction: string; maxTokens: number }> = {
  company_intro: { instruction: 'この会社の紹介文を100字程度で1本書いてください。', maxTokens: 500 },
  catchcopy: { instruction: 'この会社のキャッチコピー案を3本書いてください（各20字以内・箇条書きで）。', maxTokens: 500 },
  proposal: { instruction: 'この会社からターゲット顧客への提案文を200字程度で1本書いてください。', maxTokens: 700 },
}

const BASE_SYSTEM =
  'あなたはプロのコピーライターです。与えられた企業情報だけをもとに、自然で簡潔な日本語で書いてください。前置き・説明・補足は不要で、成果物そのものだけを出力してください。'

const PHIL_JP: Record<string, string> = {
  mission: 'ミッション',
  vision: 'ビジョン',
  value: 'バリュー',
  action_guideline: '行動指針',
  service: '事業内容',
}

export async function runOutputTest(companyId: string, topic: OutputTestTopic): Promise<OutputTestResult> {
  const topicLabel = OUTPUT_TEST_TOPICS.find((t) => t.value === topic)?.label ?? topic
  const conf = TOPIC_INSTRUCTION[topic]
  const empty: OutputTestResult = {
    topicLabel,
    outputA: '',
    outputB: '',
    injected: { proof: 0, rule: 0, relation: 0, philosophy: 0, valueProposition: 0 },
    groundedNumbers: [],
    noOntology: true,
  }
  if (!companyId) return empty

  const supabase = getSupabaseAdmin()
  const [compR, philR, vpR, guardrails, relationsPrompt, relCount] = await Promise.all([
    supabase.from('companies').select('name, industry_category, industry_subcategory').eq('id', companyId).maybeSingle(),
    supabase.from('philosophy_elements').select('element_type, title, body').eq('company_id', companyId).order('sort_order', { ascending: true }),
    supabase.from('value_propositions').select('title, description').eq('company_id', companyId).order('sort_order', { ascending: true }),
    fetchBrandGuardrails(companyId),
    getRelationsPromptForCompany(companyId),
    supabase.from('element_relations').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
  ])

  const comp = compR.data as { name?: string; industry_category?: string | null; industry_subcategory?: string | null } | null
  type Phil = { element_type: string; title: string | null; body: string | null }
  type VP = { title: string | null; description: string | null }
  const phils = (philR.data as Phil[] | null) || []
  const vps = (vpR.data as VP[] | null) || []
  const relationCount = relCount.count ?? 0

  // 会社名・業種（A/B 共通の最小アイデンティティ）
  const name = comp?.name || '（社名未登録）'
  const industry = [comp?.industry_category, comp?.industry_subcategory].filter(Boolean).join(' / ')
  const identityBlock = `# 企業\n会社名: ${name}${industry ? `\n業種: ${industry}` : ''}`

  // 注入ブロック（A のみ）: 理念・提供価値・guardrails（実績・ルール）・関係
  const philLines = phils
    .map((p) => {
      const t = [p.title, p.body].filter(Boolean).join('：')
      return t.trim() ? `- ${PHIL_JP[p.element_type] ?? p.element_type}: ${t}` : ''
    })
    .filter(Boolean)
  const philBlock = philLines.length > 0 ? `# 理念\n${philLines.join('\n')}` : ''
  const vpBlock =
    vps.length > 0
      ? `# 提供価値\n${vps.map((v) => `- ${[v.title, v.description].filter(Boolean).join('：')}`).join('\n')}`
      : ''
  const guardrailsBlock = buildGuardrailsPrompt(guardrails)

  const injected = {
    proof: guardrails.proofPoints.length,
    rule: guardrails.governanceRules.length,
    relation: relationCount,
    philosophy: phils.length,
    valueProposition: vps.length,
  }
  const noOntology =
    injected.proof === 0 &&
    injected.rule === 0 &&
    injected.relation === 0 &&
    injected.philosophy === 0 &&
    injected.valueProposition === 0

  const userMessage = conf.instruction

  // B: 素のプロンプト（会社名・業種のみ）
  const systemB = `${BASE_SYSTEM}\n\n${identityBlock}`
  const outputB = await callClaude({ system: systemB, userMessage, maxTokens: conf.maxTokens })

  // 注入が皆無なら A=B（2回目を呼ばずコスト節約）
  if (noOntology) {
    return { ...empty, outputA: outputB, outputB, injected, noOntology: true }
  }

  // A: オントロジー注入あり
  const systemA = [BASE_SYSTEM, identityBlock, philBlock, vpBlock, guardrailsBlock, relationsPrompt]
    .filter(Boolean)
    .join('\n\n')
  const outputA = await callClaude({ system: systemA, userMessage, maxTokens: conf.maxTokens })

  // グラウンディング: A出力の数値のうち、注入事実（実績・提供価値・理念）に実在するもの
  const corpus = [
    ...guardrails.proofPoints.map((p) => `${p.title} ${p.description ?? ''}`),
    ...vps.map((v) => `${v.title ?? ''} ${v.description ?? ''}`),
    ...phils.map((p) => `${p.title ?? ''} ${p.body ?? ''}`),
  ].join(' ')
  const corpusNums = extractNumberValues(corpus)
  const groundedNumbers = [...extractNumberValues(outputA)].filter((n) => corpusNums.has(n))

  return { topicLabel, outputA, outputB, injected, groundedNumbers, noOntology: false }
}
