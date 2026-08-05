// 5段階への候補の自動割り当て
// POST /api/brand-score/market-surveys/[id]/auto-map
//   body: { apply?: boolean }
//     apply=false（既定） … 候補を返すだけ
//     apply=true          … 候補をそのまま割り当てて段階スコアまで算出する
//
// 実処理は lib/brand-score/market-auto-map-server.ts。取り込み直後にも同じものを使う。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { runAutoMap } from '@/lib/brand-score/market-auto-map-server'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const apply = body?.apply === true

    const result = await runAutoMap(getSupabaseAdmin(), id, { apply })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[MarketAutoMap] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
