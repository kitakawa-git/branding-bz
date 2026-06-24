// ペルソナビルダー デモグラフィック提案API
// POST /api/tools/persona/suggest-demographics
import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude-api'
import { getAdminContext } from '@/lib/learning/auth'
import { getGuardrailsPromptForCompany } from '@/lib/brand/guardrails'
import { getRelationsPromptForCompany } from '@/lib/brand/relations'

const SYSTEM_PROMPT = `あなたはブランドマーケティングの専門家です。以下の企業情報とターゲット概要をもとに、ターゲット顧客の「代表的な役割像（セグメント）」を提案してください。
重要: 1人の具体的な個人（実名・具体的な住所・家族構成など）を作り込むのではなく、役割名・年齢層・短い特徴で、ターゲットセグメントを簡潔に描いてください。
回答はJSON形式のみで、前後に説明文やマークダウンのコードブロックを含めないでください。

出力JSONスキーマ:
{
  "persona_name": "役割呼称（実名でなく役割名。例: 地方中小企業の経営者 / スタートアップの創業経営者 / 中堅企業のDX推進担当）",
  "age": "年齢層レンジ文字列（例: 30-40歳 / 45-55歳）",
  "gender": "男性 or 女性 or その他 or 不問",
  "occupation": "職業（型レベルの代表値）",
  "company_role": "役職（該当する場合・型レベル）",
  "company_size": "勤務先の規模（個人事業主 / 〜10名 / 10〜50名 / 50〜100名 / 100〜500名 / 500名以上）",
  "media_channels": ["情報収集の代表傾向1", "情報収集の代表傾向2"],
  "personality_traits": ["代表的な傾向1", "代表的な傾向2", "代表的な傾向3"]
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
    parts.push('上記の情報をもとに、ターゲットの代表的な役割像（セグメント）を、役割名・年齢層・短い特徴で簡潔にJSON形式で提案してください。1人の具体的な個人を作り込まないこと。')

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
