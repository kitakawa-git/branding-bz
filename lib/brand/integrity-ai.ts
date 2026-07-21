// ブランド整合性チェック AI判定レイヤー（第二カット）。
//
// 決定論的チェック（lib/brand/integrity.ts）では拾えない「トーン・主張」の違反を、
// governance_rules の tone_rule / claim_rule / discouraged_expression に対し Claude が意味判定する。
// banned_word は決定論側で処理済みのため対象外（二重報告防止）。
//
// 重要:
// - 読み取り専用。修正案(suggestion)は表示用で、DBへの書き込みは一切しない。
// - 1社1回の Claude 呼び出しにまとめる（コスト・レート対策）。
// - ハルシネーション防護: 返ってきた quoted_text が原文に実在し、rule_id/target_ref が実在することを
//   コード側で検証し、通らない finding は捨てる。
// - 0件・API失敗時は空配列を返す（フォールバック・例外を上げない）。
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { callClaude } from '@/lib/claude-api'

// banned_word は決定論側（integrity.ts）で処理済みのため対象外（二重報告防止）。
// compliance_rule は旧 claim_rule / discouraged_expression の統合先。従来ここから漏れており
// 「コンプラに分類すると意味判定されない」状態だったので必ず含める。
const TARGET_RULE_TYPES = ['tone_rule', 'compliance_rule'] as const

const RULE_TYPE_JP: Record<string, string> = {
  tone_rule: 'トーンルール',
  compliance_rule: 'コンプラルール',
}
const PHIL_JP: Record<string, string> = {
  mission: 'ミッション',
  vision: 'ビジョン',
  value: 'バリュー',
  action_guideline: '行動指針',
  service: '事業内容',
}

export type AiEvalText = { ref: string; label: string; text: string }

export type AiIntegrityFinding = {
  rule_id: string
  rule_type: string
  severity: string
  target_ref: string
  target_label: string
  quoted_text: string
  reason: string
  suggestion: string
  confidence: 'high' | 'medium'
}

type Rule = {
  id: string
  rule_type: string
  rule_text: string
  ng_example: string | null
  ok_example: string | null
  severity: string
}

const SYSTEM_PROMPT = `あなたはブランド表現の品質管理者です。以下の「評価ルール」に対し、「評価対象テキスト」が明確に違反している箇所のみを検出してください。

判定方針（厳守）:
- 明確な違反のみを報告する。グレー・微妙なものは報告しない（誤検知を避けることを最優先）。
- 各ルールの NG例 / OK例 を判断基準として最大限活用する。
- quoted_text は、対象テキストに実在する文字列を一字一句そのまま引用する（言い換え・要約・前後の付け足しをしない）。
- suggestion は、元のトーン・意図・長さ感を保ちつつ、違反だけを解消した自然な書き換え案にする。
- 1つのルールにつき複数箇所が違反していれば複数報告してよい。違反が1つも無ければ空配列 [] を返す。

出力は以下のJSON配列のみ。前後に説明文やMarkdownのコードブロックを付けないこと:
[
  {
    "rule_id": "対象ルールの rule_id（与えられた値をそのまま）",
    "target_ref": "違反した対象テキストの target_ref（与えられた値をそのまま）",
    "quoted_text": "違反箇所の原文引用（対象テキストに実在する文字列そのまま）",
    "reason": "違反と判断した理由（1〜2文・日本語）",
    "suggestion": "修正案（日本語）",
    "confidence": "high または medium"
  }
]`

function buildUserMessage(rules: Rule[], texts: AiEvalText[]): string {
  const ruleLines = rules
    .map((r) => {
      const ng = r.ng_example ? `\n  NG例:「${r.ng_example}」` : ''
      const ok = r.ok_example ? `\n  OK例:「${r.ok_example}」` : ''
      return `- rule_id: ${r.id}\n  種別: ${RULE_TYPE_JP[r.rule_type] ?? r.rule_type}（severity=${r.severity}）\n  ルール: ${r.rule_text}${ng}${ok}`
    })
    .join('\n')
  // target_ref と label を別行にする（同一行に「ref（label）」と並べると、AIが label まで
  //   target_ref に含めて返すことがあるため）。
  const textLines = texts
    .map((t) => `- target_ref: ${t.ref}\n  対象: ${t.label}\n  本文:\n"""\n${t.text}\n"""`)
    .join('\n\n')
  return `# 評価ルール\n${ruleLines}\n\n# 評価対象テキスト\n${textLines}`
}

// AIが target_ref に余分なラベル等を付けた場合に備え、頑健に対象テキストを解決する。
function resolveTextRef(textMap: Map<string, AiEvalText>, raw: string): AiEvalText | undefined {
  const r = (raw || '').trim()
  if (textMap.has(r)) return textMap.get(r)
  // 「ref（label）」「ref (label)」「ref ...」等を想定し、先頭の ref 部分で再照合
  const stripped = r.split(/[（(\s]/)[0]
  return stripped ? textMap.get(stripped) : undefined
}

// Claude応答からJSON配列を抽出（Markdownコードブロック対応・失敗時は空配列）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractJsonArray(text: string): any[] {
  let s = (text || '').trim()
  const m = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (m) s = m[1].trim()
  const start = s.indexOf('[')
  const end = s.lastIndexOf(']')
  if (start < 0 || end < 0) return []
  try {
    const parsed = JSON.parse(s.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// 評価対象テキストをDBから収集（ref付き）。
async function collectTexts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  companyId: string,
): Promise<AiEvalText[]> {
  const [bgR, philR, vpR] = await Promise.all([
    supabase.from('brand_guidelines').select('slogan, brand_statement, brand_story').eq('company_id', companyId).maybeSingle(),
    supabase.from('philosophy_elements').select('id, element_type, title, body').eq('company_id', companyId),
    supabase.from('value_propositions').select('id, title, description').eq('company_id', companyId),
  ])
  const texts: AiEvalText[] = []
  const bg = bgR.data as { slogan?: string; brand_statement?: string; brand_story?: string } | null
  if (bg?.slogan) texts.push({ ref: 'brand_guidelines:slogan', label: 'スローガン', text: bg.slogan })
  if (bg?.brand_statement) texts.push({ ref: 'brand_guidelines:brand_statement', label: 'メッセージ', text: bg.brand_statement })
  if (bg?.brand_story) texts.push({ ref: 'brand_guidelines:brand_story', label: 'ブランドストーリー', text: bg.brand_story })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (philR.data as any[] | null) || []) {
    const t = [r.title, r.body].filter(Boolean).join('\n')
    if (t.trim()) texts.push({ ref: `philosophy_element:${r.id}`, label: `理念（${PHIL_JP[r.element_type] ?? r.element_type}）`, text: t })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (vpR.data as any[] | null) || []) {
    const t = [r.title, r.description].filter(Boolean).join('\n')
    if (t.trim()) texts.push({ ref: `value_proposition:${r.id}`, label: '提供価値', text: t })
  }
  return texts
}

export async function runAiIntegrityCheck(
  companyId: string,
  options?: { textsOverride?: AiEvalText[] },
): Promise<AiIntegrityFinding[]> {
  if (!companyId) return []
  const supabase = getSupabaseAdmin()

  // 評価ルール（tone/claim/discouraged のみ。banned_word は決定論側）
  const { data: ruleData, error: ruleErr } = await supabase
    .from('governance_rules')
    .select('id, rule_type, rule_text, ng_example, ok_example, severity')
    .eq('company_id', companyId)
    .in('rule_type', TARGET_RULE_TYPES as unknown as string[])
    .order('sort_order', { ascending: true })
  if (ruleErr) {
    console.error('[integrity-ai] governance_rules 取得失敗:', ruleErr)
    return []
  }
  const rules = (ruleData as Rule[] | null) || []
  if (rules.length === 0) return [] // 対象ルール無し＝フォールバック

  // 評価対象テキスト
  let texts = options?.textsOverride ?? (await collectTexts(supabase, companyId))
  texts = texts.filter((t) => t.text && t.text.trim())
  if (texts.length === 0) return []

  // Claude 1回呼び出し
  let raw: string
  try {
    raw = await callClaude({ system: SYSTEM_PROMPT, userMessage: buildUserMessage(rules, texts), maxTokens: 4096 })
  } catch (err) {
    console.error('[integrity-ai] Claude 呼び出し失敗:', err)
    return []
  }

  // パース＋ハルシネーション防護バリデーション
  const ruleMap = new Map(rules.map((r) => [r.id, r]))
  const textMap = new Map(texts.map((t) => [t.ref, t]))
  const out: AiIntegrityFinding[] = []
  for (const f of extractJsonArray(raw)) {
    const rule = ruleMap.get(String(f?.rule_id ?? '').trim())
    const txt = resolveTextRef(textMap, String(f?.target_ref ?? ''))
    if (!rule || !txt) continue // 実在しない rule_id / target_ref は捨てる
    const q = typeof f?.quoted_text === 'string' ? f.quoted_text.trim() : ''
    if (!q || !txt.text.includes(q)) continue // 引用が原文に無い＝ハルシネーション、捨てる
    const reason = typeof f?.reason === 'string' ? f.reason.trim() : ''
    const suggestion = typeof f?.suggestion === 'string' ? f.suggestion.trim() : ''
    if (!reason || !suggestion) continue
    out.push({
      rule_id: rule.id,
      rule_type: rule.rule_type,
      severity: rule.severity,
      target_ref: txt.ref,
      target_label: txt.label,
      quoted_text: q,
      reason,
      suggestion,
      confidence: f?.confidence === 'high' ? 'high' : 'medium',
    })
  }
  return out
}
