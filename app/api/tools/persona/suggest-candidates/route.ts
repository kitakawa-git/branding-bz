// ペルソナビルダー 候補提案API
// POST /api/tools/persona/suggest-candidates
// 5人のペルソナ候補を提案する
import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude-api'

const SYSTEM_PROMPT = `あなたはブランディングの専門家です。
以下の企業情報とターゲット情報をもとに、5人のペルソナ候補を提案してください。

## 指示
- 5人は年齢層・性別・職種・価値観・行動パターンが偏らないよう散らすこと
- 各候補はターゲットセグメントの異なる側面を代表する人物とすること
- BtoB企業の場合は「購買決定者」「利用者」「影響者」などの役割も考慮すること
- 名前は日本人名でリアリティのあるものにすること
- キーワードは3〜5個、その人物の特徴を端的に表すもの

回答はJSON配列のみで、前後に説明文やマークダウンのコードブロックを含めないでください。

出力形式:
[
  {
    "name": "姓 名",
    "age": 32,
    "gender": "女性",
    "occupation": "IT企業",
    "title": "マーケティング部 主任",
    "catchcopy": "効率重視のデータ派",
    "keywords": ["データ活用", "時短", "SNS情報収集"]
  }
]
（計5人）`

// 構造化データをプロンプト用テキストに変換
function formatBusinessDescriptions(basicInfo: Record<string, unknown>): string {
  const descs = basicInfo.business_descriptions as Array<{ title: string; description: string }> | undefined
  if (descs?.length) {
    return descs
      .filter(b => b.title?.trim())
      .map(b => b.description ? `${b.title}: ${b.description}` : b.title)
      .join('\n  ')
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
      .join('\n  ')
  }
  if (basicInfo.target_description && typeof basicInfo.target_description === 'string') {
    return basicInfo.target_description as string
  }
  return ''
}

export async function POST(request: NextRequest) {
  console.log('[SuggestCandidates] ===== API呼び出し開始 =====')

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
    parts.push('上記の情報をもとに、5人のペルソナ候補をJSON配列で提案してください。')

    const response = await callClaude({
      system: SYSTEM_PROMPT,
      userMessage: parts.join('\n'),
      maxTokens: 2000,
    })

    let jsonStr = response.trim()
    const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch) jsonStr = jsonMatch[1]

    let parsed: Array<Record<string, unknown>>
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      console.error('[SuggestCandidates] JSONパースエラー:', response.substring(0, 300))
      return NextResponse.json(
        { error: 'AIの応答を解析できませんでした。再度お試しください。' },
        { status: 500 }
      )
    }

    // 各候補にIDを付与
    const candidates = (Array.isArray(parsed) ? parsed : []).map(c => ({
      id: crypto.randomUUID(),
      name: (c.name as string) || '',
      age: (c.age as number) || 30,
      gender: (c.gender as string) || '',
      occupation: (c.occupation as string) || '',
      title: (c.title as string) || '',
      catchcopy: (c.catchcopy as string) || '',
      keywords: (c.keywords as string[]) || [],
      selected: false,
    }))

    console.log('[SuggestCandidates] ===== 候補生成完了（%d人）=====', candidates.length)
    return NextResponse.json({ candidates })
  } catch (err) {
    console.error('[SuggestCandidates] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
