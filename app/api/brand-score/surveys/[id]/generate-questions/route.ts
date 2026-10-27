// AI設問生成API
// POST /api/brand-score/surveys/[id]/generate-questions
// Claude APIを呼び出し、企業のブランドデータに基づいたカスタム設問を生成
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  guardCompanyFeature,
  requireCompanyMember,
  recordAiFeatureUsage,
} from '@/lib/billing/guard'
import { callClaude } from '@/lib/claude-api'
import { fetchBrandData, hasSufficientData } from '@/lib/brand-score/brand-data'

type RouteContext = { params: Promise<{ id: string }> }

// Claude APIのシステムプロンプト
const SYSTEM_PROMPT = `あなたはブランディングの専門家です。以下の企業のブランドデータを基に、ブランド浸透度を測定するためのサーベイ設問を生成してください。

ルール:
- 5段階リッカート尺度（1: まったく当てはまらない → 5: 非常に当てはまる）で回答可能な文にする
- 企業固有のブランド要素（理念、スローガン、ターゲット、パーソナリティ等）に具体的に言及した設問にする
- 汎用的な設問ではなく、この企業でしか使えない設問を作る
- 各カテゴリ（why/how/what）ごとに2-3問ずつ、合計6-9問を生成する

以下のJSON形式のみで出力。説明文やMarkdownは不要:
[
  {
    "category": "why" | "how" | "what",
    "question_text": "設問文",
    "reference_data": { "field": "参照したフィールド名", "value": "参照した値の要約" }
  }
]`

// Claude APIレスポンスからJSONを抽出
function extractJson(text: string): unknown {
  // Markdownコードブロックを除去
  let cleaned = text.trim()
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim()
  }
  return JSON.parse(cleaned)
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    const supabase = getSupabaseAdmin()

    // 1. サーベイからcompany_idを取得
    const { data: survey, error: surveyError } = await supabase
      .from('brand_surveys')
      .select('company_id')
      .eq('id', id)
      .single()

    if (surveyError) {
      console.error('[GenerateQuestions] サーベイ取得エラー:', surveyError.message)
      const status = surveyError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json({ error: surveyError.message }, { status })
    }

    const companyId = survey.company_id

    // 1.5. 呼び出し元がこの会社の人か＆プランで使えるかを確かめる。
    // ⚠️ ここが無いと、サーベイ ID さえ知っていれば未ログインでも
    //    他社のブランドデータで Claude を走らせられる（課金対象の外部API）
    const forbidden = await requireCompanyMember(companyId)
    if (forbidden) return forbidden
    const denied = await guardCompanyFeature(companyId, 'innerSurvey')
    if (denied) return denied

    // 2. ブランドデータを取得（クイズの generate-questions と同じ lib/brand-score/brand-data を使う）
    const brandData = await fetchBrandData(supabase, companyId)

    // 3. データ十分性チェック
    if (!hasSufficientData(brandData)) {
      return NextResponse.json(
        { error: 'ブランドデータが不足しています。企業のブランド情報を先に登録してください。' },
        { status: 400 }
      )
    }

    // 4. Claude API呼び出し
    let claudeResponse: string
    try {
      claudeResponse = await callClaude({
        system: SYSTEM_PROMPT,
        userMessage: JSON.stringify(brandData, null, 2),
        maxTokens: 4096,
      })
    } catch (err) {
      console.error('[GenerateQuestions] Claude APIエラー:', err)
      return NextResponse.json(
        { error: 'AI設問生成に失敗しました。しばらく経ってから再度お試しください。' },
        { status: 500 }
      )
    }

    // 5. レスポンスパース
    let generatedQuestions: { category: string; question_text: string; reference_data?: Record<string, unknown> }[]
    try {
      const parsed = extractJson(claudeResponse)
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('生成結果が配列ではありません')
      }
      generatedQuestions = parsed
    } catch (err) {
      console.error('[GenerateQuestions] JSONパースエラー:', err)
      console.error('[GenerateQuestions] Claude応答:', claudeResponse)
      return NextResponse.json(
        { error: 'AI応答の解析に失敗しました。再度お試しください。' },
        { status: 500 }
      )
    }

    // 6. 既存の最大sort_orderを取得
    const { data: maxOrderData } = await supabase
      .from('brand_survey_questions')
      .select('sort_order')
      .eq('survey_id', id)
      .order('sort_order', { ascending: false })
      .limit(1)

    const maxSortOrder = maxOrderData && maxOrderData.length > 0
      ? (maxOrderData[0].sort_order as number)
      : 0

    // 7. 一括INSERT
    const rows = generatedQuestions.map((q, i) => ({
      survey_id: id,
      category: q.category,
      question_text: q.question_text,
      source: 'ai_generated' as const,
      sort_order: maxSortOrder + 1 + i,
      is_active: true,
      reference_data: q.reference_data ?? {},
    }))

    const { data: inserted, error: insertError } = await supabase
      .from('brand_survey_questions')
      .insert(rows)
      .select()

    if (insertError) {
      console.error('[GenerateQuestions] INSERT エラー:', insertError.message)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // 外部APIを使った機能なので、実行を記録する（集計・上限判定の材料）
    await recordAiFeatureUsage(companyId, 'survey_question_generation', {
      survey_id: id,
      generated: inserted?.length ?? 0,
    })

    return NextResponse.json(
      { questions: inserted, count: inserted?.length ?? 0 },
      { status: 201 }
    )
  } catch (err) {
    console.error('[GenerateQuestions] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
