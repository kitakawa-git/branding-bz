// STP分析ツール ポジショニング提案API
// POST /api/tools/stp/suggest-positioning
import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude-api'

const SYSTEM_PROMPT = `あなたはブランドマーケティングの専門家です。STP分析のポジショニング（軸の定義と企業の配置）を提案してください。X軸とY軸は、この業界でターゲット顧客が重視する差別化要素を選んでください。自社は強みが活きるポジションに配置してください。回答はJSON形式のみで、前後に説明文やマークダウンのコードブロックを含めないでください。

出力JSONスキーマ:
{
  "x_axis": { "left": "左端ラベル", "right": "右端ラベル" },
  "y_axis": { "bottom": "下端ラベル", "top": "上端ラベル" },
  "items": [
    { "name": "自社", "x": 70, "y": 80, "color": "#3B82F6", "is_self": true },
    { "name": "競合A", "x": 30, "y": 60, "color": "#EF4444", "is_self": false }
  ]
}

注意:
- x, y は 0〜100 の数値（50が中央）
- 自社は必ず1つ含めること（is_self: true, color: "#3B82F6"）
- 競合は2〜4社程度
- 各企業の色は互いに異なるものにすること`

export async function POST(request: NextRequest) {
  console.log('[SuggestPositioning] ===== API呼び出し開始 =====')

  try {
    const body = await request.json()
    const { basic_info, targeting } = body

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
        if (names) {
          parts.push(`- 競合企業: ${names}`)
          parts.push('  ※ 上記の競合企業をitemsに含めてください')
        }
      } else {
        parts.push(`- 競合企業・サービス: ${basic_info.competitors}`)
        parts.push('  ※ 上記の競合企業をitemsに含めてください')
      }
    }

    // ターゲティング情報
    if (targeting) {
      parts.push('')
      parts.push('## ターゲティング')
      if (targeting.main_target) {
        parts.push(`- メインターゲット: ${targeting.main_target}`)
      }
      if (targeting.sub_targets?.length > 0) {
        parts.push(`- サブターゲット: ${targeting.sub_targets.join(', ')}`)
      }
      if (targeting.target_description) {
        parts.push(`- ターゲット詳細: ${targeting.target_description}`)
      }
    }

    parts.push('')
    parts.push('上記の情報をもとに、ポジショニングマップの軸と各企業の配置をJSON形式で提案してください。')

    const userMessage = parts.join('\n')

    console.log('[SuggestPositioning] Claude API呼び出し中...')
    const response = await callClaude({
      system: SYSTEM_PROMPT,
      userMessage,
      maxTokens: 1500,
    })

    // JSONパース
    let jsonStr = response.trim()
    const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1]
    }

    let parsed: { x_axis: unknown; y_axis: unknown; items: unknown[] }
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      console.error('[SuggestPositioning] JSONパースエラー:', response.substring(0, 300))
      return NextResponse.json(
        { error: 'AIの応答を解析できませんでした。再度お試しください。' },
        { status: 500 }
      )
    }

    if (!parsed.x_axis || !parsed.y_axis || !Array.isArray(parsed.items)) {
      return NextResponse.json(
        { error: 'AIの応答形式が不正です。再度お試しください。' },
        { status: 500 }
      )
    }

    console.log('[SuggestPositioning] ===== 提案完了 ===== items=', parsed.items.length)
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[SuggestPositioning] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
