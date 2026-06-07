// AI競合提案API
// POST /api/admin/competitors/suggest — web_search で実在の競合を検索・提案（月1回上限）
// GET  /api/admin/competitors/suggest — 今月の残り回数・リセット日時を返す（UI初期表示用）
//
// 認証: cookie セッションから getAdminContext() で company_id を解決。
//       クライアントから送られた company_id は使わない。
// 上限: COMPETITOR_SUGGEST_MONTHLY_LIMIT（月初=JST 1日00:00 以降の利用回数でカウント）。
//       成功時のみ ai_feature_usage に INSERT（失敗回はカウントしない）。

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminContext } from '@/lib/learning/auth'
import { callClaudeWithWebSearch } from '@/lib/claude-api'
import { COMPETITOR_SUGGEST_MONTHLY_LIMIT } from '@/lib/constants/ai-limits'

const FEATURE_KEY = 'competitor_suggest'
const JST_OFFSET_MS = 9 * 60 * 60 * 1000

// JSTの「今月1日00:00」と「翌月1日00:00」を UTC の ISO8601 で返す
function getMonthBoundsJst(): { monthStartIso: string; nextMonthStartIso: string } {
  const now = new Date()
  const jstNow = new Date(now.getTime() + JST_OFFSET_MS)
  const y = jstNow.getUTCFullYear()
  const m = jstNow.getUTCMonth() // 0始まり
  // Date.UTC で算出した「JSTカレンダー上の月初」を UTC 実時刻へ変換（-9h）
  const monthStartIso = new Date(Date.UTC(y, m, 1, 0, 0, 0) - JST_OFFSET_MS).toISOString()
  const nextMonthStartIso = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0) - JST_OFFSET_MS).toISOString()
  return { monthStartIso, nextMonthStartIso }
}

// 社名正規化（前後空白除去＋小文字化）
function normName(s: string): string {
  return (s || '').trim().toLowerCase()
}

// URLのホスト名正規化（https?:// ・ www. ・末尾/ を除去）
function normHost(u: string): string {
  let h = (u || '').trim().toLowerCase()
  if (!h) return ''
  h = h.replace(/^https?:\/\//, '').replace(/^www\./, '')
  h = h.split(/[/?#]/)[0] // パス・クエリ・フラグメントを除去
  return h.replace(/\/$/, '')
}

// その月の利用回数をカウント
async function countUsage(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  companyId: string,
  monthStartIso: string,
): Promise<{ count: number; error: boolean }> {
  const { count, error } = await supabase
    .from('ai_feature_usage')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('feature_key', FEATURE_KEY)
    .gte('used_at', monthStartIso)

  if (error) {
    console.error('[competitors/suggest] 利用回数カウントエラー:', error)
    return { count: 0, error: true }
  }
  return { count: count ?? 0, error: false }
}

// GET: 残り回数とリセット日時を返す（消費しない）
export async function GET() {
  const ctx = await getAdminContext()
  if (!ctx) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const supabase = getSupabaseAdmin()
  const { monthStartIso, nextMonthStartIso } = getMonthBoundsJst()
  const { count, error } = await countUsage(supabase, ctx.companyId, monthStartIso)
  if (error) {
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }

  const remaining = Math.max(0, COMPETITOR_SUGGEST_MONTHLY_LIMIT - count)
  return NextResponse.json({
    remaining,
    limit: COMPETITOR_SUGGEST_MONTHLY_LIMIT,
    resetsAt: nextMonthStartIso,
  })
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

// POST: 競合を提案
export async function POST() {
  const ctx = await getAdminContext()
  if (!ctx) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }
  const companyId = ctx.companyId
  const supabase = getSupabaseAdmin()
  const { monthStartIso, nextMonthStartIso } = getMonthBoundsJst()

  // 上限チェック
  const { count: usedCount, error: countError } = await countUsage(supabase, companyId, monthStartIso)
  if (countError) {
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
  if (usedCount >= COMPETITOR_SUGGEST_MONTHLY_LIMIT) {
    return NextResponse.json(
      { error: 'limit_reached', resetsAt: nextMonthStartIso },
      { status: 429 },
    )
  }

  // 入力データ収集（取れるものだけ。最小は name ＋業種）
  const [companyResult, guidelinesResult, personaResult] = await Promise.allSettled([
    supabase
      .from('companies')
      .select('name, industry_category, industry_subcategory, brand_stage, website_url, competitors, target_segments')
      .eq('id', companyId)
      .maybeSingle(),
    supabase
      .from('brand_guidelines')
      .select('business_content, mission, vision')
      .eq('company_id', companyId)
      .maybeSingle(),
    supabase
      .from('brand_personas')
      .select('target')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const company = companyResult.status === 'fulfilled' ? companyResult.value.data : null
  const guidelines = guidelinesResult.status === 'fulfilled' ? guidelinesResult.value.data : null
  const persona = personaResult.status === 'fulfilled' ? personaResult.value.data : null

  if (!company) {
    return NextResponse.json({ error: '企業データが見つかりません' }, { status: 404 })
  }

  // 既存競合（重複除外用）
  const existingCompetitors: Array<{ name?: string; url?: string }> = Array.isArray(company.competitors)
    ? (company.competitors as Array<{ name?: string; url?: string }>)
    : []
  const existingNames = existingCompetitors.map(c => (c.name || '').trim()).filter(Boolean)
  const existingNameSet = new Set(existingCompetitors.map(c => normName(c.name || '')).filter(Boolean))
  const existingHostSet = new Set(existingCompetitors.map(c => normHost(c.url || '')).filter(Boolean))

  // ブランド情報（あるものだけ載せる）
  const brandInfo: Record<string, unknown> = { 企業名: company.name || '未設定' }
  if (company.industry_category) brandInfo['業種（大分類）'] = company.industry_category
  if (company.industry_subcategory) brandInfo['業種（小分類）'] = company.industry_subcategory
  if (company.brand_stage) brandInfo['ブランドステージ'] = company.brand_stage
  if (company.website_url) brandInfo['ウェブサイト'] = company.website_url

  const businessContent = Array.isArray(guidelines?.business_content)
    ? (guidelines.business_content as Array<{ title?: string; description?: string }>)
        .map(c => [c.title, c.description].filter(Boolean).join('：'))
        .filter(Boolean)
    : []
  if (businessContent.length > 0) brandInfo['事業内容'] = businessContent
  if (guidelines?.mission) brandInfo['ミッション'] = guidelines.mission
  if (guidelines?.vision) brandInfo['ビジョン'] = guidelines.vision

  const targetSegments = Array.isArray(company.target_segments)
    ? (company.target_segments as Array<{ name?: string; description?: string }>)
        .map(ts => [ts.name, ts.description].filter(Boolean).join('：'))
        .filter(Boolean)
    : []
  if (targetSegments.length > 0) brandInfo['ターゲット層'] = targetSegments
  else if (persona?.target) brandInfo['ターゲット層'] = persona.target

  const userMessage = [
    '# 対象企業の情報',
    JSON.stringify(brandInfo, null, 2),
    '',
    '# 除外リスト（既に登録済みの競合。これらは提案に含めない）',
    existingNames.length > 0 ? existingNames.join('、') : '（なし）',
    '',
    '上記の企業と競合する実在の企業・サービスを、web_search で確認のうえ3〜6社提案してください。',
  ].join('\n')

  // Claude API（web_search）呼び出し
  let response: string
  try {
    response = await callClaudeWithWebSearch({
      system: SYSTEM_PROMPT,
      userMessage,
      maxTokens: 2048,
      maxSearchUses: 5,
    })
  } catch (err) {
    console.error('[competitors/suggest] Claude/web_search エラー:', err)
    return NextResponse.json({ error: '競合の提案に失敗しました' }, { status: 500 })
  }

  // 末尾の ```json ブロックを抽出してパース（複数ある場合は最後を採用）
  const matches = [...response.matchAll(/```json\s*([\s\S]*?)\s*```/g)]
  const jsonStr = matches.length > 0 ? matches[matches.length - 1][1] : response.trim()

  let parsed: { suggestions?: Array<{ name?: string; url?: string; reason?: string }> }
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    console.error('[competitors/suggest] JSONパース失敗:', response.substring(0, 500))
    return NextResponse.json({ error: '競合の提案に失敗しました' }, { status: 500 })
  }

  const rawSuggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : []
  // AIが何も返さなかった（実在確認できず0件）場合は失敗扱い＝カウントしない
  if (rawSuggestions.length === 0) {
    console.error('[competitors/suggest] 提案が0件でした:', response.substring(0, 500))
    return NextResponse.json({ error: '競合の提案に失敗しました' }, { status: 500 })
  }

  // サーバー側でも重複除外（既存競合＋候補内の重複）
  const seenNames = new Set<string>()
  const seenHosts = new Set<string>()
  const suggestions = rawSuggestions
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

  // 成功時のみ利用ログを INSERT（INSERT失敗は致命的でないためログのみ）
  const { error: insertError } = await supabase.from('ai_feature_usage').insert({
    company_id: companyId,
    feature_key: FEATURE_KEY,
    metadata: { count: suggestions.length },
  })
  if (insertError) {
    console.error('[competitors/suggest] 利用ログINSERTエラー:', insertError)
  }

  const remaining = Math.max(0, COMPETITOR_SUGGEST_MONTHLY_LIMIT - (usedCount + 1))
  return NextResponse.json({
    suggestions,
    remaining,
    resetsAt: nextMonthStartIso,
  })
}
