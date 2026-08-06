// サーベイ詳細画面のカード別AI考察
// POST /api/brand-score/surveys/[id]/insights
//
// 集計は画面側（inner-score API の結果）で済んでいるので、その要約を受け取って
// 文章化だけを担う。生成結果は brand_surveys.insights に保存し、明示的な
// 再生成があるまで使い回す。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { callClaude } from '@/lib/claude-api'

export const maxDuration = 60

type RouteContext = { params: Promise<{ id: string }> }

const INSIGHT_KEYS = ['overview', 'distribution', 'stages', 'funnel'] as const
type InsightKey = (typeof INSIGHT_KEYS)[number]

const SYSTEM = `あなたは組織のインナーブランディング調査を読み解くアナリストです。
社内向けの調査結果画面に添える、短い考察を書きます。

守ること:
- 日本語。1ブロックにつき2〜3文、120〜180字程度。
- 与えられた数値だけを根拠にする。与えられていない数値を作らない。
- 「〜と考えられます」「〜が重要です」のような一般論で終わらせない。
  どの数字がどう問題なのか、次に何をすべきかまで書く。
- 数値は必ず本文中に入れて、読み手が根拠を追えるようにする。
- 敬体（です・ます）。見出しや箇条書き、マークダウン記法は使わない。

用語:
- スコアは1〜5点の平均を0〜100に正規化した値。50が「どちらとも言えない」。
- 段階（認知〜推奨）は画面が5点満点で出しているため、段階スコア5点満点 の値を使う。
  3.0が「どちらとも言えない」、3.5が通過の基準。段階スコア0to100 は同じ値の別表記で、
  差を「pt」で語るときにだけ使う。両方を混ぜて1文に書かない。
- SP は現場、BO はバックオフィス（本社を含む）。
- 5段階は 認知→理解→共感→行動→推奨 の順に進む浸透の段階。
- 中立は反対ではなく、判断材料が届いていない層。`

const USER_TEMPLATE = (summary: unknown) => `以下はある会社のインナーブランディング調査の集計結果です。

${JSON.stringify(summary, null, 2)}

画面の4つのカードそれぞれに添える考察を書いてください。

- overview: 総合スコアと5段階スコアのカード。全体の水準と、どの段階が足を引っ張っているか。
  **このカードは0〜100で表示しているので、本文の数字も 段階スコア0to100 で書く**
  （例:「共感71.6に対して理解57.1」）。5点満点の値はここでは使わない。
- distribution: 肯定/中立/否定の回答分布のカード。中立の厚みと、SPとBOの分布の違い。
- stages: 段階別スコアのカード。段階間の高低の並びが何を意味するか、SPとBOの差が大きい段階。
  **このカードは5点満点で表示しているので、本文の数字も5点満点（小数第2位）で書く**
  （例:「共感はSP3.96・BO3.71」）。差を語るときだけ 0〜100 のポイントを使ってよく、
  そのときは「pt」と明記する（例:「理解はSP63.6・BO48.7で14.9ptの差」）。
- funnel: 段階の通過率のカード。人数ベースで見たときに何が起きているか、どこで最も落ちているか。

次のJSONだけを出力してください。前後に説明を付けないでください。
{"overview":"…","distribution":"…","stages":"…","funnel":"…"}`

/** ```json フェンス付きでも素のJSONでも取り出せるようにする */
function parseInsights(raw: string): Record<InsightKey, string> | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = (fenced?.[1] ?? raw).trim()
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start === -1 || end === -1) return null

  try {
    const parsed = JSON.parse(body.slice(start, end + 1))
    const result = {} as Record<InsightKey, string>
    for (const key of INSIGHT_KEYS) {
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
    if (!id) {
      return NextResponse.json({ error: 'Survey ID is required' }, { status: 400 })
    }

    const body = await request.json()
    if (!body?.summary) {
      return NextResponse.json({ error: 'summary is required' }, { status: 400 })
    }

    const raw = await callClaude({
      system: SYSTEM,
      userMessage: USER_TEMPLATE(body.summary),
      maxTokens: 2048,
      temperature: 0.3,
    })

    const insights = parseInsights(raw)
    if (!insights) {
      console.error('[Survey insights] 応答をJSONとして解釈できませんでした:', raw.slice(0, 500))
      return NextResponse.json({ error: '考察の生成に失敗しました' }, { status: 502 })
    }

    const generatedAt = new Date().toISOString()
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('brand_surveys')
      .update({ insights, insights_generated_at: generatedAt, updated_at: generatedAt })
      .eq('id', id)

    if (error) {
      console.error('[Survey insights] 保存エラー:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ insights, insights_generated_at: generatedAt })
  } catch (err) {
    console.error('[Survey insights] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
