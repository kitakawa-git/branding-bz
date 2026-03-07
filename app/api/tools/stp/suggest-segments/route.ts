// STP分析ツール セグメンテーション提案API
// POST /api/tools/stp/suggest-segments
// Claude APIにセグメンテーション提案をリクエスト
import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude-api'

const SYSTEM_PROMPT = `あなたはブランドマーケティングの専門家です。以下の企業情報をもとに、STP分析のセグメンテーション（市場細分化）を提案してください。業種や商品特性に適した変数を3〜4つ選び、各変数について代表的なセグメントを2〜4つ提案してください。回答はJSON形式のみで、前後に説明文やマークダウンのコードブロックを含めないでください。

出力JSONスキーマ:
{
  "variables": [
    {
      "name": "変数名（例: 購買動機、企業規模、地域）",
      "segments": [
        {
          "name": "セグメント名",
          "description": "50字以内の説明",
          "size_hint": "大 or 中 or 小"
        }
      ]
    }
  ]
}`

export async function POST(request: NextRequest) {
  console.log('[SuggestSegments] ===== API呼び出し開始 =====')

  try {
    const body = await request.json()
    const { basic_info } = body

    if (!basic_info) {
      return NextResponse.json({ error: 'basic_info が必要です' }, { status: 400 })
    }

    // ユーザープロンプト構築
    const parts: string[] = []
    parts.push('## 企業情報')
    if (basic_info.company_name) {
      parts.push(`- 企業名・ブランド名: ${basic_info.company_name}`)
    }
    // 業種（新形式 or 旧形式に対応）
    if (basic_info.industry_category) {
      const sub = basic_info.industry_subcategory ? `（${basic_info.industry_subcategory}）` : ''
      parts.push(`- 業種: ${basic_info.industry_category}${sub}`)
    } else if (basic_info.industry) {
      const industry = basic_info.industry === 'その他' && basic_info.industry_other
        ? basic_info.industry_other
        : basic_info.industry
      parts.push(`- 業種: ${industry}`)
    }
    // 事業内容（構造化データ or 旧テキスト形式に対応）
    if (basic_info.business_descriptions && Array.isArray(basic_info.business_descriptions)) {
      const descriptions = basic_info.business_descriptions
        .filter((b: { title: string; description: string }) => b.title?.trim())
        .map((b: { title: string; description: string }, i: number) => {
          const desc = b.description?.trim() ? `: ${b.description.trim()}` : ''
          return `  ${i + 1}. ${b.title.trim()}${desc}`
        })
        .join('\n')
      if (descriptions) {
        parts.push(`- 事業内容:\n${descriptions}`)
      }
    } else if (basic_info.products) {
      parts.push(`- 事業内容: ${basic_info.products}`)
    }
    // ターゲット顧客層（構造化データ or 旧テキスト形式に対応）
    if (basic_info.target_segments && Array.isArray(basic_info.target_segments)) {
      const segments = basic_info.target_segments
        .filter((ts: { name: string; description: string }) => ts.name?.trim())
        .map((ts: { name: string; description: string }, i: number) => {
          const desc = ts.description?.trim() ? `: ${ts.description.trim()}` : ''
          return `  ${i + 1}. ${ts.name.trim()}${desc}`
        })
        .join('\n')
      if (segments) {
        parts.push(`- ターゲット顧客層:\n${segments}`)
      }
    } else if (basic_info.current_customers) {
      parts.push(`- 現在の主な顧客層: ${basic_info.current_customers}`)
    }
    // 競合情報（構造化データ or 旧テキスト形式に対応）
    if (basic_info.competitors) {
      if (Array.isArray(basic_info.competitors)) {
        const names = basic_info.competitors
          .map((c: { name: string }) => c.name)
          .filter(Boolean)
          .join('、')
        if (names) parts.push(`- 競合企業: ${names}`)
      } else {
        parts.push(`- 競合企業・サービス: ${basic_info.competitors}`)
      }
    }

    parts.push('')
    parts.push('上記の情報をもとに、セグメンテーション変数とセグメントをJSON形式で提案してください。')

    const userMessage = parts.join('\n')

    console.log('[SuggestSegments] Claude API呼び出し中...')
    const response = await callClaude({
      system: SYSTEM_PROMPT,
      userMessage,
      maxTokens: 2000,
    })

    // JSONパース
    let jsonStr = response.trim()
    const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1]
    }

    let parsed: { variables: unknown[] }
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      console.error('[SuggestSegments] JSONパースエラー:', response.substring(0, 300))
      return NextResponse.json(
        { error: 'AIの応答を解析できませんでした。再度お試しください。' },
        { status: 500 }
      )
    }

    if (!parsed.variables || !Array.isArray(parsed.variables)) {
      return NextResponse.json(
        { error: 'AIの応答形式が不正です。再度お試しください。' },
        { status: 500 }
      )
    }

    console.log('[SuggestSegments] ===== 提案完了 ===== variables=', parsed.variables.length)
    return NextResponse.json({ variables: parsed.variables })
  } catch (err) {
    console.error('[SuggestSegments] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
