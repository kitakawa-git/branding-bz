// パーソナリティ診断 — プロンプト構築＋出力検証（純粋ロジック、サーバー/クライアント共用可）
// 設計は北川さん承認済み（2026-06-11）:
// - 1回のAI呼び出しで Aaker 5次元＋アーキタイプ主副＋archetype_traits＋トーン＋タグ＋tone_rules を一括算出
// - アーキタイプの label/copy はAI出力を信用せず定義表から強制上書き（AI採用は企業固有 description のみ）
// - expected_tags は8語クローズドリストをコード側で確定的に検証（リトライ対象）
// - Aakerメリハリ規律・archetype_traits 全項目同点禁止はプロンプト指示に留め、コード側は警告ログのみ
import {
  ARCHETYPES,
  ARCHETYPE_BY_KEY,
  AAKER_DIMENSIONS,
  AAKER_BY_DIMENSION,
  EXPECTED_TAG_VOCABULARY,
  type ArchetypeKey,
  type AakerDimension,
} from './archetypes'
import { DIAGNOSIS_QUESTIONS, type DiagnosisAnswers, type FrameworkKey } from './questions'

// ---------- 型 ----------

export interface AakerScoreItem {
  dimension: AakerDimension
  label: string
  score: number
  copy: string
  description: string
}

export interface ArchetypeSide {
  key: ArchetypeKey
  label: string
  copy: string
  description: string
}

export interface ArchetypeTraitItem {
  name: string
  score: number
  copy: string
  description: string
}

export interface ToneRule {
  rule_text: string
  ng_example: string
  ok_example: string
  severity: 'low' | 'medium' | 'high'
}

export interface DiagnosisResult {
  aaker_scores: AakerScoreItem[]
  archetype: {
    primary: ArchetypeSide
    secondary: ArchetypeSide
  }
  archetype_traits: ArchetypeTraitItem[]
  personality_summary: string
  communication_style: string
  expected_tags: string[]
  tone_rules: ToneRule[]
}

interface BasicInfoInput {
  company_name?: string
  industry_category?: string
  industry_subcategory?: string
  business_descriptions?: Array<{ title: string; description: string }>
}

// ---------- プロンプト構築 ----------

const FRAMEWORK_LABEL: Record<FrameworkKey, string> = {
  aaker: 'Aaker 5次元（スコア型）',
  archetype: '12アーキタイプ（タイプ型）',
}

export function buildSystemPrompt(framework: FrameworkKey): string {
  const aakerDefs = AAKER_DIMENSIONS
    .map(d => `- ${d.dimension}（${d.label}）「${d.copy}」: ${d.description}`)
    .join('\n')

  const archetypeDefs = ARCHETYPES
    .map(a => `- ${a.key}（${a.label}）「${a.copy}」: ${a.description} キーワード: ${a.keywords.join('・')} / 語り口の参照: ${a.tone_hint}`)
    .join('\n')

  const summaryVocab = framework === 'aaker'
    ? `Aaker 5次元の語彙（${AAKER_DIMENSIONS.map(d => d.label).join('・')}とその強弱）`
    : '12アーキタイプの語彙（主人格・副人格の型の名前と性質）'

  return `あなたは中小企業のブランドパーソナリティ設計の専門家。経営者が答えた10問の診断から、ブランドの「人格」を構造化する。

# タスク
回答と企業情報をもとに以下を一括算出し、指定のJSONのみを出力する（前置き・説明文・コードフェンス禁止）。
1. Aaker 5次元スコア（各1〜5の整数）
2. 12アーキタイプの主人格・副人格
3. アーキタイプ特性（archetype_traits）: 主・副の人格をこの企業の特性3〜5項目に翻訳したもの
4. パーソナリティ概要（personality_summary）: ${summaryVocab}で書く物語文（200〜300字）
5. コミュニケーションスタイル（100〜200字。ブランドの語り口・トーンと顧客接点での振る舞い方針を両方含めて1本化する）
6. 期待印象タグ（2〜3個）
7. トーン制約ルール（最大3本）

# 判定の手がかり
- Q1（言われたい存在）・Q5（距離感）・Q9（5年後の姿＋自由記述）はアーキタイプの主シグナル
- Q4（休日の過ごし方）・Q10（創業の原動力）は動機の裏付け
- Q2（言われたくない形容詞）は除外制約。該当する人格要素・表現を必ず避け、tone_rules に最低1本反映する
- Q3（競合との話し方）・Q7（語り口）はコミュニケーションスタイルの直接素材
- Q6（意思決定の優先）・Q8（価格・品質）はAaker次元の強弱に反映
- 単一の質問を単一の次元に機械的に対応させず、回答全体から総合判断する

# Aaker 5次元の定義
${aakerDefs}

# 12アーキタイプの定義
${archetypeDefs}

# 制約
- aaker_scores: 5次元すべてを出力。score は1〜5の整数。全次元を4以上にしない。最高スコアと最低スコアの差は2以上つける
- 各次元の copy（15字以内のキャッチ）と description（60〜90字）は、この企業の回答・事業内容を反映した固有の文。上の定義文の複製は禁止
- archetype: primary と secondary は必ず異なる型。key は上の12種から選ぶ。description はこの企業がその型である理由（80〜120字、回答の内容を反映）。label と copy は定義のものをそのまま書く
- archetype_traits: 3〜5項目。name は特性名（例: 誠実・革新）、score は1〜5の整数で全項目を同じ値にしない。copy（15字以内）と description（60〜90字）は企業固有の文
- communication_style: 主人格の語り口（Q3/Q7 の回答を反映）と顧客接点での振る舞い方針を統合した実務的な1本の記述
- expected_tags: 次の8語から2〜3個。これ以外の語は出力禁止: ${EXPECTED_TAG_VOCABULARY.join('/')}
- tone_rules: 最大3本。各ルールに rule_text / ng_example / ok_example を必ず含め、severity は low / medium / high のいずれか
- 実績・数値・受賞・顧客の声などの事実を創作しない

# 出力JSON形式
{
  "aaker_scores": [
    { "dimension": "sincerity", "label": "誠実", "score": 4, "copy": "...", "description": "..." },
    { "dimension": "excitement", "label": "刺激", "score": 2, "copy": "...", "description": "..." },
    { "dimension": "competence", "label": "能力", "score": 5, "copy": "...", "description": "..." },
    { "dimension": "sophistication", "label": "洗練", "score": 3, "copy": "...", "description": "..." },
    { "dimension": "ruggedness", "label": "逞しさ", "score": 2, "copy": "...", "description": "..." }
  ],
  "archetype": {
    "primary": { "key": "sage", "label": "賢者", "copy": "...", "description": "..." },
    "secondary": { "key": "caregiver", "label": "援助者", "copy": "...", "description": "..." }
  },
  "archetype_traits": [
    { "name": "...", "score": 4, "copy": "...", "description": "..." }
  ],
  "personality_summary": "...",
  "communication_style": "...",
  "expected_tags": ["専門的", "信頼感"],
  "tone_rules": [
    { "rule_text": "...", "ng_example": "...", "ok_example": "...", "severity": "medium" }
  ]
}`
}

export function buildUserMessage(
  basicInfo: BasicInfoInput,
  answers: DiagnosisAnswers,
  framework: FrameworkKey,
): string {
  const parts: string[] = []

  parts.push('## 企業情報')
  parts.push(`- 企業名: ${basicInfo.company_name || '（未入力）'}`)
  const industry = [basicInfo.industry_category, basicInfo.industry_subcategory].filter(Boolean).join(' / ')
  parts.push(`- 業種: ${industry || '（未入力）'}`)
  const biz = (basicInfo.business_descriptions || []).filter(b => b.title)
  if (biz.length > 0) {
    parts.push('- 事業内容:')
    biz.forEach(b => parts.push(`  - ${b.title}${b.description ? `: ${b.description}` : ''}`))
  }

  parts.push('')
  parts.push('## 選択フレームワーク（結果表示のデフォルト）')
  parts.push(FRAMEWORK_LABEL[framework])

  parts.push('')
  parts.push('## 診断回答')
  for (const q of DIAGNOSIS_QUESTIONS) {
    const a = answers[q.id]
    const selected = Array.isArray(a) ? a.join('、') : ''
    parts.push(`Q${q.number}. ${q.text}`)
    parts.push(`回答: ${selected || '（無回答）'}`)
    if (q.hasFreeText) {
      const free = answers[`${q.id}_free`]
      if (typeof free === 'string' && free.trim()) {
        parts.push(`自由記述: ${free.trim()}`)
      }
    }
  }

  return parts.join('\n')
}

// ---------- 出力検証・正規化 ----------

const ARCHETYPE_KEYS = new Set(ARCHETYPES.map(a => a.key))
const TAG_SET = new Set<string>(EXPECTED_TAG_VOCABULARY)
const SEVERITIES = new Set(['low', 'medium', 'high'])

function clampScore(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  return Math.min(5, Math.max(1, Math.round(n)))
}

/** コードフェンス等を剥がして JSON を取り出す */
export function extractJson(text: string): string {
  let t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) t = fence[1].trim()
  // 先頭の { から末尾の } まで（前置きが混ざった場合の保険）
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) t = t.slice(start, end + 1)
  return t
}

export type ValidationOutcome =
  | { ok: true; result: DiagnosisResult; warnings: string[] }
  | { ok: false; reason: string }

/**
 * AI出力を検証・正規化する。
 * - 構造不正・タグ不足はリトライ対象（ok: false）
 * - メリハリ規律（Aaker・archetype_traits の同点等）は警告のみ（承認済み方針）
 * - アーキタイプ・Aaker の label/copy（型レベルの文言）は定義表で強制上書き
 */
export function validateAndNormalize(raw: string): ValidationOutcome {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(extractJson(raw))
  } catch {
    return { ok: false, reason: 'JSONとして解釈できない' }
  }

  const warnings: string[] = []

  // --- aaker_scores: 5次元すべて必須 ---
  const rawScores = Array.isArray(parsed.aaker_scores) ? parsed.aaker_scores as Record<string, unknown>[] : []
  const scoreByDim = new Map<string, Record<string, unknown>>()
  for (const item of rawScores) {
    if (item && typeof item.dimension === 'string') scoreByDim.set(item.dimension, item)
  }
  const aakerScores: AakerScoreItem[] = []
  for (const def of AAKER_DIMENSIONS) {
    const item = scoreByDim.get(def.dimension)
    if (!item) return { ok: false, reason: `aaker_scores に ${def.dimension} がない` }
    const score = clampScore(item.score)
    if (score === null) return { ok: false, reason: `aaker_scores.${def.dimension} の score が数値でない` }
    aakerScores.push({
      dimension: def.dimension,
      label: def.label, // 定義表で強制上書き
      score,
      copy: typeof item.copy === 'string' ? item.copy : '',
      description: typeof item.description === 'string' ? item.description : '',
    })
  }
  // メリハリ規律は警告のみ（リトライしない）
  const values = aakerScores.map(s => s.score)
  if (Math.min(...values) >= 4) warnings.push('Aaker: 全次元が4以上')
  if (Math.max(...values) - Math.min(...values) < 2) warnings.push('Aaker: 最高と最低の差が2未満')

  // --- archetype: primary/secondary、12 key、primary ≠ secondary ---
  const arch = (parsed.archetype || {}) as Record<string, unknown>
  const normalizeSide = (side: unknown, name: string): ArchetypeSide | { error: string } => {
    const s = (side || {}) as Record<string, unknown>
    const key = typeof s.key === 'string' ? s.key : ''
    if (!ARCHETYPE_KEYS.has(key as ArchetypeKey)) return { error: `archetype.${name}.key が12種にない: ${key}` }
    const def = ARCHETYPE_BY_KEY[key as ArchetypeKey]
    return {
      key: def.key,
      label: def.label, // 定義表で強制上書き
      copy: def.copy,   // 定義表で強制上書き
      description: typeof s.description === 'string' ? s.description : '',
    }
  }
  const primary = normalizeSide(arch.primary, 'primary')
  if ('error' in primary) return { ok: false, reason: primary.error }
  const secondary = normalizeSide(arch.secondary, 'secondary')
  if ('error' in secondary) return { ok: false, reason: secondary.error }
  if (primary.key === secondary.key) return { ok: false, reason: 'archetype の primary と secondary が同一' }

  // --- archetype_traits: 3〜5項目 ---
  const rawTraits = Array.isArray(parsed.archetype_traits) ? parsed.archetype_traits as Record<string, unknown>[] : []
  const traits: ArchetypeTraitItem[] = []
  for (const t of rawTraits) {
    if (!t || typeof t.name !== 'string' || !t.name.trim()) continue
    const score = clampScore(t.score)
    if (score === null) continue
    traits.push({
      name: t.name.trim(),
      score,
      copy: typeof t.copy === 'string' ? t.copy : '',
      description: typeof t.description === 'string' ? t.description : '',
    })
  }
  if (traits.length < 3) return { ok: false, reason: `archetype_traits が3項目未満（${traits.length}）` }
  const traitItems = traits.slice(0, 5)
  if (new Set(traitItems.map(t => t.score)).size === 1) {
    warnings.push('archetype_traits: 全項目が同点')
  }

  // --- テキスト必須項目 ---
  const summary = typeof parsed.personality_summary === 'string' ? parsed.personality_summary.trim() : ''
  const style = typeof parsed.communication_style === 'string' ? parsed.communication_style.trim() : ''
  if (!summary) return { ok: false, reason: 'personality_summary が空' }
  if (!style) return { ok: false, reason: 'communication_style が空' }

  // --- expected_tags: 8語クローズドリスト（確定的検証＝リトライ対象） ---
  const rawTags = Array.isArray(parsed.expected_tags) ? parsed.expected_tags : []
  const tags = [...new Set(rawTags.filter((t): t is string => typeof t === 'string' && TAG_SET.has(t)))]
  if (tags.length < 2) return { ok: false, reason: `expected_tags の有効語が2未満（${JSON.stringify(rawTags)}）` }
  const expectedTags = tags.slice(0, 3)

  // --- tone_rules: 最大3本・必須フィールド欠落は除外（警告） ---
  const rawRules = Array.isArray(parsed.tone_rules) ? parsed.tone_rules as Record<string, unknown>[] : []
  const toneRules: ToneRule[] = []
  for (const r of rawRules) {
    if (!r) continue
    const ruleText = typeof r.rule_text === 'string' ? r.rule_text.trim() : ''
    const ng = typeof r.ng_example === 'string' ? r.ng_example.trim() : ''
    const ok = typeof r.ok_example === 'string' ? r.ok_example.trim() : ''
    if (!ruleText || !ng || !ok) {
      warnings.push('tone_rules: 必須フィールド欠落のルールを除外')
      continue
    }
    const severity = typeof r.severity === 'string' && SEVERITIES.has(r.severity)
      ? (r.severity as ToneRule['severity'])
      : 'medium'
    toneRules.push({ rule_text: ruleText, ng_example: ng, ok_example: ok, severity })
    if (toneRules.length >= 3) break
  }

  return {
    ok: true,
    warnings,
    result: {
      aaker_scores: aakerScores,
      archetype: { primary, secondary },
      archetype_traits: traitItems,
      personality_summary: summary,
      communication_style: style,
      expected_tags: expectedTags,
      tone_rules: toneRules,
    },
  }
}
