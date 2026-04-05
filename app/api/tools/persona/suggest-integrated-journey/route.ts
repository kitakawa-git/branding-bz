// ペルソナビルダー 総合ジャーニーマップ生成API
// POST /api/tools/persona/suggest-integrated-journey
import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude-api'

const SYSTEM_PROMPT = `あなたはブランディングとマーケティングの専門家です。
複数のペルソナのカスタマージャーニーマップを分析し、総合分析（比較テーブル＋ブランド戦略サマリー）を生成してください。
回答はJSON形式のみで、前後に説明文やマークダウンのコードブロックを含めないでください。

出力JSONスキーマ:
{
  "comparison_table": {
    "stages": ["認知", "興味", "検討", "購入", "継続"],
    "personas": [
      {
        "candidate_id": "xxx",
        "name": "ペルソナ名",
        "stages": [
          {
            "stage": "認知",
            "action": "主な行動（短文）",
            "emotion": "positive または neutral または negative",
            "emotion_score": -5〜+5の整数,
            "touchpoint": "主なタッチポイント（短文）"
          }
        ]
      }
    ]
  },
  "core_message": "全ペルソナに共通する価値観・課題・期待から導いた、ブランドが一貫して発信すべきコアメッセージ（1〜2文）",
  "persona_approaches": [
    {
      "candidate_id": "xxx",
      "name": "ペルソナ名",
      "appeal_point": "このペルソナに最も刺さる訴求ポイント",
      "channel": "優先的にリーチすべきチャネル",
      "barrier": "購買・意思決定の最大の障壁",
      "content": "障壁を越えるために必要なコンテンツ"
    }
  ],
  "priority_touchpoints": [
    {
      "rank": 1,
      "touchpoint": "タッチポイント名",
      "reason": "重要な理由"
    }
  ]
}

ルール:
- comparison_table.personas.stages の emotion は positive / neutral / negative のいずれか
- emotion_score は個別ジャーニーマップの値をそのまま使うこと
- action / touchpoint は個別ジャーニーマップの内容を要約した短文にすること
- core_message は全ペルソナに共通する価値観・課題から導き、1〜2文で簡潔に表現すること
- persona_approaches は全ペルソナ分生成すること。4軸（appeal_point/channel/barrier/content）それぞれを短く具体的に
- priority_touchpoints はジャーニーマップ全体を横断分析し、重要度順に3〜5個生成すること。rankは1からの連番`

interface PersonaJourney {
  candidate_id: string
  name: string
  stages: Array<{
    name: string
    actions: string[]
    touchpoints: string[]
    emotion_score: number
    emotions: string
  }>
}

export async function POST(request: NextRequest) {
  console.log('[IntegratedJourney] ===== API呼び出し開始 =====')

  try {
    const body = await request.json()
    const { basic_info, persona_journeys } = body as {
      basic_info: Record<string, unknown>
      persona_journeys: PersonaJourney[]
    }

    if (!basic_info || !persona_journeys?.length) {
      return NextResponse.json({ error: 'basic_info と persona_journeys が必要です' }, { status: 400 })
    }

    const parts: string[] = []
    parts.push('## 企業情報')
    if (basic_info.company_name) parts.push(`- 企業名: ${basic_info.company_name}`)
    if (basic_info.industry_category) parts.push(`- 業種: ${basic_info.industry_category}`)

    parts.push('')
    parts.push('## 各ペルソナのジャーニーマップ')

    for (const pj of persona_journeys) {
      parts.push('')
      parts.push(`### ${pj.name}（candidate_id: ${pj.candidate_id}）`)
      for (const stage of pj.stages) {
        parts.push(`- ${stage.name}: 行動=[${stage.actions?.join(', ')}] TP=[${stage.touchpoints?.join(', ')}] 感情=${stage.emotions}(${stage.emotion_score})`)
      }
    }

    parts.push('')
    parts.push('上記の全ペルソナのジャーニーマップを分析し、総合分析（比較テーブル＋コアメッセージ＋ペルソナ別アプローチ＋優先タッチポイント）をJSON形式で生成してください。')

    const response = await callClaude({
      system: SYSTEM_PROMPT,
      userMessage: parts.join('\n'),
      maxTokens: 4000,
    })

    let jsonStr = response.trim()
    const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch) jsonStr = jsonMatch[1]

    let parsed: {
      comparison_table: unknown
      core_message: string
      persona_approaches: unknown[]
      priority_touchpoints: unknown[]
    }
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      console.error('[IntegratedJourney] JSONパースエラー:', response.substring(0, 300))
      return NextResponse.json(
        { error: 'AIの応答を解析できませんでした。再度お試しください。' },
        { status: 500 }
      )
    }

    console.log('[IntegratedJourney] ===== 生成完了 =====')
    return NextResponse.json({
      comparison_table: parsed.comparison_table,
      core_message: parsed.core_message,
      persona_approaches: parsed.persona_approaches,
      priority_touchpoints: parsed.priority_touchpoints,
    })
  } catch (err) {
    console.error('[IntegratedJourney] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
