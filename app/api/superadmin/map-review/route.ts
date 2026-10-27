// ブランドマップ AIレビューAPI（superadmin限定）
// POST /api/superadmin/map-review  body: { companyId, regenerate? }
// - 保存済みレビュー（brand_map_reviews）があればそれを返す（AI呼び出しなし・鮮度判定つき）
// - 無ければ生成して保存（初回の一度きり）。regenerate: true はボタン押下時のみ・上書き保存
// - 関係0件の会社は生成も保存もしない（案内 reason を返す）
import { NextRequest, NextResponse } from 'next/server'
import { getOrGenerateMapReview } from '@/lib/brand/map-review'
import { requireSuperadmin } from '@/lib/auth/caller'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const companyId = body?.companyId as string | undefined
    if (!companyId) {
      return NextResponse.json({ error: 'companyId は必須です' }, { status: 400 })
    }

    // superadmin 認証（判定は lib/auth/caller に一本化。Bearer と cookie の両方を受ける）
    const caller = await requireSuperadmin(request)
    if (caller.error) return caller.error

    const regenerate = body?.regenerate === true
    const result = await getOrGenerateMapReview(companyId, { regenerate })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[map-review] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
