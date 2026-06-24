// ペルソナビルダー ジャーニーマップ提案API
// POST /api/tools/persona/suggest-journey
import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude-api'
import { getAdminContext } from '@/lib/learning/auth'
import { getGuardrailsPromptForCompany } from '@/lib/brand/guardrails'
import { getRelationsPromptForCompany } from '@/lib/brand/relations'

const SYSTEM_PROMPT = `あなたはブランドマーケティングの専門家です。以下のペルソナ情報をもとに、5段階のカスタマージャーニーマップを作成してください。回答はJSON形式のみで、前後に説明文やマークダウンのコードブロックを含めないでください。

5段階: 認知 → 興味 → 検討 → 購入 → 継続

出力JSONスキーマ:
{
  "stages": [
    {
      "name": "認知",
      "description": "このステージの概要（1文）",
      "actions": ["行動1", "行動2", "行動3"],
      "touchpoints": ["短い共通ラベル（2〜4個）"],
      "emotions": "感情の状態（1文）",
      "emotion_score": 数値（-2〜2、-2=非常にネガティブ、2=非常にポジティブ）,
      "pain_points": ["この段階での課題1", "この段階での課題2"],
      "opportunities": ["ブランドが提供できる価値1", "ブランドが提供できる価値2"]
    }
  ]
}

タッチポイント（touchpoints）は「ブランドが施策を当てる接点」を、各ステージ2〜4個、短い共通ラベルで挙げてください。複数ペルソナで横断集計するため、同じ接点には必ず同じ短い表記を使うこと。次の代表ラベルに該当すればその表記をそのまま使い、無い接点だけ短い汎用名を足してください:
Google検索 / Web広告 / SNS（X/LinkedIn） / LP（トップ） / 料金ページ / 事例ページ / 比較記事 / 資料ダウンロード / ウェビナー・セミナー / 展示会 / メルマガ / 問い合わせフォーム / 無料トライアル・デモ / 営業商談 / 稟議資料・提案書 / FAQ・サポート / スマート名刺
括弧での補足や長い説明は付けないこと（「Google検索広告（〜キーワード）」のような長い固有表記は禁止。短く正規化された接点名にする）。抽象的な感情・心情は touchpoints ではなく emotions / pain_points に書いてください。`

// 構造化データをプロンプト用テキストに変換
function formatBusinessDescriptions(basicInfo: Record<string, unknown>): string {
  const descs = basicInfo.business_descriptions as Array<{ title: string; description: string }> | undefined
  if (descs?.length) {
    return descs
      .filter(b => b.title?.trim())
      .map(b => b.description ? `${b.title}: ${b.description}` : b.title)
      .join('、')
  }
  if (basicInfo.products && typeof basicInfo.products === 'string') {
    return basicInfo.products as string
  }
  return ''
}

// ジャーニーJSONの堅牢パース（途中切れ耐性）:
// 1) ```json フェンスがあれば中身。2) 最初の { 〜最後の } を抽出。3) 失敗時は stages の完結要素までで復旧。
function parseJourney(raw: string): { stages: unknown[] } | null {
  let s = (raw || '').trim()
  const fence = s.match(/```json\s*([\s\S]*?)\s*```/)
  if (fence) s = fence[1]
  const start = s.indexOf('{')
  if (start < 0) return null
  const end = s.lastIndexOf('}')
  const candidate = end > start ? s.slice(start, end + 1) : s.slice(start)
  try {
    const v = JSON.parse(candidate)
    if (v && Array.isArray(v.stages)) return v as { stages: unknown[] }
  } catch { /* fall through to recovery */ }
  // 救済: stages 配列から完結したオブジェクトだけを集めて配列を閉じる
  const objs = recoverStageObjects(s)
  return objs.length > 0 ? { stages: objs } : null
}

function recoverStageObjects(s: string): unknown[] {
  const key = s.indexOf('"stages"')
  if (key < 0) return []
  const arrStart = s.indexOf('[', key)
  if (arrStart < 0) return []
  const out: unknown[] = []
  let depth = 0, objStart = -1, inStr = false, esc = false
  for (let i = arrStart + 1; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') { inStr = true; continue }
    if (c === '{') { if (depth === 0) objStart = i; depth++ }
    else if (c === '}') {
      depth--
      if (depth === 0 && objStart >= 0) {
        try { out.push(JSON.parse(s.slice(objStart, i + 1))) } catch { /* skip broken element */ }
        objStart = -1
      }
    } else if (c === ']' && depth === 0) {
      break // stages 配列の正常終端
    }
  }
  return out
}

export async function POST(request: NextRequest) {

  try {
    const body = await request.json()
    const { basic_info, demographics, goals } = body

    if (!basic_info || !demographics) {
      return NextResponse.json({ error: 'basic_info と demographics が必要です' }, { status: 400 })
    }

    const parts: string[] = []
    parts.push('## 企業情報')
    if (basic_info.company_name) parts.push(`- 企業名: ${basic_info.company_name}`)
    if (basic_info.industry_category) parts.push(`- 業種: ${basic_info.industry_category}`)

    const bizText = formatBusinessDescriptions(basic_info)
    if (bizText) parts.push(`- 事業内容: ${bizText}`)

    parts.push('')
    parts.push('## ペルソナ')
    if (demographics.persona_name) parts.push(`- 名前: ${demographics.persona_name}（${demographics.age}歳・${demographics.gender}）`)
    if (demographics.occupation) parts.push(`- 職業: ${demographics.occupation}`)
    if (demographics.company_role) parts.push(`- 役職: ${demographics.company_role}`)
    if (demographics.media_channels?.length) parts.push(`- 情報収集: ${demographics.media_channels.join('、')}`)

    if (goals) {
      parts.push('')
      parts.push('## ゴール・課題')
      if (goals.primary_goals?.length) parts.push(`- 目標: ${goals.primary_goals.join('、')}`)
      if (goals.pain_points?.length) parts.push(`- 課題: ${goals.pain_points.join('、')}`)
      if (goals.buying_motivation) parts.push(`- 購買動機: ${goals.buying_motivation}`)
      if (goals.buying_barriers?.length) parts.push(`- 購買障壁: ${goals.buying_barriers.join('、')}`)
    }

    parts.push('')
    parts.push('上記のペルソナの5段階カスタマージャーニーマップをJSON形式で作成してください。')

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
      userMessage: parts.join('\n'),
      maxTokens: 8000, // ジャーニーは5段階×8項目で全suggge系の最大出力。途中切れ防止に十分確保
    })

    const parsed = parseJourney(response)
    if (!parsed) {
      console.error('[SuggestJourney] JSONパースエラー:', response.substring(0, 300))
      return NextResponse.json(
        { error: 'AIの応答を解析できませんでした。再度お試しください。' },
        { status: 500 }
      )
    }

    if (!parsed.stages || !Array.isArray(parsed.stages)) {
      return NextResponse.json(
        { error: 'AIの応答形式が不正です。再度お試しください。' },
        { status: 500 }
      )
    }

    return NextResponse.json({ journey: parsed })
  } catch (err) {
    console.error('[SuggestJourney] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
