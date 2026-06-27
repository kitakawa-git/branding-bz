// STP分析ツール ポジショニング提案API
// POST /api/tools/stp/suggest-positioning
import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude-api'
import { getAdminContext } from '@/lib/learning/auth'
import { getGuardrailsPromptForCompany } from '@/lib/brand/guardrails'
import { getRelationsPromptForCompany } from '@/lib/brand/relations'

const SYSTEM_PROMPT = `あなたはブランドマーケティングの専門家です。STP分析のポジショニング（軸の定義と企業の配置）を提案してください。X軸とY軸は、**供給側の差別化要因**（自社のやり方・サービス範囲・提供モデル等）を軸として採用してください。理由: Step 3で顧客側の切り口（成長段階・規模等）は既にターゲット適合マップに使われているため、Step 4は競合との「やり方の違い」を可視化することに集中します。
候補軸:
- 手法（伝統的 ↔ AI活用・デジタル）
- サービス範囲（戦略提言中心 ↔ 一気通貫実装）
- 価格・モデル（プロジェクト型 ↔ サブスク型）
- 専門性の幅（ニッチ特化 ↔ 総合）
これらの中から、(1)ターゲットの購買決定要因と整合し、(2)自社の強みで差別化が可能な2軸を選ぶこと。自社の強みが活きるポジションに配置し、競合との差別化が明確になるよう配置してください。回答はJSON形式のみで、前後に説明文やマークダウンのコードブロックを含めないでください。

出力JSONスキーマ:
{
  "x_axis": { "left": "左端ラベル", "right": "右端ラベル" },
  "y_axis": { "bottom": "下端ラベル", "top": "上端ラベル" },
  "axis_rationale": "なぜこの2軸を選んだか（1〜2文）",
  "items": [
    { "name": "自社", "x": 60, "y": 65, "color": "#3B82F6", "is_self": true, "reasoning": "なぜこの座標か（1文）", "confidence": "high" },
    { "name": "競合A", "x": 30, "y": 60, "color": "#EF4444", "is_self": false, "reasoning": "なぜこの座標か（1文）", "confidence": "medium" }
  ]
}

注意:
- x, y は 0〜100 の数値（50が中央）
- 自社は必ず1つ含めること（is_self: true, color: "#3B82F6"）
- 競合は2〜4社程度
- 各企業の色は互いに異なるものにすること
- 自社の座標は「強みが活きるポジション」であるべきだが、軸の端（90以上）に張り付けないこと。差別化の方向性が見える程度（55〜75の範囲を目安）に配置する
- 各企業に reasoning（配置の根拠・1文）と confidence を必ず付与すること
- confidence の判定基準:
  - "high": ユーザー入力（strengths / 競合分析の特徴）に座標を裏付ける具体的な記述がある
  - "medium": 一部の記述から推測できる
  - "low": 記述が薄い／空欄で、業種一般論からの推測
- 競合の「特徴」が空欄または1行未満の場合、その競合の座標は中央付近（40〜60）に配置し、confidence を "low" にすること。当てずっぽうで端に配置しないこと`

export async function POST(request: NextRequest) {

  try {
    const body = await request.json()
    const { basic_info, targeting, segmentation } = body

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
    // 現状の主要顧客（構造化データ or 旧テキスト形式に対応）
    if (basic_info.target_segments && Array.isArray(basic_info.target_segments)) {
      const segments = basic_info.target_segments
        .filter((ts: { name: string; description: string }) => ts.name?.trim())
        .map((ts: { name: string; description: string }, i: number) => {
          const desc = ts.description?.trim() ? `: ${ts.description.trim()}` : ''
          return `  ${i + 1}. ${ts.name.trim()}${desc}`
        })
        .join('\n')
      if (segments) {
        parts.push(`- 現状の主要顧客:\n${segments}`)
      }
    } else if (basic_info.current_customers) {
      parts.push(`- 現状の主要顧客: ${basic_info.current_customers}`)
    }

    // 競合情報（メモ付き構造化データ or 旧テキスト形式に対応）
    if (basic_info.competitors) {
      if (Array.isArray(basic_info.competitors)) {
        const competitorLines = basic_info.competitors
          .filter((c: { name: string }) => c.name?.trim())
          .map((c: { name: string; url?: string; notes?: string }) => {
            let line = c.name.trim()
            if (c.notes?.trim()) {
              line += `（メモ: ${c.notes.trim()}）`
            }
            return line
          })
        if (competitorLines.length > 0) {
          parts.push(`- 競合企業:\n${competitorLines.map((l: string, i: number) => `  ${i + 1}. ${l}`).join('\n')}`)
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
      if (targeting.buying_factors?.length > 0) {
        parts.push(`- ターゲットの購買決定要因: ${targeting.buying_factors.join('、')}`)
      }
      if (targeting.strengths) {
        parts.push(`- 自社の強み: ${targeting.strengths}`)
      }
      // 競合分析（構造化データ）
      if (targeting.competitors_analysis && Array.isArray(targeting.competitors_analysis)) {
        const analyses = targeting.competitors_analysis
          .filter((ca: { name: string; traits: string }) => ca.name?.trim())
          .map((ca: { name: string; traits: string }) => {
            const traits = ca.traits?.trim() ? `: ${ca.traits.trim()}` : '（分析なし）'
            return `  - ${ca.name.trim()}${traits}`
          })
        if (analyses.length > 0) {
          parts.push(`- 競合分析:\n${analyses.join('\n')}`)
          parts.push('  ※ 各競合の特徴を踏まえて正確にポジショニングマップ上に配置してください')
        }
      } else if (targeting.competitor_traits) {
        // 後方互換: 旧テキスト形式
        parts.push(`- 競合の特徴: ${targeting.competitor_traits}`)
      }
    }

    // セグメンテーション分析（Step2の切り口・各セグメント）。軸選定のヒントとして全切り口・全セグメントを渡す。
    if (segmentation && Array.isArray(segmentation.variables) && segmentation.variables.length > 0) {
      const segLines: string[] = []
      segmentation.variables
        .filter((v: { name?: string }) => v?.name?.trim())
        .forEach((v: { name: string; segments?: Array<{ name: string; priorities?: string; selected?: boolean }> }, i: number) => {
          segLines.push(`- 切り口${i + 1}: ${v.name.trim()}`)
          ;(v.segments || [])
            .filter((s) => s?.name?.trim())
            .forEach((s) => {
              const sel = s.selected ? '（選択中）' : ''
              const pri = s.priorities?.trim() ? `: 重視すること = ${s.priorities.trim()}` : ''
              segLines.push(`  - ${s.name.trim()}${sel}${pri}`)
            })
        })
      if (segLines.length > 0) {
        parts.push('')
        parts.push('## セグメンテーション分析（Step2で実施）')
        parts.push(segLines.join('\n'))
        parts.push('※ 上記の「切り口」は、ターゲットがこの市場で重視している判断軸そのものです。X軸/Y軸を選ぶ際は、これらの切り口の中から、自社の強みが活き、かつターゲットの購買決定要因と整合するものを優先的に採用してください。')
      }
    }

    parts.push('')
    parts.push('上記の情報をもとに、ポジショニングマップの軸と各企業の配置をJSON形式で提案してください。')

    const userMessage = parts.join('\n')

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
      userMessage,
      maxTokens: 1500,
    })

    // JSONパース。素の``` ```フェンスや前後の説明文に耐えるよう、
    // フェンス除去後に最外の {...} を切り出してからパースする。
    let jsonStr = response.trim()
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim()
    }
    const objStart = jsonStr.indexOf('{')
    const objEnd = jsonStr.lastIndexOf('}')
    if (objStart >= 0 && objEnd > objStart) {
      jsonStr = jsonStr.slice(objStart, objEnd + 1)
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

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[SuggestPositioning] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
