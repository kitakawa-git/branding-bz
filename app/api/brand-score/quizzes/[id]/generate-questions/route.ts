// ブランド理解度テスト AI設問生成API
// POST /api/brand-score/quizzes/[id]/generate-questions
// ============================================================
// 企業のブランドデータ（事実）を「正解キー」に、正誤のある知識テスト設問を
// Claude（Sonnet）で生成する。サーベイ（自己申告リッカート）との決定的な違いは
// 「正解・不正解が一意に確定すること」。プロンプト・サーバ検証の両面で担保する。
//
// 流用元: 既存 surveys/[id]/generate-questions/route.ts
//   - ブランドデータ取得は共通関数 fetchBrandData / hasSufficientData を使用
//   - Anthropicクライアント・モデルは lib/claude-api.ts の callClaude を使用
//     （モデル文字列はハードコードしない）
//   - JSON抽出は同様に fence 除去してから安全に parse
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { callClaude } from '@/lib/claude-api'
import { fetchBrandData, hasSufficientData } from '@/lib/brand-score/brand-data'
import { validateQuizQuestion } from '@/lib/brand-score/quiz-validation'
import type { QuizCategory } from '@/lib/types/brand-quiz'

type RouteContext = { params: Promise<{ id: string }> }

// 生成カテゴリは WHY / HOW のみ（WHAT＝行動体現は知識テストに不向きなので作らせない）
const GEN_CATEGORIES: readonly QuizCategory[] = ['why', 'how']

// スキップ報告の1件
interface SkippedItem {
  category?: string
  reason: string
}

// システムプロンプト（生成数を埋め込む）
function buildSystemPrompt(whyCount: number, howCount: number): string {
  return `あなたは企業のブランド理解度を測る「知識テスト」の作問専門家です。
これは自己申告アンケートではなく、正解・不正解が明確に存在する知識テストです。
渡された企業のブランドデータ（＝事実）だけを根拠に、正誤を一意に判定できる設問を作成してください。

【生成する設問数】
- WHY（理念の中身：ミッション・ビジョン・バリュー・ブランドストーリー等）: ${whyCount}問
- HOW（戦略・ルールの中身：ターゲット、ポジショニング、ブランドパーソナリティ、トーン、用語ルール、カラー等）: ${howCount}問
- WHAT（日常の行動体現）は知識テストに不向きなので、絶対に生成しないこと。

【厳守ルール】
1. 正解は必ず、渡したブランドデータから一意に導けるものだけにする。データから事実として確定できない設問は作らない（数が足りなくても良い。捏造は厳禁）。
2. 誤答（ディストラクター）は「もっともらしいが、ブランドデータに照らすと明確に誤り」であること。データ上どちらとも取れる曖昧な選択肢を誤答に混ぜてはならない。
3. explanation には、正解の根拠となったブランド事実を必ず記載する（例:「当社のミッションは『〇〇』であるため」）。受験者の結果画面での学習に使う。
4. question_type は single_choice（4択）または true_false（◯×）のみ。
   - single_choice: options は必ず4つ。id は "a","b","c","d"。correct_option_id はそのいずれか1つ。
   - true_false: options は必ず2つ。id は "true","false"（text は「正しい」「誤り」等）。correct_option_id は "true" か "false"。
5. データが薄くて指定数に届かないカテゴリは、作れる分だけ生成し、残りは skipped に理由を入れる（捏造で埋めない）。

【出力形式】
以下のJSONのみを出力する。前置き・説明文・Markdownコードフェンス（\`\`\`）は一切禁止。
{
  "questions": [
    {
      "category": "why",
      "question_type": "single_choice",
      "question_text": "...",
      "options": [
        { "id": "a", "text": "..." },
        { "id": "b", "text": "..." },
        { "id": "c", "text": "..." },
        { "id": "d", "text": "..." }
      ],
      "correct_option_id": "b",
      "explanation": "当社の〇〇は...のため。",
      "reference_data": { "field": "mvv", "value": "..." }
    }
  ],
  "skipped": [{ "category": "how", "reason": "参照データ不足" }]
}`
}

// Claude APIレスポンスからJSONを抽出（Markdownコードブロック除去）
function extractJson(text: string): unknown {
  let cleaned = text.trim()
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim()
  }
  return JSON.parse(cleaned)
}

// 0以上の整数に丸める（上限20）。未指定・不正は fallback を返す
function normalizeCount(raw: unknown, fallback: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return fallback
  return Math.min(Math.floor(raw), 20)
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    // body は任意（counts 未指定なら WHY4 / HOW4）
    const body = await request.json().catch(() => ({}))
    const whyCount = normalizeCount(body?.counts?.why, 4)
    const howCount = normalizeCount(body?.counts?.how, 4)

    const supabase = getSupabaseAdmin()

    // 1. クイズから company_id を取得
    const { data: quiz, error: quizError } = await supabase
      .from('brand_quizzes')
      .select('company_id')
      .eq('id', id)
      .single()

    if (quizError) {
      console.error('[Quiz GenerateQuestions] クイズ取得エラー:', quizError.message)
      const status = quizError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json({ error: quizError.message }, { status })
    }

    const companyId = quiz.company_id

    // 2. ブランドデータ取得（既存サーベイと同一の共通関数）
    const brandData = await fetchBrandData(supabase, companyId)

    // 3. データ十分性チェック
    if (!hasSufficientData(brandData)) {
      return NextResponse.json(
        { error: 'ブランドデータが不足しています。企業のブランド情報を先に登録してください。' },
        { status: 400 }
      )
    }

    // 4. Claude API呼び出し（Sonnet）
    let claudeResponse: string
    try {
      claudeResponse = await callClaude({
        system: buildSystemPrompt(whyCount, howCount),
        userMessage: JSON.stringify(brandData, null, 2),
        maxTokens: 8192,
      })
    } catch (err) {
      console.error('[Quiz GenerateQuestions] Claude APIエラー:', err)
      return NextResponse.json(
        { error: 'AI設問生成に失敗しました。しばらく経ってから再度お試しください。' },
        { status: 500 }
      )
    }

    // 5. レスポンスパース（{ questions, skipped } を想定。配列のみのフォールバックも許容）
    let rawQuestions: unknown[]
    const modelSkipped: SkippedItem[] = []
    try {
      const parsed = extractJson(claudeResponse)
      if (Array.isArray(parsed)) {
        rawQuestions = parsed
      } else if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>
        rawQuestions = Array.isArray(obj.questions) ? obj.questions : []
        if (Array.isArray(obj.skipped)) {
          for (const s of obj.skipped) {
            if (s && typeof s === 'object') {
              const so = s as Record<string, unknown>
              modelSkipped.push({
                category: typeof so.category === 'string' ? so.category : undefined,
                reason: typeof so.reason === 'string' ? so.reason : '参照データ不足',
              })
            }
          }
        }
      } else {
        throw new Error('生成結果が想定形式ではありません')
      }
    } catch (err) {
      console.error('[Quiz GenerateQuestions] JSONパースエラー:', err)
      console.error('[Quiz GenerateQuestions] Claude応答:', claudeResponse)
      return NextResponse.json(
        { error: 'AI応答の解析に失敗しました。再度お試しください。' },
        { status: 500 }
      )
    }

    // 6. サーバ側バリデーション（不正な設問はINSERTせずスキップ報告へ）
    const skipped: SkippedItem[] = [...modelSkipped]
    const validRows: {
      category: string
      question_text: string
      question_type: string
      options: { id: string; text: string }[]
      correct_option_id: string
      explanation: string | null
      reference_data: Record<string, unknown> | null
    }[] = []

    for (const raw of rawQuestions) {
      const q = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
      // category は WHY / HOW のみ許可（WHAT 等は不採用）。型・選択肢形状も厳格検証。
      const validated = validateQuizQuestion(q, {
        allowedCategories: GEN_CATEGORIES,
        enforceTypeShape: true,
      })
      if (!validated.ok) {
        skipped.push({
          category: typeof q.category === 'string' ? q.category : undefined,
          reason: validated.error,
        })
        continue
      }
      validRows.push({
        category: validated.category,
        question_text: validated.question_text,
        question_type: validated.question_type,
        options: validated.options,
        correct_option_id: validated.correct_option_id,
        explanation: typeof q.explanation === 'string' ? q.explanation : null,
        reference_data:
          q.reference_data && typeof q.reference_data === 'object'
            ? (q.reference_data as Record<string, unknown>)
            : null,
      })
    }

    // 7. 既存の最大sort_orderを取得して連番付与
    const { data: maxOrderData } = await supabase
      .from('brand_quiz_questions')
      .select('sort_order')
      .eq('quiz_id', id)
      .order('sort_order', { ascending: false })
      .limit(1)

    const maxSortOrder =
      maxOrderData && maxOrderData.length > 0 ? (maxOrderData[0].sort_order as number) : 0

    // 8. INSERT（source='ai_generated', is_active=true）。クイズの status は draft のまま。
    let created: unknown[] = []
    if (validRows.length > 0) {
      const rows = validRows.map((r, i) => ({
        quiz_id: id,
        category: r.category,
        question_text: r.question_text,
        question_type: r.question_type,
        options: r.options,
        correct_option_id: r.correct_option_id,
        explanation: r.explanation,
        source: 'ai_generated' as const,
        sort_order: maxSortOrder + 1 + i,
        is_active: true,
        reference_data: r.reference_data,
      }))

      const { data: inserted, error: insertError } = await supabase
        .from('brand_quiz_questions')
        .insert(rows)
        .select()

      if (insertError) {
        console.error('[Quiz GenerateQuestions] INSERT エラー:', insertError.message)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
      created = inserted ?? []
    }

    return NextResponse.json({ created, skipped }, { status: 201 })
  } catch (err) {
    console.error('[Quiz GenerateQuestions] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
