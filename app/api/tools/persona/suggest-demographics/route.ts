// ペルソナビルダー デモグラフィック提案API
// POST /api/tools/persona/suggest-demographics
import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude-api'
import { getAdminContext } from '@/lib/learning/auth'
import { getGuardrailsPromptForCompany } from '@/lib/brand/guardrails'
import { getRelationsPromptForCompany } from '@/lib/brand/relations'

const SYSTEM_PROMPT = `あなたはブランドマーケティングの専門家です。以下の企業情報とターゲット概要をもとに、具体的なペルソナのデモグラフィック情報を提案してください。「30代女性」のような曖昧なものではなく、名前・年齢・職業・居住地・年収・家族構成・趣味・情報収集方法まで具体的に1人の人物像を描いてください。回答はJSON形式のみで、前後に説明文やマークダウンのコードブロックを含めないでください。

出力JSONスキーマ:
{
  "persona_name": "架空の日本人名（例: 田中 美咲）",
  "age": 数値,
  "gender": "男性 or 女性 or その他",
  "occupation": "職業（具体的に）",
  "company_role": "役職（該当する場合）",
  "company_size": "勤務先の規模（個人事業主 / 〜10名 / 10〜50名 / 50〜100名 / 100〜500名 / 500名以上）",
  "location": "居住地（例: 東京都世田谷区）",
  "annual_income": "年収帯（例: 500〜700万円）",
  "family": "家族構成（例: 妻、小学生の子ども2人）",
  "education": "最終学歴（例: 私立大学 経営学部卒）",
  "hobbies": ["趣味1", "趣味2", "趣味3"],
  "media_channels": ["情報収集方法1", "情報収集方法2", "情報収集方法3"],
  "personality_traits": ["性格特性1", "性格特性2", "性格特性3"],
  "daily_routine": "1日のおおまかな過ごし方（2〜3文）",
  "quote": "この人が言いそうな一言（キャッチフレーズ的に）"
}`

// 構造化データをプロンプト用テキストに変換
function formatBusinessDescriptions(basicInfo: Record<string, unknown>): string {
  const descs = basicInfo.business_descriptions as Array<{ title: string; description: string }> | undefined
  if (descs?.length) {
    return descs
      .filter(b => b.title?.trim())
      .map(b => b.description ? `${b.title}: ${b.description}` : b.title)
      .join('\n  ')
  }
  // 旧形式フォールバック
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
      .join('\n  ')
  }
  // 旧形式フォールバック
  if (basicInfo.target_description && typeof basicInfo.target_description === 'string') {
    return basicInfo.target_description as string
  }
  return ''
}

export async function POST(request: NextRequest) {

  try {
    const body = await request.json()
    const { basic_info } = body

    if (!basic_info) {
      return NextResponse.json({ error: 'basic_info が必要です' }, { status: 400 })
    }

    const parts: string[] = []
    parts.push('## 企業情報')
    if (basic_info.company_name) parts.push(`- 企業名: ${basic_info.company_name}`)
    if (basic_info.industry_category) {
      const sub = basic_info.industry_subcategory ? `（${basic_info.industry_subcategory}）` : ''
      parts.push(`- 業種: ${basic_info.industry_category}${sub}`)
    }

    const bizText = formatBusinessDescriptions(basic_info)
    if (bizText) parts.push(`- 事業内容:\n  ${bizText}`)

    const targetText = formatTargetSegments(basic_info)
    if (targetText) parts.push(`- ターゲット:\n  ${targetText}`)

    parts.push('')
    parts.push('上記の情報をもとに、リアルで具体的なペルソナのデモグラフィック情報をJSON形式で提案してください。')

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
      maxTokens: 2000,
    })

    let jsonStr = response.trim()
    const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch) jsonStr = jsonMatch[1]

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      console.error('[SuggestDemographics] JSONパースエラー:', response.substring(0, 300))
      return NextResponse.json(
        { error: 'AIの応答を解析できませんでした。再度お試しください。' },
        { status: 500 }
      )
    }

    return NextResponse.json({ demographics: parsed })
  } catch (err) {
    console.error('[SuggestDemographics] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
