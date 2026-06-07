// AI競合提案の共通ロジック（管理画面 /admin/company と STPツール で共用）
// - web_search で実在の競合を検索・提案
// - 月次利用上限（COMPETITOR_SUGGEST_MONTHLY_LIMIT・JST月初基準）を ai_feature_usage で管理
// - 同一 feature_key を使うため、競合提案の月次クォータは「1社あたり」で全画面共通
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { callClaudeWithWebSearch } from '@/lib/claude-api'
import { COMPETITOR_SUGGEST_MONTHLY_LIMIT } from '@/lib/constants/ai-limits'

export const COMPETITOR_FEATURE_KEY = 'competitor_suggest'
const JST_OFFSET_MS = 9 * 60 * 60 * 1000

export type CompetitorSuggestion = { name: string; url: string; reason: string }
export type ExistingCompetitor = { name?: string; url?: string }

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

// 社名正規化（前後空白除去＋小文字化）
export function normName(s: string): string {
  return (s || '').trim().toLowerCase()
}

// URLのホスト名正規化（https?:// ・ www. ・パス・末尾/ を除去）
export function normHost(u: string): string {
  let h = (u || '').trim().toLowerCase()
  if (!h) return ''
  h = h.replace(/^https?:\/\//, '').replace(/^www\./, '')
  h = h.split(/[/?#]/)[0]
  return h.replace(/\/$/, '')
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
    .eq('feature_key', COMPETITOR_FEATURE_KEY)
    .gte('used_at', monthStartIso)

  if (error) {
    console.error('[competitors] 利用回数カウントエラー:', error)
    return { count: 0, error: true }
  }
  return { count: count ?? 0, error: false }
}

// 残り回数・リセット日時（消費しない）
export async function getCompetitorRemaining(
  companyId: string,
): Promise<{ remaining: number; limit: number; resetsAt: string } | { error: true }> {
  const supabase = getSupabaseAdmin()
  const { monthStartIso, nextMonthStartIso } = getMonthBoundsJst()
  const { count, error } = await countUsage(supabase, companyId, monthStartIso)
  if (error) return { error: true }
  return {
    remaining: Math.max(0, COMPETITOR_SUGGEST_MONTHLY_LIMIT - count),
    limit: COMPETITOR_SUGGEST_MONTHLY_LIMIT,
    resetsAt: nextMonthStartIso,
  }
}

const SYSTEM_PROMPT = `あなたは日本市場に精通したブランド戦略コンサルタントです。
与えられた企業情報をもとに、web_search ツールで実在を確認しながら「実在する」競合企業・サービスを調査して提案します。

# 厳守事項
- 必ず web_search ツールで実在と公式URLを確認すること。内部知識のみの推測で提案してはいけない。
- 実在が確認できない企業・サービス、または公式URLが不確実なものは提案に含めないこと。
- 提案は3〜6社。対象企業と実際に競合しうる事業者・サービスに限ること。
- 「除外リスト」に挙げた企業は提案に含めないこと。
- 各社について次を示すこと:
  - name: 正式名称
  - url: 公式トップページのURL（https://から始まる）
  - reason: なぜ競合か。日本語40字程度の一文。

# 出力形式
検索の途中経過を書いたあと、最後に必ず次の形式の \`\`\`json コードブロックを「1つだけ」出力すること（このブロックの後ろに説明文を付けない）。
\`\`\`json
{ "suggestions": [{ "name": "...", "url": "https://...", "reason": "..." }] }
\`\`\``

// プロンプト本文を組み立てる
function buildUserMessage(brandInfo: Record<string, unknown>, existingNames: string[]): string {
  return [
    '# 対象企業の情報',
    JSON.stringify(brandInfo, null, 2),
    '',
    '# 除外リスト（既に登録済みの競合。これらは提案に含めない）',
    existingNames.length > 0 ? existingNames.join('、') : '（なし）',
    '',
    '上記の企業と競合する実在の企業・サービスを、web_search で確認のうえ3〜6社提案してください。',
  ].join('\n')
}

// Claude応答から ```json を抽出 → パース → 既存/候補内の重複を除外。
// パース失敗 or 候補0件（AIが何も返さなかった）の場合は null を返す（＝失敗扱い・カウントしない）。
function parseAndDedupe(
  response: string,
  existing: ExistingCompetitor[],
): CompetitorSuggestion[] | null {
  const matches = [...response.matchAll(/```json\s*([\s\S]*?)\s*```/g)]
  const jsonStr = matches.length > 0 ? matches[matches.length - 1][1] : response.trim()

  let parsed: { suggestions?: Array<{ name?: string; url?: string; reason?: string }> }
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    console.error('[competitors] JSONパース失敗:', response.substring(0, 500))
    return null
  }

  const raw = Array.isArray(parsed.suggestions) ? parsed.suggestions : []
  if (raw.length === 0) {
    console.error('[competitors] 提案が0件:', response.substring(0, 500))
    return null
  }

  const existingNameSet = new Set(existing.map(c => normName(c.name || '')).filter(Boolean))
  const existingHostSet = new Set(existing.map(c => normHost(c.url || '')).filter(Boolean))
  const seenNames = new Set<string>()
  const seenHosts = new Set<string>()

  return raw
    .filter(s => s && typeof s.name === 'string' && s.name.trim() && typeof s.url === 'string' && s.url.trim())
    .map(s => ({ name: s.name!.trim(), url: s.url!.trim(), reason: (s.reason || '').trim() }))
    .filter(s => {
      const n = normName(s.name)
      const h = normHost(s.url)
      if (existingNameSet.has(n)) return false
      if (h && existingHostSet.has(h)) return false
      if (seenNames.has(n)) return false
      if (h && seenHosts.has(h)) return false
      seenNames.add(n)
      if (h) seenHosts.add(h)
      return true
    })
}

export type SuggestResult =
  | { status: 'limit'; resetsAt: string }
  | { status: 'error' }
  | { status: 'ok'; suggestions: CompetitorSuggestion[]; remaining: number; resetsAt: string }

// 競合提案の本体。上限チェック → web_search → パース/重複除外 → 成功時のみ利用ログINSERT。
export async function generateCompetitorSuggestions(params: {
  companyId: string
  brandInfo: Record<string, unknown>
  existingCompetitors: ExistingCompetitor[]
}): Promise<SuggestResult> {
  const supabase = getSupabaseAdmin()
  const { monthStartIso, nextMonthStartIso } = getMonthBoundsJst()

  const { count: usedCount, error: countError } = await countUsage(supabase, params.companyId, monthStartIso)
  if (countError) return { status: 'error' }
  if (usedCount >= COMPETITOR_SUGGEST_MONTHLY_LIMIT) {
    return { status: 'limit', resetsAt: nextMonthStartIso }
  }

  const existingNames = params.existingCompetitors.map(c => (c.name || '').trim()).filter(Boolean)
  const userMessage = buildUserMessage(params.brandInfo, existingNames)

  let response: string
  try {
    response = await callClaudeWithWebSearch({
      system: SYSTEM_PROMPT,
      userMessage,
      maxTokens: 2048,
      maxSearchUses: 5,
    })
  } catch (err) {
    console.error('[competitors] Claude/web_search エラー:', err)
    return { status: 'error' }
  }

  const suggestions = parseAndDedupe(response, params.existingCompetitors)
  if (suggestions === null) return { status: 'error' }

  // 成功時のみ利用ログを INSERT（INSERT失敗は致命的でないためログのみ）
  const { error: insertError } = await supabase.from('ai_feature_usage').insert({
    company_id: params.companyId,
    feature_key: COMPETITOR_FEATURE_KEY,
    metadata: { count: suggestions.length },
  })
  if (insertError) console.error('[competitors] 利用ログINSERTエラー:', insertError)

  return {
    status: 'ok',
    suggestions,
    remaining: Math.max(0, COMPETITOR_SUGGEST_MONTHLY_LIMIT - (usedCount + 1)),
    resetsAt: nextMonthStartIso,
  }
}
