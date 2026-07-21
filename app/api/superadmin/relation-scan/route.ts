// AI関係スキャンAPI（superadmin限定・読み取り専用）
// POST /api/superadmin/relation-scan  body: { companyId, focus?: { kind, id } }
// Claude を呼ぶ（コスト発生）ため GET でなく POST・明示実行のみ。
// 候補を返すだけでDBへは書き込まない。登録はUIでの承認後（クライアント supabase INSERT）。
// focus を渡すと「その要素の繋ぎ先だけ」を提案する焦点スキャンになる（未指定なら従来の全体スキャン）。
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { scanRelationCandidates, type FocusRef } from '@/lib/brand/relation-scan'
import { KIND_LABELS, type ElementKind } from '@/lib/brand/elements-catalog'

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

    // superadmin 認証（superadmin API 共通の方針）
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証が必要です。再ログインしてください。' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '')
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '認証エラー: セッションが無効です。' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: adminUser } = await supabaseAdmin
      .from('admin_users')
      .select('is_superadmin')
      .eq('auth_id', user.id)
      .maybeSingle()
    if (!adminUser?.is_superadmin) {
      return NextResponse.json({ error: 'スーパー管理者権限が必要です。' }, { status: 403 })
    }

    const candidates = await scanRelationCandidates(companyId, parseFocus(body?.focus))
    return NextResponse.json({ candidates })
  } catch (err) {
    console.error('[relation-scan] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
