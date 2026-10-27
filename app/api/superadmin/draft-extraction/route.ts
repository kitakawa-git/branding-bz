// AI草案生成API（superadmin限定・読み取り専用）
// POST /api/superadmin/draft-extraction  body: { companyId, kind: 'proof' | 'rule' }
// 登録済みデータから証拠・実績／表現ルールの草案を抽出して返すだけ。DBへは書き込まない
// （登録はUIでの承認後、クライアント supabase INSERT。Claude を呼ぶため POST・明示実行のみ）。
import { NextRequest, NextResponse } from 'next/server'
import { extractProofDrafts, extractRuleDrafts } from '@/lib/brand/draft-extraction'
import { requireSuperadmin } from '@/lib/auth/caller'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const companyId = body?.companyId as string | undefined
    const kind = body?.kind as string | undefined
    if (!companyId) {
      return NextResponse.json({ error: 'companyId は必須です' }, { status: 400 })
    }
    if (kind !== 'proof' && kind !== 'rule') {
      return NextResponse.json({ error: "kind は 'proof' または 'rule' を指定してください" }, { status: 400 })
    }

    // superadmin 認証（判定は lib/auth/caller に一本化。Bearer と cookie の両方を受ける）
    const caller = await requireSuperadmin(request)
    if (caller.error) return caller.error

    const drafts = kind === 'proof' ? await extractProofDrafts(companyId) : await extractRuleDrafts(companyId)
    return NextResponse.json({ drafts })
  } catch (err) {
    console.error('[draft-extraction] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
