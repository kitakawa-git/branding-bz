// タグマッピングAI提案API
// POST /api/brand-score/tag-mappings/suggest
// Claude APIで企業のブランドデータから期待タグを提案

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callClaude } from '@/lib/claude-api'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const ALL_TAGS = [
  '信頼感',
  '革新的',
  '親しみやすい',
  '専門的',
  '洗練された',
  '情熱的',
  '堅実',
  '遊び心がある',
] as const

const SYSTEM_PROMPT = `あなたはブランディングの専門家です。
企業のブランドデータ（企業名、スローガン、MVV、ブランドストーリー、トーン・オブ・ボイス）を分析し、
その企業が外部から持たれるべき「期待される印象」のタグを提案してください。

以下の8つの印象タグから、この企業にふさわしいものを3〜4個選んでください:
- 信頼感
- 革新的
- 親しみやすい
- 専門的
- 洗練された
- 情熱的
- 堅実
- 遊び心がある

回答は必ず以下のJSON形式で返してください。他のテキストは含めないでください:
{
  "expected_tags": ["タグ1", "タグ2", "タグ3"],
  "reason": "選定理由を1〜2文で簡潔に"
}`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId } = body

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId は必須です' },
        { status: 400 },
      )
    }

    // ブランドデータを取得（AI設問生成APIと同様のパターン）
    const [companyResult, personalityResult] = await Promise.allSettled([
      supabase
        .from('companies')
        .select('name, slogan, mvv, brand_story')
        .eq('id', companyId)
        .single(),
      supabase
        .from('brand_personalities')
        .select('tone_of_voice')
        .eq('company_id', companyId)
        .limit(1)
        .single(),
    ])

    const company = companyResult.status === 'fulfilled' ? companyResult.value.data : null
    const personality = personalityResult.status === 'fulfilled' ? personalityResult.value.data : null

    if (!company) {
      return NextResponse.json(
        { error: '企業データが見つかりません' },
        { status: 404 },
      )
    }

    // ブランドデータが十分かチェック
    const hasData = company.name || company.slogan || company.mvv || company.brand_story
    if (!hasData) {
      return NextResponse.json(
        { error: 'ブランドデータが不足しています。企業名・スローガン・MVVなどを先に設定してください。' },
        { status: 400 },
      )
    }

    // ユーザーメッセージ構築
    const brandData = {
      企業名: company.name || '未設定',
      スローガン: company.slogan || '未設定',
      MVV: company.mvv || '未設定',
      ブランドストーリー: company.brand_story || '未設定',
      トーンオブボイス: personality?.tone_of_voice || '未設定',
    }

    const userMessage = `以下の企業のブランドデータを分析し、期待される印象タグを提案してください:\n\n${JSON.stringify(brandData, null, 2)}`

    // Claude API 呼び出し
    const response = await callClaude({
      system: SYSTEM_PROMPT,
      userMessage,
      maxTokens: 1024,
    })

    // JSONパース（markdown code block対応）
    let jsonStr = response.trim()
    const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch) jsonStr = jsonMatch[1]

    const parsed = JSON.parse(jsonStr)

    // バリデーション: expected_tags が配列で、許可タグに含まれること
    if (!parsed.expected_tags || !Array.isArray(parsed.expected_tags)) {
      return NextResponse.json(
        { error: 'AI応答の形式が不正です' },
        { status: 500 },
      )
    }

    // 許可タグのみにフィルタ
    const validTags = parsed.expected_tags.filter((t: string) =>
      ALL_TAGS.includes(t as typeof ALL_TAGS[number]),
    )

    return NextResponse.json({
      expected_tags: validTags,
      reason: parsed.reason || '',
    })
  } catch (err) {
    console.error('[tag-mappings/suggest] エラー:', err)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 },
    )
  }
}
