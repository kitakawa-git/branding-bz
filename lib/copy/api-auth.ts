// コピーAI API 共通 superadmin ガード（既存 /api/superadmin/copy/* と同型）。
// 判定は lib/auth/caller の requireSuperadmin に一本化（Bearer と cookie の両方を受ける）。
// 呼び出し側の互換のため { ok, userId } / { ok, res } の形で返す。
import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadmin as requireSuperadminCaller } from '@/lib/auth/caller'

export async function requireSuperadmin(
  request: NextRequest,
): Promise<{ ok: true; userId: string } | { ok: false; res: NextResponse }> {
  const caller = await requireSuperadminCaller(request)
  if (caller.error) return { ok: false, res: caller.error }
  return { ok: true, userId: caller.authId }
}
