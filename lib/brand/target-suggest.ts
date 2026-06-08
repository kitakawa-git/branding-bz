// AIターゲット提案の共通ロジック（管理画面 /admin/brand/strategy と STPツール で共用）
// - web_search は使わない（ターゲット像は内部知識で論理生成）。通常の callClaude を使用
// - 月次利用上限（TARGET_SUGGEST_MONTHLY_LIMIT・JST月初基準）を ai_feature_usage で管理
// - feature_key='target_suggest' を管理画面・STPで共有 → クォータは「1社あたり」共通
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { callClaude } from '@/lib/claude-api'
import { getGuardrailsPromptForCompany } from '@/lib/brand/guardrails'
import { TARGET_SUGGEST_MONTHLY_LIMIT } from '@/lib/constants/ai-limits'

export const TARGET_FEATURE_KEY = 'target_suggest'
const JST_OFFSET_MS = 9 * 60 * 60 * 1000

export type TargetSuggestion = { name: string; description: string }
export type ExistingTarget = { name?: string }

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>

// JSTの「今月1日00:00」と「翌月1日00:00」を UTC の ISO8601 で返す
export function getMonthBoundsJst(): { monthStartIso: string; nextMonthStartIso: string } {
  const now = new Date()
  const jstNow = new Date(now.getTime() + JST_OFFSET_MS)
  const y = jstNow.getUTCFullYear()
  const m = jstNow.getUTCMonth() // 0始まり
  const monthStartIso = new Date(Date.UTC(y, m, 1, 0, 0, 0) - JST_OFFSET_MS).toISOString()
  const nextMonthStartIso = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0) - JST_OFFSET_MS).toISOString()
  return { monthStartIso, nextMonthStartIso }
}

// 名前正規化（前後空白除去＋小文字化）
export function normName(s: string): string {
  return (s || '').trim().toLowerCase()
}

// その月の利用回数をカウント
async function countUsage(
  supabase: SupabaseAdmin,
  companyId: string,
  monthStartIso: string,
): Promise<{ count: number; error: boolean }> {
  const { count, error } = await supabase
    .from('ai_feature_usage')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('feature_key', TARGET_FEATURE_KEY)
    .gte('used_at', monthStartIso)

  if (error) {
    console.error('[targets] 利用回数カウントエラー:', error)
    return { count: 0, error: true }
  }
  return { count: count ?? 0, error: false }
}

// 残り回数・リセット日時（消費しない）
export async function getTargetRemaining(
  companyId: string,
): Promise<{ remaining: number; limit: number; resetsAt: string } | { error: true }> {
  const supabase = getSupabaseAdmin()
  const { monthStartIso, nextMonthStartIso } = getMonthBoundsJst()
  const { count, error } = await countUsage(supabase, companyId, monthStartIso)
  if (error) return { error: true }
  return {
    remaining: Math.max(0, TARGET_SUGGEST_MONTHLY_LIMIT - count),
    limit: TARGET_SUGGEST_MONTHLY_LIMIT,
    resetsAt: nextMonthStartIso,
  }
}

const SYSTEM_PROMPT = `あなたは日本市場に精通したブランド戦略コンサルタントです。
与えられた企業のブランド情報をもとに、狙うべきターゲット顧客セグメントを論理的に提案します。

# 厳守事項
- 提案は3〜5案。各案は対象企業の事業・提供価値と整合し、実在しうる現実的な顧客像にすること。
- 「除外リスト」に挙げた既存ターゲットと重複しない、新規の切り口の案を出すこと。
- 各案について次を示すこと:
  - name: 簡潔なターゲット名。年齢・職種・状況などの属性を含めて具体的に（例: 「DX推進を任された30代の情報システム担当」）。
  - description: 2〜3文の具体的な顧客像（抱える課題・ニーズ・意思決定の特徴など）。

# 出力形式
簡単な前置きのあと、最後に必ず次の形式の \`\`\`json コードブロックを「1つだけ」出力すること（このブロックの後ろに説明文を付けない）。
\`\`\`json
{ "suggestions": [{ "name": "...", "description": "..." }] }
\`\`\``

// プロンプト本文を組み立てる
function buildUserMessage(brandInfo: Record<string, unknown>, existingNames: string[]): string {
  return [
    '# 対象企業のブランド情報',
    JSON.stringify(brandInfo, null, 2),
    '',
    '# 除外リスト（既に登録済みのターゲット。これらと重複しない新規案を出す）',
    existingNames.length > 0 ? existingNames.join('、') : '（なし）',
    '',
    '上記をもとに、狙うべきターゲット顧客セグメントを3〜5案提案してください。',
  ].join('\n')
}

// Claude応答から ```json を抽出 → パース → 既存/候補内の重複を除外（name基準）。
// パース失敗 or 候補0件の場合は null を返す（＝失敗扱い・カウントしない）。
function parseAndDedupe(
  response: string,
  existing: ExistingTarget[],
): TargetSuggestion[] | null {
  const matches = [...response.matchAll(/```json\s*([\s\S]*?)\s*```/g)]
  const jsonStr = matches.length > 0 ? matches[matches.length - 1][1] : response.trim()

  let parsed: { suggestions?: Array<{ name?: string; description?: string }> }
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    console.error('[targets] JSONパース失敗:', response.substring(0, 500))
    return null
  }

  const raw = Array.isArray(parsed.suggestions) ? parsed.suggestions : []
  if (raw.length === 0) {
    console.error('[targets] 提案が0件:', response.substring(0, 500))
    return null
  }

  const existingNameSet = new Set(existing.map(t => normName(t.name || '')).filter(Boolean))
  const seenNames = new Set<string>()

  return raw
    .filter(s => s && typeof s.name === 'string' && s.name.trim())
    .map(s => ({ name: s.name!.trim(), description: (s.description || '').trim() }))
    .filter(s => {
      const n = normName(s.name)
      if (existingNameSet.has(n)) return false
      if (seenNames.has(n)) return false
      seenNames.add(n)
      return true
    })
}

export type TargetSuggestResult =
  | { status: 'limit'; resetsAt: string }
  | { status: 'error' }
  | { status: 'ok'; suggestions: TargetSuggestion[]; remaining: number; resetsAt: string }

// ターゲット提案の本体。上限チェック → Claude（web_searchなし） → パース/重複除外 → 成功時のみ利用ログINSERT。
export async function generateTargetSuggestions(params: {
  companyId: string
  brandInfo: Record<string, unknown>
  existingTargets: ExistingTarget[]
}): Promise<TargetSuggestResult> {
  const supabase = getSupabaseAdmin()
  const { monthStartIso, nextMonthStartIso } = getMonthBoundsJst()

  // 上限チェック
  const { count: usedCount, error: countError } = await countUsage(supabase, params.companyId, monthStartIso)
  if (countError) return { status: 'error' }
  if (usedCount >= TARGET_SUGGEST_MONTHLY_LIMIT) {
    return { status: 'limit', resetsAt: nextMonthStartIso }
  }

  const existingNames = params.existingTargets.map(t => (t.name || '').trim()).filter(Boolean)
  const userMessage = buildUserMessage(params.brandInfo, existingNames)

  // ブランドガードレール（証拠・表現ルール）を system に注入。company未解決・0件・取得失敗なら従来どおり SYSTEM_PROMPT のまま。
  // 表現ルールはコピー全般に効くため scope で絞らず全件注入する（severity で block/warn を区別）。
  const guardrails = await getGuardrailsPromptForCompany(params.companyId)
  const system = guardrails ? `${SYSTEM_PROMPT}\n\n${guardrails}` : SYSTEM_PROMPT

  let response: string
  try {
    response = await callClaude({ system, userMessage, maxTokens: 2048 })
  } catch (err) {
    console.error('[targets] Claude エラー:', err)
    return { status: 'error' }
  }

  const suggestions = parseAndDedupe(response, params.existingTargets)
  if (suggestions === null) return { status: 'error' }

  // 成功時のみ利用ログを INSERT（INSERT失敗は致命的でないためログのみ）
  const { error: insertError } = await supabase.from('ai_feature_usage').insert({
    company_id: params.companyId,
    feature_key: TARGET_FEATURE_KEY,
    metadata: { count: suggestions.length },
  })
  if (insertError) console.error('[targets] 利用ログINSERTエラー:', insertError)

  return {
    status: 'ok',
    suggestions,
    remaining: Math.max(0, TARGET_SUGGEST_MONTHLY_LIMIT - (usedCount + 1)),
    resetsAt: nextMonthStartIso,
  }
}
