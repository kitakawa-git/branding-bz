// ペルソナビルダー 詳細属性提案API
// POST /api/tools/persona/suggest-details
// 選択された候補の詳細属性をAIで生成する
import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude-api'

const SYSTEM_PROMPT = `あなたはブランディングの専門家です。
以下のペルソナ候補に対して、詳細な属性を作成してください。

## 指示
- 各候補の簡易プロフィール（年齢・職業・キャッチコピー・キーワード）と矛盾しない詳細を作成すること
- リアリティのある具体的な内容にすること
- 日本の生活環境・文化に沿った内容にすること
- personality, values, daily_routine, challenges は2〜3文で具体的に

回答はJSON配列のみで、前後に説明文やマークダウンのコードブロックを含めないでください。

出力形式:
[
  {
    "candidate_id": "候補のID",
    "income": "550万円",
    "location": "東京都世田谷区",
    "family": "夫と2人暮らし",
    "hobbies": "ヨガ、カフェ巡り、ビジネス書",
    "info_sources": "Twitter、note、業界メディア",
    "personality": "合理的で新しいもの好き。データで裏付けがないと納得しない。",
    "values": "時間効率を最重視。無駄な会議や曖昧な指示にストレスを感じる。",
    "daily_routine": "朝6時起床、通勤中にニュースチェック、昼休みにSNS、退勤後はヨガ。",
    "challenges": "情報過多で判断に時間がかかる。上司への説明資料作成が負担。"
  }
]`

// 構造化データをプロンプト用テキストに変換
function formatBasicInfo(basicInfo: Record<string, unknown>): string {
  const parts: string[] = []
  if (basicInfo.company_name) parts.push(`- 企業名: ${basicInfo.company_name}`)
  if (basicInfo.industry_category) {
    const sub = basicInfo.industry_subcategory ? `（${basicInfo.industry_subcategory}）` : ''
    parts.push(`- 業種: ${basicInfo.industry_category}${sub}`)
  }
  const descs = basicInfo.business_descriptions as Array<{ title: string; description: string }> | undefined
  if (descs?.length) {
    const text = descs.filter(b => b.title?.trim()).map(b => b.description ? `${b.title}: ${b.description}` : b.title).join('\n  ')
    if (text) parts.push(`- 事業内容:\n  ${text}`)
  } else if (basicInfo.products && typeof basicInfo.products === 'string') {
    parts.push(`- 事業内容: ${basicInfo.products}`)
  }
  const segs = basicInfo.target_segments as Array<{ name: string; description: string }> | undefined
  if (segs?.length) {
    const text = segs.filter(ts => ts.name?.trim()).map(ts => ts.description ? `${ts.name}: ${ts.description}` : ts.name).join('\n  ')
    if (text) parts.push(`- ターゲット:\n  ${text}`)
  } else if (basicInfo.target_description && typeof basicInfo.target_description === 'string') {
    parts.push(`- ターゲット: ${basicInfo.target_description}`)
  }
  return parts.join('\n')
}

interface Candidate {
  id: string
  name: string
  age: number
  gender: string
  occupation: string
  title: string
  catchcopy: string
  keywords: string[]
}

export async function POST(request: NextRequest) {
  console.log('[SuggestDetails] ===== API呼び出し開始 =====')

  try {
    const body = await request.json()
    const { basic_info, candidates } = body as {
      basic_info: Record<string, unknown>
      candidates: Candidate[]
    }

    if (!basic_info || !candidates?.length) {
      return NextResponse.json({ error: 'basic_info と candidates が必要です' }, { status: 400 })
    }

    const parts: string[] = []
    parts.push('## 企業情報')
    parts.push(formatBasicInfo(basic_info))
    parts.push('')
    parts.push('## ペルソナ候補')
    for (const c of candidates) {
      parts.push(`### ${c.name}（${c.age}歳・${c.gender}）`)
      parts.push(`- ID: ${c.id}`)
      parts.push(`- 職業: ${c.occupation} ${c.title}`)
      parts.push(`- キャッチコピー: ${c.catchcopy}`)
      parts.push(`- キーワード: ${c.keywords.join(', ')}`)
      parts.push('')
    }
    parts.push('上記の各候補に対して、詳細属性をJSON配列で作成してください。候補の順序を維持してください。')

    const response = await callClaude({
      system: SYSTEM_PROMPT,
      userMessage: parts.join('\n'),
      maxTokens: 4096,
    })

    let jsonStr = response.trim()
    const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch) jsonStr = jsonMatch[1]

    let parsed: Array<Record<string, unknown>>
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      console.error('[SuggestDetails] JSONパースエラー:', response.substring(0, 300))
      return NextResponse.json(
        { error: 'AIの応答を解析できませんでした。再度お試しください。' },
        { status: 500 }
      )
    }

    // 候補の基本情報とマージ
    const personas = candidates.map(c => {
      const detail = (Array.isArray(parsed) ? parsed : []).find(
        d => d.candidate_id === c.id
      ) || parsed[candidates.indexOf(c)] || {}

      return {
        candidate_id: c.id,
        name: c.name,
        age: c.age,
        gender: c.gender,
        occupation: c.occupation,
        title: c.title,
        catchcopy: c.catchcopy,
        keywords: c.keywords,
        income: (detail.income as string) || '',
        location: (detail.location as string) || '',
        family: (detail.family as string) || '',
        hobbies: (detail.hobbies as string) || '',
        info_sources: (detail.info_sources as string) || '',
        personality: (detail.personality as string) || '',
        values: (detail.values as string) || '',
        daily_routine: (detail.daily_routine as string) || '',
        challenges: (detail.challenges as string) || '',
      }
    })

    console.log('[SuggestDetails] ===== 詳細生成完了（%d人）=====', personas.length)
    return NextResponse.json({ personas })
  } catch (err) {
    console.error('[SuggestDetails] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
