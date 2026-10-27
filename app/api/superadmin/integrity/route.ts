// ブランド整合性チェックAPI（superadmin限定・読み取りのみ）
// GET /api/superadmin/integrity?companyId=...
// 決定論的チェック（lib/brand/integrity.ts）を実行し findings を返す。AI不要。
import { NextRequest, NextResponse } from 'next/server'
import { runIntegrityChecks } from '@/lib/brand/integrity'
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

    const findings = await runIntegrityChecks(companyId)
    return NextResponse.json({ findings })
  } catch (err) {
    console.error('[integrity] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
