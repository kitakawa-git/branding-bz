// カラーパレット生成API（Claude API呼び出し）
// POST /api/tools/colors/generate
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { callClaude } from '@/lib/claude-api'
import type { PaletteProposal } from '@/lib/types/color-tool'

const SYSTEM_PROMPT = `あなたはID INC.のシニアブランドコンサルタントです。
CI（コーポレートアイデンティティ）策定の実務経験が豊富で、
特にカラー戦略に深い専門性を持っています。

## 役割
ユーザーのブランドに最適なカラーパレットを3パターン提案してください。
各パターンは明確に異なるコンセプトを持ち、ユーザーが比較選択できるようにしてください。

## 考慮すべき要素
1. 色彩心理学：各色が人に与える印象（信頼=青、情熱=赤、成長=緑 等）
2. 業界慣習：対象業種で一般的なカラー傾向と、あえて外す戦略
3. 競合差別化：入力された競合カラーとの明確な差別化
4. 文化的配慮：日本市場における色の文化的意味合い
5. アクセシビリティ：WCAG 2.1 AA基準のコントラスト比（4.5:1以上）を満たすこと
6. 実用性：印刷（CMYK）・デジタル（RGB）の両方で再現性が高い色

## 出力制約
- 必ず3パターン提案する
- 各パターンにわかりやすい名前と提案理由をつける
- 専門用語を使わず、経営者にわかる言葉で説明する
- JSON形式で出力する（後述のスキーマに従う）
- JSONのみ出力し、前後に説明文を入れないこと

## 出力JSONスキーマ
{
  "proposals": [
    {
      "id": "proposal_1",
      "name": "パレット名（日本語）",
      "concept": "50文字以内のコンセプト説明",
      "primary": { "hex": "#XXXXXX", "rgb": {"r":0,"g":0,"b":0}, "name": "日本語の色名" },
      "secondary": [
        { "hex": "#XXXXXX", "rgb": {"r":0,"g":0,"b":0}, "name": "日本語の色名" }
      ],
      "accent": { "hex": "#XXXXXX", "rgb": {"r":0,"g":0,"b":0}, "name": "日本語の色名" },
      "neutrals": {
        "light": { "hex": "#XXXXXX", "rgb": {"r":0,"g":0,"b":0}, "name": "日本語の色名" },
        "dark": { "hex": "#XXXXXX", "rgb": {"r":0,"g":0,"b":0}, "name": "日本語の色名" }
      },
      "reasoning": "提案理由（3〜4行、150文字程度）",
      "accessibilityScore": {
        "primaryOnLight": 0.0,
        "primaryOnDark": 0.0,
        "accentOnLight": 0.0,
        "passes": true
      }
    }
  ]
}`

export async function POST(request: NextRequest) {
  console.log('[ColorGenerate] ===== API呼び出し開始 =====')

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId が必要です' }, { status: 400 })
    }

    // 月次生成回数チェック
    const { data: session } = await supabaseAdmin
      .from('mini_app_sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 })
    }

    const { count } = await supabaseAdmin
      .from('mini_app_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user_id)
      .eq('app_type', 'brand_colors')
      .gte('started_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())

    if ((count ?? 0) > 3) {
      return NextResponse.json(
        { error: '今月の生成回数上限（3回）に達しました。来月またお試しください。' },
        { status: 429 }
      )
    }

    // プロジェクトデータ取得
    const { data: project, error: projectError } = await supabaseAdmin
      .from('brand_color_projects')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    // ユーザープロンプト構築
    const userPrompt = buildUserPrompt(project)

    console.log('[ColorGenerate] Claude API呼び出し中...')
    const response = await callClaude({
      system: SYSTEM_PROMPT,
      userMessage: userPrompt,
      maxTokens: 4096,
    })

    // JSONパース
    let proposals: PaletteProposal[]
    try {
      // JSONブロックを抽出（```json ... ``` または直接JSON）
      let jsonStr = response.trim()
      const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1]
      }
      const parsed = JSON.parse(jsonStr)
      proposals = parsed.proposals || parsed
    } catch {
      console.error('[ColorGenerate] JSONパースエラー:', response.substring(0, 200))
      return NextResponse.json(
        { error: 'AIの応答を解析できませんでした。再度お試しください。' },
        { status: 500 }
      )
    }

    // バリデーション
    if (!Array.isArray(proposals) || proposals.length < 3) {
      return NextResponse.json(
        { error: '提案が3パターン未満です。再度お試しください。' },
        { status: 500 }
      )
    }

    // DBに保存
    const { error: updateError } = await supabaseAdmin
      .from('brand_color_projects')
      .update({ proposals })
      .eq('session_id', sessionId)

    if (updateError) {
      console.error('[ColorGenerate] DB更新エラー:', updateError.message)
    }

    console.log('[ColorGenerate] ===== 生成完了 =====')
    return NextResponse.json({ proposals })
  } catch (err) {
    console.error('[ColorGenerate] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}

function buildUserPrompt(project: Record<string, unknown>): string {
  const parts: string[] = []

  parts.push(`## ブランド基本情報`)
  parts.push(`- ブランド名: ${project.brand_name || '未設定'}`)
  parts.push(`- 業種: ${project.industry_category || ''} / ${project.industry_subcategory || ''}`)
  parts.push(`- ステージ: ${project.brand_stage === 'new' ? '新規ブランド' : project.brand_stage === 'rebrand' ? 'リブランド' : '微調整'}`)

  const existingColors = project.existing_colors as { hex: string }[] | undefined
  if (existingColors && existingColors.length > 0) {
    parts.push(`- 既存カラー: ${existingColors.map(c => c.hex).join(', ')}`)
  }

  const competitorColors = project.competitor_colors as { name: string; hex: string }[] | undefined
  if (competitorColors && competitorColors.length > 0) {
    parts.push(`- 競合カラー: ${competitorColors.map(c => `${c.name}(${c.hex})`).join(', ')}`)
  }

  parts.push('')
  parts.push(`## イメージ入力`)

  if (project.approach_type === 'keyword') {
    const keywords = project.keywords as { word: string; priority: number }[] | undefined
    if (keywords && keywords.length > 0) {
      parts.push(`- 選択キーワード（優先順）: ${keywords.sort((a, b) => a.priority - b.priority).map(k => k.word).join(', ')}`)
    }
  } else if (project.approach_type === 'moodboard') {
    const choices = project.moodboard_choices as { pairId: string; choice: string }[] | undefined
    if (choices && choices.length > 0) {
      parts.push(`- ムードボード選択: ${choices.map(c => `${c.pairId}=${c.choice}`).join(', ')}`)
    }
  }

  const avoidColors = project.avoid_colors as string[] | undefined
  if (avoidColors && avoidColors.length > 0) {
    parts.push(`- 避けたい色: ${avoidColors.join(', ')}`)
  }

  const refBrands = project.reference_brands as string[] | undefined
  if (refBrands && refBrands.length > 0) {
    parts.push(`- 参考ブランド: ${refBrands.join(', ')}`)
  }

  parts.push('')
  parts.push('上記の情報をもとに、3パターンのカラーパレットをJSON形式で提案してください。')

  return parts.join('\n')
}
