// ペルソナビルダー ゴール・課題提案API
// POST /api/tools/persona/suggest-goals
import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude-api'

const SYSTEM_PROMPT = `あなたはブランドマーケティングの専門家です。以下のペルソナのデモグラフィック情報と企業情報をもとに、このペルソナの目標・課題・購買行動を深掘りしてください。回答はJSON形式のみで、前後に説明文やマークダウンのコードブロックを含めないでください。

出力JSONスキーマ:
{
  "primary_goals": ["主な目標1", "主な目標2", "主な目標3"],
  "challenges": ["課題・悩み1", "課題・悩み2", "課題・悩み3"],
  "pain_points": ["ペインポイント1", "ペインポイント2", "ペインポイント3"],
  "buying_motivation": "購買の動機（2〜3文）",
  "buying_barriers": ["購買の障壁1", "購買の障壁2", "購買の障壁3"],
  "decision_factors": ["意思決定要因1", "意思決定要因2", "意思決定要因3"],
  "brand_expectations": "このブランドに期待すること（2〜3文）",
  "success_definition": "この人にとっての成功とは（1〜2文）"
}`

export async function POST(request: NextRequest) {
  console.log('[SuggestGoals] ===== API呼び出し開始 =====')

  try {
    const body = await request.json()
    const { basic_info, demographics } = body

    if (!basic_info || !demographics) {
      return NextResponse.json({ error: 'basic_info と demographics が必要です' }, { status: 400 })
    }

    const parts: string[] = []
    parts.push('## 企業情報')
    if (basic_info.company_name) parts.push(`- 企業名: ${basic_info.company_name}`)
    if (basic_info.industry_category) parts.push(`- 業種: ${basic_info.industry_category}`)
    if (basic_info.products) parts.push(`- 事業内容: ${basic_info.products}`)

    parts.push('')
    parts.push('## ペルソナ（デモグラフィック）')
    if (demographics.persona_name) parts.push(`- 名前: ${demographics.persona_name}`)
    if (demographics.age) parts.push(`- 年齢: ${demographics.age}歳`)
    if (demographics.gender) parts.push(`- 性別: ${demographics.gender}`)
    if (demographics.occupation) parts.push(`- 職業: ${demographics.occupation}`)
    if (demographics.company_role) parts.push(`- 役職: ${demographics.company_role}`)
    if (demographics.location) parts.push(`- 居住地: ${demographics.location}`)
    if (demographics.annual_income) parts.push(`- 年収: ${demographics.annual_income}`)
    if (demographics.family) parts.push(`- 家族構成: ${demographics.family}`)
    if (demographics.personality_traits?.length) parts.push(`- 性格: ${demographics.personality_traits.join('、')}`)
    if (demographics.quote) parts.push(`- 口癖: 「${demographics.quote}」`)

    parts.push('')
    parts.push('上記のペルソナが抱える目標・課題・購買行動をJSON形式で提案してください。')

    const response = await callClaude({
      system: SYSTEM_PROMPT,
      userMessage: parts.join('\n'),
      maxTokens: 2000,
    })

    let jsonStr = response.trim()
    const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch) jsonStr = jsonMatch[1]

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      console.error('[SuggestGoals] JSONパースエラー:', response.substring(0, 300))
      return NextResponse.json(
        { error: 'AIの応答を解析できませんでした。再度お試しください。' },
        { status: 500 }
      )
    }

    console.log('[SuggestGoals] ===== 提案完了 =====')
    return NextResponse.json({ goals: parsed })
  } catch (err) {
    console.error('[SuggestGoals] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
