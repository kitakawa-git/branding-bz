// AI設問生成API
// POST /api/brand-score/surveys/[id]/generate-questions
// Claude APIを呼び出し、企業のブランドデータに基づいたカスタム設問を生成
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { callClaude } from '@/lib/claude-api'
import { fetchPhilosophy } from '@/lib/brand/philosophy'

type RouteContext = { params: Promise<{ id: string }> }

// ブランドデータ収集結果
interface BrandData {
  company?: {
    name?: string
    slogan?: string
  }
  guidelines?: {
    business_content?: unknown
    mission?: string
    vision?: string
    values?: unknown
    traits?: unknown
    brand_story?: string
  }
  personas?: {
    target?: string
    segmentation_data?: unknown
    positioning_map_data?: unknown
    name?: string
    description?: string
  }[]
  personality?: {
    communication_style?: string
  }
  visuals?: {
    color_palette?: unknown
  }
  terms?: {
    preferred_term?: string
    avoided_term?: string
    context?: string
    category?: string
  }[]
}

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

// ブランドデータが十分にあるか判定
function hasSufficientData(data: BrandData): boolean {
  const checks = [
    data.company?.name,
    data.company?.slogan,
    data.guidelines?.brand_story,
    data.guidelines?.mission,
    data.guidelines?.vision,
    data.guidelines?.business_content,
    data.personas && data.personas.length > 0,
    data.personality?.communication_style,
  ]
  // 少なくとも2つ以上のデータがあればOK
  const filledCount = checks.filter(Boolean).length
  return filledCount >= 2
}

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

    // 2. ブランドデータを並列取得
    const brandData: BrandData = {}

    const [
      companyResult,
      guidelinesResult,
      personasResult,
      personalityResult,
      visualsResult,
      termsResult,
    ] = await Promise.allSettled([
      // companies
      supabase
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .single(),
      // brand_guidelines（slogan の参照元。business_content は philosophy_elements service へ正規化済み）
      supabase
        .from('brand_guidelines')
        .select('slogan, traits, brand_story')
        .eq('company_id', companyId)
        .single(),
      // brand_personas（複数行の可能性）
      supabase
        .from('brand_personas')
        .select('name, target, description, segmentation_data, positioning_map_data')
        .eq('company_id', companyId),
      // brand_personalities
      supabase
        .from('brand_personalities')
        .select('communication_style')
        .eq('company_id', companyId)
        .single(),
      // brand_visuals
      supabase
        .from('brand_visuals')
        .select('color_palette')
        .eq('company_id', companyId)
        .single(),
      // brand_terms（複数行）
      supabase
        .from('brand_terms')
        .select('preferred_term, avoided_term, context, category')
        .eq('company_id', companyId),
    ])

    // 各結果を安全に取得（テーブルが存在しない場合もエラーにしない）
    if (companyResult.status === 'fulfilled' && !companyResult.value.error) {
      // slogan は brand_guidelines 側を正とする（companies.slogan は廃止）
      const gData = guidelinesResult.status === 'fulfilled' && !guidelinesResult.value.error
        ? (guidelinesResult.value.data as { slogan?: string } | null)
        : null
      brandData.company = { ...(companyResult.value.data ?? {}), slogan: gData?.slogan ?? undefined }
    }
    if (guidelinesResult.status === 'fulfilled' && !guidelinesResult.value.error) {
      brandData.guidelines = guidelinesResult.value.data
    }
    // mission/vision/values/business_content は philosophy_elements 由来（brand_guidelines から正規化済み）
    const phil = await fetchPhilosophy(supabase, companyId)
    brandData.guidelines = {
      ...(brandData.guidelines ?? {}),
      mission: phil.mission ?? undefined,
      vision: phil.vision ?? undefined,
      values: phil.values,
      business_content: phil.services,
    }
    if (personasResult.status === 'fulfilled' && !personasResult.value.error) {
      brandData.personas = personasResult.value.data ?? []
    }
    if (personalityResult.status === 'fulfilled' && !personalityResult.value.error) {
      brandData.personality = personalityResult.value.data
    }
    if (visualsResult.status === 'fulfilled' && !visualsResult.value.error) {
      brandData.visuals = visualsResult.value.data
    }
    if (termsResult.status === 'fulfilled' && !termsResult.value.error) {
      brandData.terms = termsResult.value.data ?? []
    }

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
