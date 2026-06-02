// 管理画面「設定」: 機能トグル更新API
// PATCH /api/admin/settings  body: { company_id, <toggle_key>: boolean, ... }
// service_role で companies を更新する。更新対象は呼び出し管理者の company_id に限定（他社レコードは更新不可）。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { supabase } from '@/lib/supabase'
import { FEATURE_TOGGLE_COLUMNS } from '@/lib/constants/feature-toggles'

// 認証ユーザーの company_id を取得（admin_users 登録者のみ）
async function getAdminCompanyId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null

  const supabaseAdmin = getSupabaseAdmin()
  const { data: admin } = await supabaseAdmin
    .from('admin_users')
    .select('company_id')
    .eq('auth_id', user.id)
    .single()

  return admin?.company_id || null
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 })
    }

    const { company_id: bodyCompanyId, ...rest } = body as Record<string, unknown>

    // 呼び出し管理者の company_id（サーバー側で確定）
    const adminCompanyId = await getAdminCompanyId(request)
    if (!adminCompanyId) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    // ボディの company_id が自社と一致しない更新は拒否（他社レコード更新の防止）
    if (bodyCompanyId && bodyCompanyId !== adminCompanyId) {
      return NextResponse.json({ error: '他社のレコードは更新できません' }, { status: 403 })
    }

    // 許可されたトグルカラムのみ、boolean 値のみ受け付ける
    const updates: Record<string, boolean> = {}
    for (const key of FEATURE_TOGGLE_COLUMNS) {
      if (key in rest) {
        const value = rest[key]
        if (typeof value !== 'boolean') {
          return NextResponse.json(
            { error: `${key} は boolean で指定してください` },
            { status: 400 }
          )
        }
        updates[key] = value
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '更新対象の項目がありません' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('companies')
      .update(updates)
      .eq('id', adminCompanyId) // 自社のみ
      .select(['id', ...FEATURE_TOGGLE_COLUMNS].join(', '))
      .single()

    if (error) {
      console.error('[AdminSettings PATCH] 更新エラー:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, company: data })
  } catch (err) {
    console.error('[AdminSettings PATCH] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
