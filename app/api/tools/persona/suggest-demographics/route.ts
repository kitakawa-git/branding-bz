// ペルソナビルダー デモグラフィック提案API
// POST /api/tools/persona/suggest-demographics
import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude-api'

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

export async function POST(request: NextRequest) {
  console.log('[SuggestDemographics] ===== API呼び出し開始 =====')

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
    if (basic_info.products) parts.push(`- 事業内容: ${basic_info.products}`)
    if (basic_info.target_description) parts.push(`- ターゲット概要: ${basic_info.target_description}`)

    parts.push('')
    parts.push('上記の情報をもとに、リアルで具体的なペルソナのデモグラフィック情報をJSON形式で提案してください。')

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
      console.error('[SuggestDemographics] JSONパースエラー:', response.substring(0, 300))
      return NextResponse.json(
        { error: 'AIの応答を解析できませんでした。再度お試しください。' },
        { status: 500 }
      )
    }

    console.log('[SuggestDemographics] ===== 提案完了 =====')
    return NextResponse.json({ demographics: parsed })
  } catch (err) {
    console.error('[SuggestDemographics] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
