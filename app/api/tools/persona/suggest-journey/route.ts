// ペルソナビルダー ジャーニーマップ提案API
// POST /api/tools/persona/suggest-journey
import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude-api'
import { getAdminContext } from '@/lib/learning/auth'
import { getGuardrailsPromptForCompany } from '@/lib/brand/guardrails'

const SYSTEM_PROMPT = `あなたはブランドマーケティングの専門家です。以下のペルソナ情報をもとに、5段階のカスタマージャーニーマップを作成してください。回答はJSON形式のみで、前後に説明文やマークダウンのコードブロックを含めないでください。

5段階: 認知 → 興味 → 検討 → 購入 → 継続

出力JSONスキーマ:
{
  "stages": [
    {
      "name": "認知",
      "description": "このステージの概要（1文）",
      "actions": ["行動1", "行動2", "行動3"],
      "touchpoints": ["タッチポイント1", "タッチポイント2"],
      "emotions": "感情の状態（1文）",
      "emotion_score": 数値（-2〜2、-2=非常にネガティブ、2=非常にポジティブ）,
      "pain_points": ["この段階での課題1", "この段階での課題2"],
      "opportunities": ["ブランドが提供できる価値1", "ブランドが提供できる価値2"]
    }
  ]
}`

// 構造化データをプロンプト用テキストに変換
function formatBusinessDescriptions(basicInfo: Record<string, unknown>): string {
  const descs = basicInfo.business_descriptions as Array<{ title: string; description: string }> | undefined
  if (descs?.length) {
    return descs
      .filter(b => b.title?.trim())
      .map(b => b.description ? `${b.title}: ${b.description}` : b.title)
      .join('、')
  }
  if (basicInfo.products && typeof basicInfo.products === 'string') {
    return basicInfo.products as string
  }
  return ''
}

export async function POST(request: NextRequest) {

  try {
    const body = await request.json()
    const { basic_info, demographics, goals } = body

    if (!basic_info || !demographics) {
      return NextResponse.json({ error: 'basic_info と demographics が必要です' }, { status: 400 })
    }

    const parts: string[] = []
    parts.push('## 企業情報')
    if (basic_info.company_name) parts.push(`- 企業名: ${basic_info.company_name}`)
    if (basic_info.industry_category) parts.push(`- 業種: ${basic_info.industry_category}`)

    const bizText = formatBusinessDescriptions(basic_info)
    if (bizText) parts.push(`- 事業内容: ${bizText}`)

    parts.push('')
    parts.push('## ペルソナ')
    if (demographics.persona_name) parts.push(`- 名前: ${demographics.persona_name}（${demographics.age}歳・${demographics.gender}）`)
    if (demographics.occupation) parts.push(`- 職業: ${demographics.occupation}`)
    if (demographics.company_role) parts.push(`- 役職: ${demographics.company_role}`)
    if (demographics.media_channels?.length) parts.push(`- 情報収集: ${demographics.media_channels.join('、')}`)

    if (goals) {
      parts.push('')
      parts.push('## ゴール・課題')
      if (goals.primary_goals?.length) parts.push(`- 目標: ${goals.primary_goals.join('、')}`)
      if (goals.challenges?.length) parts.push(`- 課題: ${goals.challenges.join('、')}`)
      if (goals.buying_motivation) parts.push(`- 購買動機: ${goals.buying_motivation}`)
      if (goals.buying_barriers?.length) parts.push(`- 購買障壁: ${goals.buying_barriers.join('、')}`)
    }

    parts.push('')
    parts.push('上記のペルソナの5段階カスタマージャーニーマップをJSON形式で作成してください。')

    // ブランドガードレール（証拠・表現ルール）を注入。company未解決・0件なら従来どおり（既存挙動維持）。
    const guardrailCtx = await getAdminContext()
    const guardrails = guardrailCtx
      ? await getGuardrailsPromptForCompany(guardrailCtx.companyId)
      : ''
    const system = guardrails ? `${SYSTEM_PROMPT}\n\n${guardrails}` : SYSTEM_PROMPT

    const response = await callClaude({
      system,
      userMessage: parts.join('\n'),
      maxTokens: 3000,
    })

    let jsonStr = response.trim()
    const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch) jsonStr = jsonMatch[1]

    let parsed: { stages: unknown[] }
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      console.error('[SuggestJourney] JSONパースエラー:', response.substring(0, 300))
      return NextResponse.json(
        { error: 'AIの応答を解析できませんでした。再度お試しください。' },
        { status: 500 }
      )
    }

    if (!parsed.stages || !Array.isArray(parsed.stages)) {
      return NextResponse.json(
        { error: 'AIの応答形式が不正です。再度お試しください。' },
        { status: 500 }
      )
    }

    return NextResponse.json({ journey: parsed })
  } catch (err) {
    console.error('[SuggestJourney] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
