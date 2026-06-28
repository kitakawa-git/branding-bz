// STP分析ツール セグメンテーション提案API
// POST /api/tools/stp/suggest-segments
// Claude APIにセグメンテーション提案をリクエスト
import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude-api'
import { getAdminContext } from '@/lib/learning/auth'
import { getGuardrailsPromptForCompany } from '@/lib/brand/guardrails'
import { getRelationsPromptForCompany } from '@/lib/brand/relations'

const SYSTEM_PROMPT = `あなたはブランドマーケティングの専門家です。以下の企業情報をもとに、STP分析のセグメンテーション（市場細分化）を提案してください。業種や商品特性に適した切り口（変数）を3〜4つ選び、各切り口について代表的なグループ（セグメント）を2〜4つ提案してください。各グループが商品・サービスを選ぶ際に重視することも記載してください。回答はJSON形式のみで、前後に説明文やマークダウンのコードブロックを含めないでください。

出力JSONスキーマ:
{
  "variables": [
    {
      "name": "切り口名（例: 購買動機、企業規模、地域）",
      "reason": "この切り口を選んだ理由（1〜2文）",
      "axis_type": "ordinal | categorical",
      "axis_endpoints": {
        "low_label": "低側ラベル（順序型のみ・8文字以内）",
        "high_label": "高側ラベル（順序型のみ・8文字以内）"
      },
      "segments": [
        {
          "name": "グループ名",
          "description": "50字以内の説明",
          "size_hint": "大 or 中 or 小",
          "priorities": "このグループが重視すること（例: コスト、品質、サポート体制）"
        }
      ]
    }
  ]
}

各切り口に "axis_type" を必ず付けてください。
- "ordinal": 順序的に並べられる切り口（時間的推移・程度の高低・量の大小など）。例: 企業成長段階、AIリテラシー、企業規模、内製化志向、予算規模
- "categorical": 別カテゴリーが並列するだけで連続性がない切り口。例: 意思決定者の属性、業種、地域、課題タイプ
axis_type は後続のターゲット適合マップで軸候補のフィルタリングに使われます。順序的にも並べられない（典型的にはカテゴリ型）の切り口でも、Step 3 のターゲット選定では有用なので生成して構いません。順序型を最低2つは含めるよう心がけてください。

axis_type が "ordinal" の切り口には、必ず "axis_endpoints" を出力してください。これは Step 3 のターゲット適合マップで軸の両端ラベルとして使われます。
axis_endpoints の作成ルール:
1. low_label と high_label は **対称的・並列形** にする
   - ◯ 対称: 「低 ↔ 高」「初期 ↔ 後期」「狭 ↔ 広」「外注 ↔ 内製」
   - ✗ 非対称: 「ゼロイチ創業期 ↔ 再定義・ピボット期」（名詞句で並列性なし）
   - ✗ 非対称: 「AI先行活用層 ↔ ブランド課題優先層」（形式が違う）
2. **各セグメントがこの両端の連続体上に配置できる**ラベルにする（例: 「ブランド課題フェーズ」で4セグメント〔ゼロイチ/成長/承継/再定義〕がある場合、すべて 低〜高 の連続体に置けること）
3. **8文字以内**で簡潔に
4. **切り口の本質的な対立軸**を表現する（時間的順序だけでなく、質的な軸方向も考慮）
axis_type が "categorical" の切り口には axis_endpoints は不要（null または省略）。
axis_endpoints の例:
- 「ブランド課題フェーズ」→ { low_label: "新規構築期", high_label: "再構築期" }
- 「AIリテラシー・DX推進度」→ { low_label: "AIリテラシー低", high_label: "AIリテラシー高" }
- 「ブランディング内製化志向」→ { low_label: "フルアウトソース", high_label: "セルフ運用" }
- 「企業成長段階」→ { low_label: "黎明期", high_label: "成熟期" }
- 「予算規模」→ { low_label: "小", high_label: "大" }
- 「意思決定者の属性」（categorical）→ axis_endpoints なし`

export async function POST(request: NextRequest) {

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
          .map((c: { name: string; notes?: string }) => {
            let line = c.name.trim()
            if (c.notes?.trim()) {
              line += `（メモ: ${c.notes.trim()}）`
            }
            return line
          })
        if (competitorLines.length > 0) {
          parts.push(`- 競合企業: ${competitorLines.join('、')}`)
        }
      } else {
        parts.push(`- 競合企業・サービス: ${basic_info.competitors}`)
      }
    }

    parts.push('')
    parts.push('上記の情報をもとに、セグメンテーション変数とセグメントをJSON形式で提案してください。')

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
      // セグメンテーションは出力が最も大きい（複数変数×複数セグメント）。
      // 2000では途中で切れて不正JSONになりパース失敗するため余裕を持たせる。
      maxTokens: 4000,
    })

    // JSONパース。素の``` ```フェンスや前後の説明文にも耐えるよう、
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

    return NextResponse.json({ variables: parsed.variables })
  } catch (err) {
    console.error('[SuggestSegments] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
