// STP分析ツール ターゲット概要文 AI生成API
// POST /api/tools/stp/suggest-target-summary
// メインターゲット＋サブターゲットを踏まえた「誰に・どんな価値を届けるか」の概要文を生成。
import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude-api'
import { getAdminContext } from '@/lib/learning/auth'
import { getGuardrailsPromptForCompany } from '@/lib/brand/guardrails'
import { getRelationsPromptForCompany } from '@/lib/brand/relations'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { basic_info, segmentation, targeting } = body

    if (!basic_info || !targeting?.main_target) {
      return NextResponse.json(
        { error: 'basic_info と targeting.main_target が必要です' },
        { status: 400 }
      )
    }

    const SYSTEM_PROMPT = `あなたはブランドマーケティングの専門家です。STP分析のターゲティング結果（メインターゲット＋サブターゲット）を踏まえ、「このブランドが誰にどんな価値を届けるか」を要約する概要文を作成してください。

出力は JSON 形式のみで、前後に説明文やマークダウンのコードブロックを含めないでください。

出力JSONスキーマ:
{
  "summary": "ターゲット戦略の概要文（2〜3文・180〜260文字程度）"
}

注意:
- 「メインターゲット＋サブターゲットの位置づけ」「自社が解決したい本質的な課題」「提供価値の方向性」を簡潔に要約する
- 主観的な美辞麗句は避け、ターゲットの状況と提供価値の輪郭が見える具体的な表現にする
- 一人称（弊社・私たち）は避け、第三者視点で記述する
- 冒頭で「本ブランドは」「我々は」のような自社主語を繰り返さない`

    const parts: string[] = []
    parts.push('## 企業情報')
    if (basic_info.company_name) parts.push(`- 企業名・ブランド名: ${basic_info.company_name}`)
    if (basic_info.industry_category) {
      const sub = basic_info.industry_subcategory ? `（${basic_info.industry_subcategory}）` : ''
      parts.push(`- 業種: ${basic_info.industry_category}${sub}`)
    }
    if (Array.isArray(basic_info.business_descriptions)) {
      const lines = basic_info.business_descriptions
        .filter((b: { title: string; description: string }) => b.title?.trim())
        .map((b: { title: string; description: string }, i: number) => {
          const desc = b.description?.trim() ? `: ${b.description.trim()}` : ''
          return `  ${i + 1}. ${b.title.trim()}${desc}`
        })
        .join('\n')
      if (lines) parts.push(`- 事業内容:\n${lines}`)
    }

    if (segmentation?.variables && Array.isArray(segmentation.variables)) {
      parts.push('')
      parts.push('## セグメンテーション結果（採用された切り口）')
      for (const v of segmentation.variables) {
        if (v.name) {
          const selectedNames = (v.segments || [])
            .filter((s: { name: string; selected: boolean }) => s.selected && s.name?.trim())
            .map((s: { name: string }) => s.name)
            .join('、')
          if (selectedNames) parts.push(`- ${v.name}: ${selectedNames}`)
        }
      }
    }

    parts.push('')
    parts.push('## ターゲティング結果')
    parts.push(`- メインターゲット: ${targeting.main_target}`)
    if (targeting.target_description) {
      parts.push(`  説明: ${targeting.target_description}`)
    }
    if (Array.isArray(targeting.sub_targets) && targeting.sub_targets.length > 0) {
      parts.push(`- サブターゲット: ${targeting.sub_targets.join('、')}`)
    }
    if (Array.isArray(targeting.buying_factors) && targeting.buying_factors.length > 0) {
      parts.push(`- 想定される購買決定要因: ${targeting.buying_factors.join('、')}`)
    }
    if (targeting.strengths) {
      parts.push(`- ターゲットに対する自社の強み: ${targeting.strengths}`)
    }

    parts.push('')
    parts.push('上記を踏まえ、ターゲット戦略の概要文をJSON形式で出力してください。')

    const userMessage = parts.join('\n')

    const guardrailCtx = await getAdminContext()
    const guardrails = guardrailCtx
      ? await getGuardrailsPromptForCompany(guardrailCtx.companyId)
      : ''
    const relations = guardrailCtx
      ? await getRelationsPromptForCompany(guardrailCtx.companyId)
      : ''
    const system = [SYSTEM_PROMPT, guardrails, relations].filter(Boolean).join('\n\n')

    const response = await callClaude({
      system,
      userMessage,
      maxTokens: 800,
    })

    let jsonStr = response.trim()
    const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch) jsonStr = jsonMatch[1]

    let parsed: { summary?: string }
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      console.error('[SuggestTargetSummary] JSONパースエラー:', response.substring(0, 300))
      return NextResponse.json(
        { error: 'AIの応答を解析できませんでした。再度お試しください。' },
        { status: 500 }
      )
    }

    if (!parsed.summary || typeof parsed.summary !== 'string') {
      return NextResponse.json(
        { error: 'AIの応答形式が不正です。再度お試しください。' },
        { status: 500 }
      )
    }

    return NextResponse.json({ summary: parsed.summary.trim() })
  } catch (err) {
    console.error('[SuggestTargetSummary] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
