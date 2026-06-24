// ペルソナビルダー ゴール・課題提案API
// POST /api/tools/persona/suggest-goals
import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude-api'
import { getAdminContext } from '@/lib/learning/auth'
import { getGuardrailsPromptForCompany } from '@/lib/brand/guardrails'
import { getRelationsPromptForCompany } from '@/lib/brand/relations'

const SYSTEM_PROMPT = `あなたはブランドマーケティングの専門家です。以下のペルソナのデモグラフィック情報と企業情報をもとに、このペルソナの目標・課題・購買行動を深掘りしてください。回答はJSON形式のみで、前後に説明文やマークダウンのコードブロックを含めないでください。

重要（primary_goals / pain_points の各項目の制約）:
- 1項目＝1フレーズ、体言止め、目安20字以内で簡潔に。
- 「DX推進」「生産性向上」のような抽象的な決まり文句は避け、具体的だが短く。
- 良い例:「IT専任者がいない」「費用対効果が見えにくい」「採用で自社を語れない」「理念が形骸化している」。
- primary_goals は「ニーズ」（このペルソナが満たしたい欲求・目標）。課題・悩みもペインポイントも、すべて pain_points に短い体言止めでまとめる（challenges は出力しない）。

出力JSONスキーマ:
{
  "primary_goals": ["ニーズ（短い体言止め・20字以内）", "...", "..."],
  "pain_points": ["課題・ペインポイント（短い体言止め・20字以内）", "...", "..."],
  "buying_motivation": "購買の動機（2〜3文）",
  "buying_barriers": ["購買の障壁1", "購買の障壁2", "購買の障壁3"],
  "decision_factors": ["意思決定要因1", "意思決定要因2", "意思決定要因3"],
  "brand_expectations": "このブランドに期待すること（2〜3文）"
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

function formatTargetSegments(basicInfo: Record<string, unknown>): string {
  const segs = basicInfo.target_segments as Array<{ name: string; description: string }> | undefined
  if (segs?.length) {
    return segs
      .filter(ts => ts.name?.trim())
      .map(ts => ts.description ? `${ts.name}: ${ts.description}` : ts.name)
      .join('、')
  }
  if (basicInfo.target_description && typeof basicInfo.target_description === 'string') {
    return basicInfo.target_description as string
  }
  return ''
}

export async function POST(request: NextRequest) {

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

    const bizText = formatBusinessDescriptions(basic_info)
    if (bizText) parts.push(`- 事業内容: ${bizText}`)

    const targetText = formatTargetSegments(basic_info)
    if (targetText) parts.push(`- ターゲット: ${targetText}`)

    parts.push('')
    parts.push('## ペルソナ（デモグラフィック）')
    if (demographics.persona_name) parts.push(`- 名前: ${demographics.persona_name}`)
    if (demographics.age) parts.push(`- 年齢: ${demographics.age}歳`)
    if (demographics.gender) parts.push(`- 性別: ${demographics.gender}`)
    if (demographics.occupation) parts.push(`- 職業: ${demographics.occupation}`)
    if (demographics.company_role) parts.push(`- 役職: ${demographics.company_role}`)
    if (demographics.annual_income) parts.push(`- 年収: ${demographics.annual_income}`)
    if (demographics.family) parts.push(`- 家族構成: ${demographics.family}`)
    if (demographics.personality_traits?.length) parts.push(`- 性格: ${demographics.personality_traits.join('、')}`)

    parts.push('')
    parts.push('上記のペルソナが抱える目標・課題・購買行動をJSON形式で提案してください。')

    // ブランドガードレール（証拠・表現ルール）を注入。company未解決・0件なら従来どおり（既存挙動維持）。
    const guardrailCtx = await getAdminContext()
    const guardrails = guardrailCtx
      ? await getGuardrailsPromptForCompany(guardrailCtx.companyId)
      : ''
    // 要素間の関係グラフ（element_relations）を guardrails と並べて注入。0件・未解決なら従来どおり。
    const relations = guardrailCtx
      ? await getRelationsPromptForCompany(guardrailCtx.companyId)
      : ''
    const system = [SYSTEM_PROMPT, guardrails, relations].filter(Boolean).join('\n\n')

    const response = await callClaude({
      system,
      userMessage: parts.join('\n'),
      maxTokens: 4000,
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

    return NextResponse.json({ goals: parsed })
  } catch (err) {
    console.error('[SuggestGoals] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
