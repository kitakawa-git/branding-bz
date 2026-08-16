// 市場調査の詳細画面のカード別AI考察
// POST /api/brand-score/market-surveys/[id]/insights
//
// 集計は画面側で済んでいるので、その要約を受け取って文章化だけを担う
// （サーベイ詳細の insights と同じ作り）。生成結果は market_surveys.insights に
// 保存し、明示的な再生成があるまで使い回す。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireResourceCompany } from '@/lib/billing/guard'
import { callClaude } from '@/lib/claude-api'

export const maxDuration = 60

type RouteContext = { params: Promise<{ id: string }> }

/**
 * カードのキーと、そのカードに何を書いてほしいか。
 * summary に該当データが無い調査（設問が無い年度もある）では、そのキーを
 * 依頼しない。存在しないカードの考察を書かせても置き場所が無い。
 */
const SECTIONS = [
  {
    key: 'stages',
    summaryKey: '五段階',
    ask: '5段階（認知→想起→評価→利用→推奨）のカード。どの段階が弱く、競合との位置関係はどうか。',
  },
  {
    key: 'impression',
    summaryKey: '市場の期待と自社イメージ',
    ask: '市場が重視する点と自社イメージのカード。順位のずれが大きい項目と、その意味。',
  },
  {
    key: 'personality',
    summaryKey: 'ブランドパーソナリティ',
    ask: 'ブランドパーソナリティのカード。強く出ている性格と、出ていない性格。',
  },
  {
    key: 'contact',
    summaryKey: '認知経路',
    ask: '認知経路のカード。どの経路で知られているか、認知を伸ばすならどこか。',
  },
  {
    key: 'services',
    summaryKey: '事業浸透度',
    ask: '事業浸透度のカード。サービス間の差が何を示すか。',
  },
  {
    key: 'evaluation',
    summaryKey: 'サービス評価',
    ask: 'サービス評価のカード。評価されている点と、相対的に低い点。',
  },
] as const

const SYSTEM = `あなたは企業のブランド認知度調査を読み解くアナリストです。
調査結果画面に添える、短い考察を書きます。

守ること:
- 日本語。1ブロックにつき2〜3文、120〜180字程度。
- 与えられた数値だけを根拠にする。与えられていない数値を作らない。
- 「〜と考えられます」「〜が重要です」のような一般論で終わらせない。
  どの数字がどう問題なのか、次に何をすべきかまで書く。
- 数値は必ず本文中に入れて、読み手が根拠を追えるようにする。
- 敬体（です・ます）。見出しや箇条書き、マークダウン記法は使わない。

読み方の注意:
- 5段階のスコアは生の%ではなく、段階ごとの物差しで0〜100に変換した値。
  段階どうしはスコアで比べ、%の大小では比べない。
- 想起は純粋想起（何も見せずに社名を挙げてもらう設問）なので、
  助成想起の認知に比べて%が構造的に低く出る。低さ自体を弱点として書かない。
- 「市場が重視する点」は全数ベース、「自社イメージ」は自社を知っている人ベースで
  分母が違う。%の差を引き算せず、順位で比べる。
- 競合の順位は、回答者が少なすぎる会社を除いたうえでの順位。`

function buildUserMessage(summary: Record<string, unknown>, keys: readonly string[]) {
  const asks = SECTIONS.filter((s) => keys.includes(s.key))
    .map((s) => `- ${s.key}: ${s.ask}`)
    .join('\n')
  const shape = `{${keys.map((k) => `"${k}":"…"`).join(',')}}`

  return `以下はある会社のブランド認知度調査（外部の市場調査）の集計結果です。

${JSON.stringify(summary, null, 2)}

画面のカードそれぞれに添える考察を書いてください。

${asks}

次のJSONだけを出力してください。前後に説明を付けないでください。
${shape}`
}

/** ```json フェンス付きでも素のJSONでも取り出せるようにする */
function parseInsights(raw: string, keys: readonly string[]): Record<string, string> | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = (fenced?.[1] ?? raw).trim()
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start === -1 || end === -1) return null

  try {
    const parsed = JSON.parse(body.slice(start, end + 1))
    const result: Record<string, string> = {}
    for (const key of keys) {
      const v = parsed[key]
      if (typeof v !== 'string' || !v.trim()) return null
      result[key] = v.trim()
    }
    return result
  } catch {
    return null
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    // URL のリソース ID から会社を引き、呼び出し元の所属を照合する
    // （generate-questions で確立した形。これが無いと他社の ID で中身が返る）
    const scope = await requireResourceCompany('market_surveys', id)
    if (scope.error) return scope.error
    if (!id) {
      return NextResponse.json({ error: 'Survey ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const summary = body?.summary as Record<string, unknown> | undefined
    if (!summary) {
      return NextResponse.json({ error: 'summary is required' }, { status: 400 })
    }

    // データが無い区画は最初から依頼しない
    const keys = SECTIONS.filter((s) => summary[s.summaryKey] != null).map((s) => s.key)
    if (keys.length === 0) {
      return NextResponse.json({ error: '考察を書ける集計がありません' }, { status: 400 })
    }

    const raw = await callClaude({
      system: SYSTEM,
      userMessage: buildUserMessage(summary, keys),
      maxTokens: 2048,
      temperature: 0.3,
    })

    const insights = parseInsights(raw, keys)
    if (!insights) {
      console.error('[MarketSurvey insights] 応答をJSONとして解釈できませんでした:', raw.slice(0, 500))
      return NextResponse.json({ error: '考察の生成に失敗しました' }, { status: 502 })
    }

    const generatedAt = new Date().toISOString()
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('market_surveys')
      .update({ insights, insights_generated_at: generatedAt, updated_at: generatedAt })
      .eq('id', id)

    if (error) {
      console.error('[MarketSurvey insights] 保存エラー:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ insights, insights_generated_at: generatedAt })
  } catch (err) {
    console.error('[MarketSurvey insights] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
