// STP分析ツール ターゲット適合マップ提案API
// POST /api/tools/stp/suggest-target-fit-map
// 顧客側軸＋ターゲット点＋自社カバー範囲（楕円）を提案。「狙ったターゲットに本当に刺さるか」のセルフチェック用。
import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude-api'
import { getAdminContext } from '@/lib/learning/auth'
import { getGuardrailsPromptForCompany } from '@/lib/brand/guardrails'

const SYSTEM_PROMPT = `あなたはブランドマーケティングの専門家です。STP分析のターゲット適合マップ（顧客側軸＋ターゲット点＋自社カバー範囲）を提案してください。

このマップの目的は「狙ったターゲットに本当に自社が刺さるか」をセルフチェックすることです。重要なルール:
1. X軸とY軸は、Step 2のセグメンテーション切り口から**顧客側変数のみ**を採用してください（例: 企業成長段階・組織規模・顧客課題タイプ等）。供給側変数（手法・サービス範囲）は絶対に使わないこと（それはStep 4で使います）。
2. ターゲット（メイン1＋サブ最大2）を点でプロットしてください。
3. 自社は点ではなく**楕円（カバー範囲）**で表現します。中心座標＋横幅＋縦幅を返してください。
4. 全ターゲットが楕円の中に入るかを判定し、consistency_status を返してください。
   - green: 全ターゲットが楕円内
   - yellow: 全ターゲット内だが一部が端（カバー中心から70%以上の距離）
   - red: 1つ以上のターゲットが楕円外

回答はJSON形式のみで、前後に説明文やマークダウンのコードブロックを含めないでください。

出力JSONスキーマ:
{
  "x_axis": { "left": "左端ラベル", "right": "右端ラベル" },
  "y_axis": { "bottom": "下端ラベル", "top": "上端ラベル" },
  "axis_rationale": "なぜこの2軸を選んだか（1〜2文）",
  "coverage": {
    "center_x": 50,
    "center_y": 50,
    "width": 80,
    "height": 60,
    "rationale": "カバー範囲の根拠（自社の強み・経験を踏まえて1〜2文）"
  },
  "targets": [
    { "name": "事業承継期中小企業", "role": "main", "x": 70, "y": 50, "in_coverage": true },
    { "name": "急成長スタートアップ", "role": "sub", "x": 25, "y": 30, "in_coverage": true },
    { "name": "成長拡大組織", "role": "sub", "x": 50, "y": 70, "in_coverage": true }
  ],
  "consistency_status": "green"
}

注意:
- x, y, center_x, center_y は 0〜100 の数値（50が中央）
- width, height は 20〜100 の数値
- targets は targeting.main_target と sub_targets[] の名前を使う
- 各ターゲットが楕円 ((x-center_x)/width*2)^2 + ((y-center_y)/height*2)^2 <= 1 を満たすか判定して in_coverage を返す`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { basic_info, segmentation, targeting } = body
    if (!targeting?.main_target) {
      return NextResponse.json({ error: 'main_target が必要です' }, { status: 400 })
    }

    const parts: string[] = []
    parts.push('## 企業情報')
    if (basic_info?.company_name) parts.push(`- 企業名・ブランド名: ${basic_info.company_name}`)
    if (basic_info?.industry_category) {
      const sub = basic_info.industry_subcategory ? `（${basic_info.industry_subcategory}）` : ''
      parts.push(`- 業種: ${basic_info.industry_category}${sub}`)
    } else if (basic_info?.industry) {
      const industry = basic_info.industry === 'その他' && basic_info.industry_other
        ? basic_info.industry_other
        : basic_info.industry
      parts.push(`- 業種: ${industry}`)
    }
    if (Array.isArray(basic_info?.business_descriptions)) {
      const descriptions = basic_info.business_descriptions
        .filter((b: { title?: string }) => b.title?.trim())
        .map((b: { title: string; description?: string }, i: number) => {
          const desc = b.description?.trim() ? `: ${b.description.trim()}` : ''
          return `  ${i + 1}. ${b.title.trim()}${desc}`
        })
        .join('\n')
      if (descriptions) parts.push(`- 事業内容:\n${descriptions}`)
    }

    parts.push('')
    parts.push('## セグメンテーション分析（Step2で実施）')
    if (segmentation?.variables) {
      for (const v of segmentation.variables) {
        if (!v?.name?.trim()) continue
        parts.push(`- 切り口: ${v.name}`)
        for (const s of v.segments || []) {
          if (!s?.name?.trim()) continue
          const mark = s.selected ? '（選択中）' : ''
          const pri = s.priorities ? ` / 重視: ${s.priorities}` : ''
          parts.push(`  - ${s.name}${mark}: ${s.description || ''}${pri}`)
        }
      }
    }
    parts.push('※ 顧客側の切り口（成長段階・規模・課題タイプ等）から軸を選んでください。供給側（手法・サービス範囲）は使わないこと。')

    parts.push('')
    parts.push('## ターゲティング')
    parts.push(`- メインターゲット: ${targeting.main_target}`)
    if (Array.isArray(targeting.sub_targets) && targeting.sub_targets.length > 0) {
      parts.push(`- サブターゲット: ${targeting.sub_targets.join(', ')}`)
    }
    if (targeting.strengths) parts.push(`- 自社の強み: ${targeting.strengths}`)
    if (Array.isArray(targeting.buying_factors) && targeting.buying_factors.length > 0) {
      parts.push(`- 購買決定要因: ${targeting.buying_factors.join('、')}`)
    }

    parts.push('')
    parts.push('上記の情報をもとに、ターゲット適合マップをJSON形式で提案してください。')
    const userMessage = parts.join('\n')

    const guardrailCtx = await getAdminContext()
    const guardrails = guardrailCtx
      ? await getGuardrailsPromptForCompany(guardrailCtx.companyId)
      : ''
    const system = [SYSTEM_PROMPT, guardrails].filter(Boolean).join('\n\n')

    const response = await callClaude({ system, userMessage, maxTokens: 1500 })

    // JSONパース（既存パターン: フェンス除去＋最外オブジェクト切り出し）
    let jsonStr = response.trim()
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (fenceMatch) jsonStr = fenceMatch[1].trim()
    const objStart = jsonStr.indexOf('{')
    const objEnd = jsonStr.lastIndexOf('}')
    if (objStart >= 0 && objEnd > objStart) jsonStr = jsonStr.slice(objStart, objEnd + 1)

    let parsed: unknown
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      console.error('[SuggestTargetFitMap] JSONパースエラー:', response.substring(0, 300))
      return NextResponse.json(
        { error: 'AIの応答を解析できませんでした。再度お試しください。' },
        { status: 500 }
      )
    }
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[SuggestTargetFitMap] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
