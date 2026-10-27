// ブランドプロファイリング 質問生成API（superadmin限定・読み取りのみ）
// GET /api/superadmin/profiling?companyId=...&includeAcknowledged=1
// 整合性チェックの検出結果を質問キューに変換して返す（決定論・AI不要）。DBへは書き込まない。
// includeAcknowledged=1 で保留済み（まだ無い/わからない）の質問も再表示する。
import { NextRequest, NextResponse } from 'next/server'
import { generateProfilingQuestions } from '@/lib/brand/profiling'
import { requireSuperadmin } from '@/lib/auth/caller'

export async function GET(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId は必須です' }, { status: 400 })
    }

    // superadmin 認証（判定は lib/auth/caller に一本化。Bearer と cookie の両方を受ける）
    const caller = await requireSuperadmin(request)
    if (caller.error) return caller.error

    const includeAcknowledged = request.nextUrl.searchParams.get('includeAcknowledged') === '1'
    const result = await generateProfilingQuestions(companyId, { includeAcknowledged })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[profiling] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
