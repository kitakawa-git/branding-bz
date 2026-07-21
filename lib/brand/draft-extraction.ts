// AI草案生成（オントロジー構築フロー ステージ1）: 登録済みデータから
// 証拠・実績（proof_points）と表現ルール（governance_rules）の草案を抽出する。
//
// 設計（relation-scan / profiling と同思想）:
// - 草案のみ。このモジュールはDBへ一切書き込まない。登録は superadmin UI での人間承認後
//   （クライアント supabase INSERT。RLSが効く経路）。
// - 入力は登録済みデータのみ。外部Webは読まない（v2スコープ）。
// - グラウンディング: 草案中の数値が元データに実在しない場合は破棄（捏造防止）。
//   裏づけになりそうだが具体値が不明なものは needs_confirmation: true で出させ、
//   description は固定テンプレートに強制（AIの補完を残さない）。
// - 0件・API失敗時は空配列を返す（例外を上げない）。
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { callClaude } from '@/lib/claude-api'
import { FALLBACK_RULE_TYPE } from '@/lib/brand/rule-display'

export type ProofExtractDraft = {
  title: string
  description: string
  source_type: string
  value_proposition_id: string | null
  source_note: string
  needs_confirmation: boolean
}

export type RuleExtractDraft = {
  rule_type: string
  scope: string
  rule_text: string
  ng_example: string
  ok_example: string
  severity: string
  rationale: string
}

export const NEEDS_CONFIRMATION_TEMPLATE = '【要確認】数値・詳細をクライアントに確認'

const PROOF_SOURCE_TYPES = new Set(['jisseki', 'jirei', 'data', 'voice', 'award', 'other'])
const RULE_TYPES = new Set(['banned_word', 'tone_rule', 'compliance_rule'])
const SCOPES = new Set(['global', 'claim', 'benefit', 'audience', 'service', 'action_guideline'])
const SEVERITIES = new Set(['block', 'warn', 'info'])

const PHIL_JP: Record<string, string> = {
  mission: 'ミッション',
  vision: 'ビジョン',
  value: 'バリュー',
  action_guideline: '行動指針',
  service: '事業内容',
}

// ---- 共通ユーティリティ ----

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

const normalizeDigits = (s: string) =>
  (s || '').replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))

// 比較用正規化（重複判定）: 全半角数字統一・空白除去・小文字化
const normText = (s: string) => normalizeDigits(s || '').replace(/\s+/g, '').toLowerCase()

// 草案テキスト中の数値がすべて元データ（corpus）に実在するか（profiling と同型・純関数）
export function draftNumbersGroundedInCorpus(draftTexts: string[], corpus: string): boolean {
  const c = normalizeDigits(corpus)
  for (const t of draftTexts) {
    const nums = normalizeDigits(t).match(/\d+(?:\.\d+)?/g) || []
    for (const n of nums) {
      if (!c.includes(n)) return false
    }
  }
  return true
}

// ---- 証拠・実績の草案抽出 ----

const PROOF_SYSTEM = `あなたはブランド管理者のアシスタントです。企業の登録済みブランドデータ（事業内容・ブランドストーリー・理念・提供価値・スローガン等）から、「証拠・実績」（proof_points）として登録できる候補を抽出してください。

厳守事項（最重要）:
- 元データに書かれている事実のみを抽出する。数字・固有名詞・実績を創作してはならない。
- 各候補に source_note（どの登録データから採ったか。例:「事業内容の登録記載より」「ブランドストーリーより」）を必ず付ける。
- 裏づけになりそうだが具体値が元データに無いもの（取引実績数・継続率・満足度・受賞歴など）は needs_confirmation: true とし、title はクライアントに確認すべき内容が分かる案（例:「導入企業数・継続率の実績（数値要確認）」）にする。description は空文字 "" にする。
- needs_confirmation: false の候補は、元データの記載だけで title / description が完結するものに限る。
- value_proposition_id は「提供価値一覧」に与えた id のみ使用。どれにも該当しなければ null。
- source_type は jisseki（実績）/ jirei（事例）/ data（データ）/ voice（顧客の声）/ award（受賞）/ other。
- 「既存の証拠・実績（提案禁止）」と同内容の候補は出さない。
- 確信できる候補のみ。こじつけ・一般論は出さない。候補が無ければ空配列 [] を返す。

出力は以下のJSON配列のみ。前後に説明文やMarkdownのコードブロックを付けないこと:
[
  {
    "title": "候補のタイトル",
    "description": "元データの記載に基づく説明（needs_confirmation: true の場合は \\"\\"）",
    "source_type": "jisseki 等",
    "value_proposition_id": "提供価値一覧の id または null",
    "source_note": "どの登録データから採ったか",
    "needs_confirmation": true または false
  }
]`

// AI出力の後処理バリデーション（純関数・ユニットテスト可能）。
// 破棄条件: title/source_note 無し / 実在しない value_proposition_id（→nullに矯正ではなく、
// id不正のみnull化）/ 既存証拠とタイトル重複 / 草案内重複 / 元データに無い数値（捏造）
export function validateProofDrafts(
  raw: unknown[],
  vpIds: string[],
  existingTitles: string[],
  corpus: string,
): ProofExtractDraft[] {
  const vpIdSet = new Set(vpIds)
  const existingSet = new Set(existingTitles.map(normText))
  const seen = new Set<string>()
  const out: ProofExtractDraft[] = []
  for (const item of raw) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = item as any
    const title = typeof f?.title === 'string' ? f.title.trim() : ''
    const source_note = typeof f?.source_note === 'string' ? f.source_note.trim() : ''
    if (!title || !source_note) continue // source_note 必須
    const needs_confirmation = f?.needs_confirmation === true
    // 要確認候補の description は固定テンプレートに強制（AIの補完を残さない）
    const description = needs_confirmation
      ? NEEDS_CONFIRMATION_TEMPLATE
      : typeof f?.description === 'string'
        ? f.description.trim()
        : ''
    const rawVpId = typeof f?.value_proposition_id === 'string' ? f.value_proposition_id.trim() : ''
    const value_proposition_id = vpIdSet.has(rawVpId) ? rawVpId : null // 実在しないIDはnull
    const source_type = PROOF_SOURCE_TYPES.has(f?.source_type) ? (f.source_type as string) : 'other'

    const key = normText(title)
    if (existingSet.has(key)) continue // 既存証拠と重複
    if (seen.has(key)) continue // 草案内重複
    // グラウンディング: 元データに無い数値を含む草案は破棄（捏造防止）
    if (!draftNumbersGroundedInCorpus([title, description], corpus)) {
      console.warn('[draft-extraction] 元データに無い数値を含む証拠草案を破棄:', title)
      continue
    }
    seen.add(key)
    out.push({ title, description, source_type, value_proposition_id, source_note, needs_confirmation })
  }
  return out
}

export async function extractProofDrafts(companyId: string): Promise<ProofExtractDraft[]> {
  if (!companyId) return []
  const supabase = getSupabaseAdmin()
  try {
    const [bgR, philR, vpR, ppR] = await Promise.all([
      supabase.from('brand_guidelines').select('slogan, brand_statement, brand_story').eq('company_id', companyId).maybeSingle(),
      supabase.from('philosophy_elements').select('element_type, title, body').eq('company_id', companyId).order('sort_order', { ascending: true }),
      supabase.from('value_propositions').select('id, title, description').eq('company_id', companyId).order('sort_order', { ascending: true }),
      supabase.from('proof_points').select('title').eq('company_id', companyId),
    ])

    type Phil = { element_type: string; title: string | null; body: string | null }
    type VP = { id: string; title: string | null; description: string | null }
    const bg = bgR.data as { slogan?: string; brand_statement?: string; brand_story?: string } | null
    const phils = (philR.data as Phil[] | null) || []
    const vps = (vpR.data as VP[] | null) || []
    const existingTitles = (((ppR.data as { title: string | null }[] | null) || []).map((p) => p.title || '')).filter(Boolean)

    const sections: string[] = []
    if (bg?.slogan) sections.push(`## スローガン\n${bg.slogan}`)
    if (bg?.brand_statement) sections.push(`## ブランドメッセージ\n${bg.brand_statement}`)
    if (bg?.brand_story) sections.push(`## ブランドストーリー\n${bg.brand_story}`)
    for (const p of phils) {
      const t = [p.title, p.body].filter(Boolean).join('\n')
      if (t.trim()) sections.push(`## 理念（${PHIL_JP[p.element_type] ?? p.element_type}）\n${t}`)
    }
    if (vps.length > 0) {
      sections.push(
        `## 提供価値一覧（value_proposition_id にはこの id のみ使用可）\n` +
          vps.map((v) => `- id: ${v.id}\n  タイトル: ${v.title || '(無題)'}\n  説明: ${v.description || '（説明なし）'}`).join('\n'),
      )
    }
    if (sections.length === 0) return [] // 元データが無ければ抽出できない

    const existingBlock =
      existingTitles.length > 0
        ? `\n\n## 既存の証拠・実績（提案禁止）\n${existingTitles.map((t) => `- ${t}`).join('\n')}`
        : ''

    // グラウンディング照合用コーパス（提供価値一覧のid部分は数値照合に影響しないが、本文系のみで構成）
    const corpus = [
      bg?.slogan || '',
      bg?.brand_statement || '',
      bg?.brand_story || '',
      ...phils.map((p) => [p.title, p.body].filter(Boolean).join('\n')),
      ...vps.map((v) => [v.title, v.description].filter(Boolean).join('\n')),
    ].join('\n')

    const raw = await callClaude({
      system: PROOF_SYSTEM,
      userMessage: `# 登録済みブランドデータ\n\n${sections.join('\n\n')}${existingBlock}`,
      maxTokens: 4096,
    })
    return validateProofDrafts(
      extractJsonArray(raw),
      vps.map((v) => v.id),
      existingTitles,
      corpus,
    )
  } catch (err) {
    console.error('[draft-extraction] 証拠草案の抽出失敗:', err)
    return []
  }
}

// ---- 表現ルールの草案抽出 ----

const RULE_SYSTEM = `あなたはブランド管理者のアシスタントです。企業の登録済みデータから、「表現ルール（禁則）」（governance_rules）として登録できる候補を推定してください。

候補の源泉は次の3つのみ:
1. 業種: 業種に固有の広告・表現規制（例: 医療系→効果保証表現の禁止・最大級表現の禁止。これらは severity: "block"）。
2. バリュー・理念: 企業のバリューから導かれるトーン・主張のルール（例: 「誠実」→誇張表現を避ける）。
3. 用語規定: 「避けたい用語」に背景となる表現方針がありそうなもののみ、単語禁止を超えるルールに昇格（単なる言い換えの繰り返しは出さない）。

厳守事項:
- rationale（理由）必須。どの源泉（業種/どのバリュー/どの用語規定）から導いたかを明記する（例:「バリュー『誠実』より」）。
- 法令・規制に言及する場合、法令名の引用は確実なもののみ。少しでも不確かなら「広告表現の規制」程度の表現に留める。
- 「既存の表現ルール（提案禁止）」と趣旨が重複する候補は出さない。
- ng_example / ok_example は自然で具体的な例文。固有の数値・固有名詞は創作しない（一般的な言い回し例は可）。
- rule_type は banned_word（使ってはいけない語そのもの）/ tone_rule（話し方・語り口）/ compliance_rule（法令や自社方針として根拠なく言い切ってはいけないこと）の3つから最も近いもの。
- scope は global / claim / benefit / audience / service / action_guideline（迷ったら global）。
- severity は block（絶対遵守・法規制系）/ warn（原則遵守）/ info（参考）。
- 確信できる候補のみ。多くても6件程度。候補が無ければ空配列 [] を返す。

出力は以下のJSON配列のみ。前後に説明文やMarkdownのコードブロックを付けないこと:
[
  {
    "rule_type": "...",
    "scope": "...",
    "rule_text": "ルール本文（1文）",
    "ng_example": "避けたい表現の例（無ければ \\"\\"）",
    "ok_example": "推奨する言い換えの例（無ければ \\"\\"）",
    "severity": "...",
    "rationale": "どの源泉から導いたか＋理由"
  }
]`

// AI出力の後処理バリデーション（純関数）。
// 破棄条件: rule_text/rationale 無し / 既存ルールと本文の趣旨重複（正規化後の包含）/ 草案内重複
export function validateRuleDrafts(raw: unknown[], existingRuleTexts: string[]): RuleExtractDraft[] {
  const existing = existingRuleTexts.map(normText).filter(Boolean)
  const seen: string[] = []
  const out: RuleExtractDraft[] = []
  for (const item of raw) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = item as any
    const rule_text = typeof f?.rule_text === 'string' ? f.rule_text.trim() : ''
    const rationale = typeof f?.rationale === 'string' ? f.rationale.trim() : ''
    if (!rule_text || !rationale) continue
    const key = normText(rule_text)
    // 既存ルールとの趣旨重複: 正規化後にどちらかがどちらかを包含したら重複とみなし破棄
    if (existing.some((e) => e.includes(key) || key.includes(e))) continue
    if (seen.some((s) => s.includes(key) || key.includes(s))) continue
    seen.push(key)
    out.push({
      rule_type: RULE_TYPES.has(f?.rule_type) ? (f.rule_type as string) : FALLBACK_RULE_TYPE,
      scope: SCOPES.has(f?.scope) ? (f.scope as string) : 'global',
      rule_text,
      ng_example: typeof f?.ng_example === 'string' ? f.ng_example.trim() : '',
      ok_example: typeof f?.ok_example === 'string' ? f.ok_example.trim() : '',
      severity: SEVERITIES.has(f?.severity) ? (f.severity as string) : 'warn',
      rationale,
    })
  }
  return out
}

export async function extractRuleDrafts(companyId: string): Promise<RuleExtractDraft[]> {
  if (!companyId) return []
  const supabase = getSupabaseAdmin()
  try {
    const [compR, philR, termsR, govR] = await Promise.all([
      supabase.from('companies').select('industry_category, industry_subcategory').eq('id', companyId).maybeSingle(),
      supabase.from('philosophy_elements').select('element_type, title, body').eq('company_id', companyId).order('sort_order', { ascending: true }),
      supabase.from('brand_terms').select('avoided_term, preferred_term, context').eq('company_id', companyId).order('sort_order', { ascending: true }),
      supabase.from('governance_rules').select('rule_text').eq('company_id', companyId),
    ])

    type Phil = { element_type: string; title: string | null; body: string | null }
    type Term = { avoided_term: string | null; preferred_term: string | null; context: string | null }
    const comp = compR.data as { industry_category?: string | null; industry_subcategory?: string | null } | null
    const phils = (philR.data as Phil[] | null) || []
    const terms = (termsR.data as Term[] | null) || []
    const existingRuleTexts = (((govR.data as { rule_text: string | null }[] | null) || []).map((g) => g.rule_text || '')).filter(Boolean)

    const sections: string[] = []
    if (comp?.industry_category) {
      sections.push(`## 業種\n${comp.industry_category}${comp.industry_subcategory ? `（${comp.industry_subcategory}）` : ''}`)
    }
    const valueLike = phils.filter((p) => p.element_type === 'value' || p.element_type === 'mission' || p.element_type === 'action_guideline')
    if (valueLike.length > 0) {
      sections.push(
        `## バリュー・理念\n` +
          valueLike.map((p) => `- ${PHIL_JP[p.element_type] ?? p.element_type}: ${[p.title, p.body].filter(Boolean).join('：')}`).join('\n'),
      )
    }
    if (terms.length > 0) {
      sections.push(
        `## 用語規定\n` +
          terms
            .map((t) => `- 避けたい用語:「${t.avoided_term || ''}」${t.preferred_term ? ` → 推奨:「${t.preferred_term}」` : ''}${t.context ? `（背景: ${t.context}）` : ''}`)
            .join('\n'),
      )
    }
    if (sections.length === 0) return [] // 源泉が無ければ推定できない

    const existingBlock =
      existingRuleTexts.length > 0
        ? `\n\n## 既存の表現ルール（提案禁止）\n${existingRuleTexts.map((t) => `- ${t}`).join('\n')}`
        : ''

    const raw = await callClaude({
      system: RULE_SYSTEM,
      userMessage: `# 登録済みデータ\n\n${sections.join('\n\n')}${existingBlock}`,
      maxTokens: 4096,
    })
    return validateRuleDrafts(extractJsonArray(raw), existingRuleTexts)
  } catch (err) {
    console.error('[draft-extraction] ルール草案の抽出失敗:', err)
    return []
  }
}
