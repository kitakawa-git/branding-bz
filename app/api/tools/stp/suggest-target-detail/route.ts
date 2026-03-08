// STP分析ツール ターゲット深掘り提案API
// POST /api/tools/stp/suggest-target-detail
import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude-api'

const SYSTEM_PROMPT = `あなたはブランドマーケティングの専門家です。STP分析のターゲティングにおいて、選択されたメインターゲットの深掘り情報を提案してください。企業情報とセグメンテーション結果を踏まえ、実践的で具体的な内容を提案してください。回答はJSON形式のみで、前後に説明文やマークダウンのコードブロックを含めないでください。

出力JSONスキーマ:
{
  "buying_factors": ["購買決定要因1", "購買決定要因2", "購買決定要因3"],
  "strengths": "自社の強み（ターゲットに対して活かせる強み。2〜3文）",
  "competitor_traits": "競合の特徴（主な競合の強みや弱み。2〜3文）",
  "target_description": "ターゲットの詳細定義（具体的なペルソナ像。2〜3文）"
}

注意:
- buying_factors は3〜5個の短いキーワードで
- strengths はターゲットに刺さる自社の強みを具体的に
- competitor_traits は主要な競合との差別化ポイントがわかるように
- target_description は企業規模・業種・課題・行動パターンなどを含む具体的なペルソナ`

export async function POST(request: NextRequest) {
  console.log('[SuggestTargetDetail] ===== API呼び出し開始 =====')

  try {
    const body = await request.json()
    const { basic_info, segmentation, main_target } = body

    if (!basic_info || !main_target) {
      return NextResponse.json(
        { error: 'basic_info と main_target が必要です' },
        { status: 400 }
      )
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
    // 競合情報（メモ付き）
    if (basic_info.competitors) {
      if (Array.isArray(basic_info.competitors)) {
        const competitorLines = basic_info.competitors
          .filter((c: { name: string }) => c.name?.trim())
          .map((c: { name: string; url?: string; notes?: string }) => {
            let line = c.name.trim()
            if (c.notes?.trim()) {
              line += `（メモ: ${c.notes.trim()}）`
            }
            if (c.url?.trim()) {
              line += ` [${c.url.trim()}]`
            }
            return line
          })
        if (competitorLines.length > 0) {
          parts.push(`- 競合企業:\n${competitorLines.map((l: string, i: number) => `  ${i + 1}. ${l}`).join('\n')}`)
        }
      } else {
        parts.push(`- 競合企業・サービス: ${basic_info.competitors}`)
      }
    }

    // セグメンテーション情報
    if (segmentation?.variables && Array.isArray(segmentation.variables)) {
      parts.push('')
      parts.push('## セグメンテーション結果')
      for (const variable of segmentation.variables) {
        if (variable.name) {
          const segNames = (variable.segments || [])
            .filter((s: { name: string }) => s.name?.trim())
            .map((s: { name: string }) => s.name)
            .join('、')
          if (segNames) {
            parts.push(`- ${variable.name}: ${segNames}`)
          }
        }
      }
    }

    // メインターゲット
    parts.push('')
    parts.push('## メインターゲット')
    parts.push(`- グループ名: ${main_target.name}`)
    if (main_target.description) {
      parts.push(`- 説明: ${main_target.description}`)
    }

    parts.push('')
    parts.push('上記のメインターゲットについて、購買決定要因・自社の強み・競合の特徴・ターゲット詳細定義をJSON形式で提案してください。')

    const userMessage = parts.join('\n')

    console.log('[SuggestTargetDetail] Claude API呼び出し中...')
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

    let parsed: {
      buying_factors: string[]
      strengths: string
      competitor_traits: string
      target_description: string
    }
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      console.error('[SuggestTargetDetail] JSONパースエラー:', response.substring(0, 300))
      return NextResponse.json(
        { error: 'AIの応答を解析できませんでした。再度お試しください。' },
        { status: 500 }
      )
    }

    if (!parsed.buying_factors || !Array.isArray(parsed.buying_factors)) {
      return NextResponse.json(
        { error: 'AIの応答形式が不正です。再度お試しください。' },
        { status: 500 }
      )
    }

    console.log('[SuggestTargetDetail] ===== 提案完了 ===== buying_factors=', parsed.buying_factors.length)
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[SuggestTargetDetail] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
