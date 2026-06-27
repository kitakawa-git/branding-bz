// STP分析ツール 自社の立ち位置提案API
// POST /api/tools/stp/suggest-brand-stance
// STP結果から「自社の立ち位置（ポジショニング・ステートメント）」をターゲット別に生成。
import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude-api'
import { getAdminContext } from '@/lib/learning/auth'
import { getGuardrailsPromptForCompany } from '@/lib/brand/guardrails'

const SYSTEM_PROMPT = `あなたはブランドマーケティングの専門家です。STP分析の結果から「自社の立ち位置（ポジショニング・ステートメント）」を、ターゲット別に3本生成してください。

立ち位置の構造（古典的なポジショニング・ステートメント）:
> [ターゲット]にとって、[自社]は[ベネフィット]を提供する[カテゴリ]である。
それぞれに「なぜなら[根拠]」を添えます。

執筆ルール:
1. 中小企業の経営者にも届く語彙で書く。カタカナ専門用語（イノベーション・ソリューション・パートナーシップ等）を避け、和語ベースで簡潔に
2. 1文は60〜90字程度
3. 自社の強み（strengths）と競合差別化（positioning.x_axis/y_axis/items[is_self].reasoning）を根拠に統合する
4. 「ですます調」ではなく「である調」で書く
5. 「世界一」「No.1」など根拠のない最上級表現は使わない

回答はJSON形式のみで、前後に説明文やマークダウンのコードブロックを含めないでください。

出力JSONスキーマ:
{
  "statements": [
    {
      "target_name": "事業承継期中小企業",
      "target_role": "main",
      "statement": "事業承継期中小企業にとって、ID INC.は世代交代の文脈を継承しながら現代的なブランド刷新を実装まで一気通貫で支援する、AIを活用したブランディングパートナーである。",
      "rationale": "15年のブランディング経験と独自AIツール群で、戦略策定から制作・組織浸透まで内製で支援できる体制を持つ"
    }
  ]
}`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { basic_info, targeting, positioning } = body
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
    parts.push('## ターゲティング')
    parts.push(`- メインターゲット: ${targeting.main_target}（${targeting.target_description || ''}）`)
    if (Array.isArray(targeting.sub_targets) && targeting.sub_targets.length > 0) {
      parts.push(`- サブターゲット: ${targeting.sub_targets.join(', ')}`)
    }
    if (targeting.strengths) parts.push(`- 自社の強み: ${targeting.strengths}`)
    if (Array.isArray(targeting.buying_factors) && targeting.buying_factors.length > 0) {
      parts.push(`- 購買決定要因: ${targeting.buying_factors.join('、')}`)
    }

    parts.push('')
    parts.push('## ポジショニング（競合差別化）')
    if (positioning?.x_axis) parts.push(`- X軸: ${positioning.x_axis.left} ↔ ${positioning.x_axis.right}`)
    if (positioning?.y_axis) parts.push(`- Y軸: ${positioning.y_axis.bottom} ↔ ${positioning.y_axis.top}`)
    if (positioning?.axis_rationale) parts.push(`- 軸選定の根拠: ${positioning.axis_rationale}`)
    const selfItem = positioning?.items?.find((i: { is_self?: boolean }) => i.is_self)
    if (selfItem?.reasoning) parts.push(`- 自社の配置根拠: ${selfItem.reasoning}`)

    parts.push('')
    parts.push(`上記の情報をもとに、メインターゲット1本＋サブターゲット${targeting.sub_targets?.length || 0}本の自社の立ち位置を JSON形式で生成してください。`)
    const userMessage = parts.join('\n')

    const guardrailCtx = await getAdminContext()
    const guardrails = guardrailCtx
      ? await getGuardrailsPromptForCompany(guardrailCtx.companyId)
      : ''
    const system = [SYSTEM_PROMPT, guardrails].filter(Boolean).join('\n\n')

    const response = await callClaude({ system, userMessage, maxTokens: 2000, temperature: 0 })

    // JSONパース（既存パターン）
    let jsonStr = response.trim()
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (fenceMatch) jsonStr = fenceMatch[1].trim()
    const objStart = jsonStr.indexOf('{')
    const objEnd = jsonStr.lastIndexOf('}')
    if (objStart >= 0 && objEnd > objStart) jsonStr = jsonStr.slice(objStart, objEnd + 1)

    let parsed: { statements?: Array<Record<string, unknown>> }
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      console.error('[SuggestBrandStance] JSONパースエラー:', response.substring(0, 300))
      return NextResponse.json(
        { error: 'AIの応答を解析できませんでした。再度お試しください。' },
        { status: 500 }
      )
    }
    // generated_at を付与
    const nowIso = new Date().toISOString()
    parsed.statements = (parsed.statements || []).map((s) => ({ ...s, generated_at: nowIso }))
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[SuggestBrandStance] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
