// バリュー評価シート AI 5段階基準生成API
// POST /api/brand-score/evaluation-sheets/[id]/generate-criteria
// ============================================================
// 各評価項目（＝バリュー）について Lv1〜Lv5 の「観察可能な行動記述」を
// Claude（Sonnet）で生成する。流用元は既存 quizzes/[id]/generate-questions:
//   - ブランドデータ取得は共通関数 fetchBrandData / hasSufficientData
//   - Anthropic クライアント・モデルは lib/claude-api.ts の callClaude
//     （モデル文字列はハードコードしない）
//   - JSON抽出は fence 除去してから安全に parse
//
// 重要: このAPIは生成結果を返すのみ。DBへの確定保存はしない
//   （クライアントがレビュー・上書き確認のうえ criteria PATCH で保存する）。
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminContext } from '@/lib/learning/auth'
import { callClaude } from '@/lib/claude-api'
import { fetchBrandData, hasSufficientData } from '@/lib/brand-score/brand-data'
import { normalizeLevels } from '@/lib/brand-score/evaluation'

type RouteContext = { params: Promise<{ id: string }> }

// 生成対象1件（モデルへ渡す）
interface TargetCriterion {
  id: string
  title: string
  description: string | null
  source_type: string
}

// システムプロンプト（バリュー評価の5段階行動記述の作成方針）
function buildSystemPrompt(): string {
  return `あなたは中小企業の人事評価制度を設計する専門家です。
企業のブランドデータ（＝事実）を根拠に、与えられた各「評価項目（多くは自社のバリュー）」について、
1〜5段階の「観察可能な行動記述」を作成してください。これは人事評価のたたき台になります。

【5段階レベルの設計基準】
- Lv1: 期待を満たさない最低限（例: 指示されたことを指示通りにこなすだけ）
- Lv2: 一部できている
- Lv3: 期待どおり（その役割の標準）
- Lv4: 期待を上回る
- Lv5: 模範・卓越し、周囲を巻き込む
- レベル間が連続的に上がること（飛びや重複がないように、段階的に行動の質・範囲・主体性が高まる）。

【記述ルール】
1. すべて「観察可能な行動」で書く。「意識している」「心がけている」ではなく「〜している」と外から確認できる行動で書く。
2. そのバリューの意味・関連する行動指針・業種を踏まえ、その会社に固有の具体行動を織り込む（抽象語の言い換えに終わらせない）。
3. 中小企業の現場で実際に使える粒度にする。1レベルあたり1〜2文。
4. 捏造禁止: ブランドデータに無い価値観・事業内容を勝手に作らない。汚染・不整合なデータは無視し、整合するデータのみを根拠にする。データが薄い場合は、そのバリューの一般的な意味の範囲で具体行動に落とすが、存在しない事業内容・固有名詞は作らない。
5. 生成結果は下書き（draft）であり、配信前に管理者レビューが必須である前提で作る（断定的に確定情報として書かない）。

【入力】
- brand: 企業のブランドデータ（理念・戦略・トーン・用語等）
- industry: 業種（あれば）
- criteria: 5段階基準を作る評価項目の配列。各要素に id / title / description がある。

【出力形式】
以下のJSONのみを出力する。前置き・説明文・Markdownコードフェンス（\`\`\`）は一切禁止。
criteria 配列には、入力で渡された各評価項目について1件ずつ、入力の "id" をそのまま echo して返すこと。
{
  "criteria": [
    {
      "id": "<入力の評価項目id をそのまま>",
      "title": "<評価項目名>",
      "levels": [
        { "level": 1, "description": "..." },
        { "level": 2, "description": "..." },
        { "level": 3, "description": "..." },
        { "level": 4, "description": "..." },
        { "level": 5, "description": "..." }
      ]
    }
  ]
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

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await getAdminContext()
    if (!ctx) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const mode = body?.mode === 'single' ? 'single' : 'all'
    const criterionId = typeof body?.criterion_id === 'string' ? body.criterion_id : null

    if (mode === 'single' && !criterionId) {
      return NextResponse.json({ error: 'criterion_id is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // 1. シート取得（自社のものか検証）
    const { data: sheet, error: sheetError } = await supabase
      .from('evaluation_sheets')
      .select('id, company_id')
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .single()

    if (sheetError || !sheet) {
      const status = sheetError?.code === 'PGRST116' ? 404 : 500
      return NextResponse.json(
        { error: sheetError?.message || 'シートが見つかりません' },
        { status }
      )
    }

    const companyId = sheet.company_id

    // 2. 生成対象の評価項目を取得
    let targetQuery = supabase
      .from('evaluation_criteria')
      .select('id, title, description, source_type')
      .eq('sheet_id', id)
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true })

    if (mode === 'single') {
      targetQuery = targetQuery.eq('id', criterionId as string)
    } else {
      // 一括生成は有効な項目のみ
      targetQuery = targetQuery.eq('is_active', true)
    }

    const { data: targetsRaw, error: targetsError } = await targetQuery
    if (targetsError) {
      console.error('[GenerateCriteria] 対象取得エラー:', targetsError.message)
      return NextResponse.json({ error: targetsError.message }, { status: 500 })
    }

    const targets: TargetCriterion[] = (targetsRaw ?? []).map((t) => ({
      id: t.id as string,
      title: (t.title as string) ?? '',
      description: (t.description as string) ?? null,
      source_type: (t.source_type as string) ?? 'value',
    }))

    if (targets.length === 0) {
      return NextResponse.json(
        { error: '生成対象の評価項目がありません。先に評価項目を作成してください。' },
        { status: 400 }
      )
    }

    // 3. ブランドデータ取得（既存サーベイ／クイズと同一の共通関数）
    const brandData = await fetchBrandData(supabase, companyId)

    if (!hasSufficientData(brandData)) {
      return NextResponse.json(
        { error: 'ブランドデータが不足しています。先にブランド情報を登録してください。' },
        { status: 400 }
      )
    }

    // 業種（あれば添える。カラム不在の環境でもエラーにしない）
    let industry: { category?: unknown; subcategory?: unknown } | undefined
    const { data: companyExtra, error: companyExtraError } = await supabase
      .from('companies')
      .select('industry_category, industry_subcategory')
      .eq('id', companyId)
      .single()
    if (!companyExtraError && companyExtra) {
      industry = {
        category: companyExtra.industry_category,
        subcategory: companyExtra.industry_subcategory,
      }
    }

    // 4. Claude API 呼び出し
    const userPayload = {
      brand: brandData,
      industry,
      criteria: targets.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
      })),
    }

    let claudeResponse: string
    try {
      claudeResponse = await callClaude({
        system: buildSystemPrompt(),
        userMessage: JSON.stringify(userPayload, null, 2),
        maxTokens: 8192,
      })
    } catch (err) {
      console.error('[GenerateCriteria] Claude APIエラー:', err)
      return NextResponse.json(
        { error: 'AI生成に失敗しました。しばらく経ってから再度お試しください。' },
        { status: 500 }
      )
    }

    // 5. レスポンスパース（{ criteria } を想定。配列のみのフォールバックも許容）
    let rawCriteria: unknown[]
    try {
      const parsed = extractJson(claudeResponse)
      if (Array.isArray(parsed)) {
        rawCriteria = parsed
      } else if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>
        rawCriteria = Array.isArray(obj.criteria) ? obj.criteria : []
      } else {
        throw new Error('生成結果が想定形式ではありません')
      }
    } catch (err) {
      console.error('[GenerateCriteria] JSONパースエラー:', err)
      console.error('[GenerateCriteria] Claude応答:', claudeResponse)
      return NextResponse.json(
        { error: 'AI応答の解析に失敗しました。再度お試しください。' },
        { status: 500 }
      )
    }

    // 6. 入力で渡した評価項目id にのみマッピング（ハルシネーションのidは無視）。
    //    id が一致した分だけ levels を正規化して返す。DBへは保存しない。
    const targetById = new Map(targets.map((t) => [t.id, t]))
    const resultCriteria: { id: string; title: string; levels: ReturnType<typeof normalizeLevels> }[] = []
    const seen = new Set<string>()

    for (const raw of rawCriteria) {
      if (!raw || typeof raw !== 'object') continue
      const obj = raw as Record<string, unknown>
      const cid = typeof obj.id === 'string' ? obj.id : null
      if (!cid || !targetById.has(cid) || seen.has(cid)) continue
      seen.add(cid)
      resultCriteria.push({
        id: cid,
        title: targetById.get(cid)!.title,
        levels: normalizeLevels(obj.levels),
      })
    }

    return NextResponse.json({ criteria: resultCriteria }, { status: 200 })
  } catch (err) {
    console.error('[GenerateCriteria] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
