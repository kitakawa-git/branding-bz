// STP分析ツール ターゲット深掘り提案API
// POST /api/tools/stp/suggest-target-detail
import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude-api'
import { getAdminContext } from '@/lib/learning/auth'
import { getGuardrailsPromptForCompany } from '@/lib/brand/guardrails'
import { getRelationsPromptForCompany } from '@/lib/brand/relations'
import { pushStpCompanyProfile } from '@/lib/tools/prompt-context'

export async function POST(request: NextRequest) {

  try {
    const body = await request.json()
    const { basic_info, segmentation, main_target } = body

    if (!basic_info || !main_target) {
      return NextResponse.json(
        { error: 'basic_info と main_target が必要です' },
        { status: 400 }
      )
    }

    // Step1の競合企業リストを抽出
    const competitors: Array<{ name: string; url?: string; notes?: string }> =
      Array.isArray(basic_info.competitors)
        ? basic_info.competitors.filter((c: { name: string }) => c.name?.trim())
        : []

    const SYSTEM_PROMPT = `あなたはブランドマーケティングの専門家です。STP分析のターゲティングにおいて、選択されたメインターゲットの深掘り情報を提案してください。企業情報とセグメンテーション結果を踏まえ、実践的で具体的な内容を提案してください。回答はJSON形式のみで、前後に説明文やマークダウンのコードブロックを含めないでください。

出力JSONスキーマ:
{
  "buying_factors": ["購買決定要因1", "購買決定要因2", "購買決定要因3"],
  "strengths": "自社の強み（ターゲットに対して活かせる強み。2〜3文）"
}

注意:
- buying_factors は3〜5個の短いキーワードで
- strengths はターゲットに刺さる自社の強みを具体的に`

    // ユーザープロンプト構築
    const parts: string[] = []
    pushStpCompanyProfile(parts, basic_info)
    // 競合情報（名前、URL、メモを詳細に）
    if (competitors.length > 0) {
      const competitorLines = competitors.map((c: { name: string; url?: string; notes?: string }, i: number) => {
        let line = `  ${i + 1}. ${c.name.trim()}`
        if (c.url?.trim()) {
          line += ` [${c.url.trim()}]`
        }
        if (c.notes?.trim()) {
          line += `（メモ: ${c.notes.trim()}）`
        }
        return line
      })
      parts.push(`- 競合企業・サービス:\n${competitorLines.join('\n')}`)
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
    parts.push('上記のメインターゲットについて、購買決定要因・自社の強みをJSON形式で提案してください。')

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

    let parsed: {
      buying_factors: string[]
      strengths: string
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

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[SuggestTargetDetail] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
