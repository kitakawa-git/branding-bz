// AI関係スキャンAPI（superadmin限定・読み取り専用）
// POST /api/superadmin/relation-scan  body: { companyId, focus?: { kind, id } }
// Claude を呼ぶ（コスト発生）ため GET でなく POST・明示実行のみ。
// 候補を返すだけでDBへは書き込まない。登録はUIでの承認後（クライアント supabase INSERT）。
// focus を渡すと「その要素の繋ぎ先だけ」を提案する焦点スキャンになる（未指定なら従来の全体スキャン）。
import { NextRequest, NextResponse } from 'next/server'
import { scanRelationCandidates, type FocusRef } from '@/lib/brand/relation-scan'
import { KIND_LABELS, type ElementKind } from '@/lib/brand/elements-catalog'
import { requireSuperadmin } from '@/lib/auth/caller'

// focus の形だけをここで検証する（実在チェックは scanRelationCandidates がカタログ照合で行う）
function parseFocus(v: unknown): FocusRef | null {
  if (!v || typeof v !== 'object') return null
  const o = v as { kind?: unknown; id?: unknown }
  const kind = typeof o.kind === 'string' ? o.kind : ''
  const id = typeof o.id === 'string' ? o.id.trim() : ''
  if (!id) return null
  if (!Object.prototype.hasOwnProperty.call(KIND_LABELS, kind)) return null
  return { kind: kind as ElementKind, id }
}

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

    const candidates = await scanRelationCandidates(companyId, parseFocus(body?.focus))
    return NextResponse.json({ candidates })
  } catch (err) {
    console.error('[relation-scan] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
