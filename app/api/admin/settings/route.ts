// 管理画面「設定」: 機能トグル更新API
// PATCH /api/admin/settings  body: { company_id, <toggle_key>: boolean, ... }
// service_role で companies を更新する。更新対象は呼び出し管理者の company_id に限定（他社レコードは更新不可）。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { supabase } from '@/lib/supabase'
import { FEATURE_TOGGLE_COLUMNS } from '@/lib/constants/feature-toggles'
import { GATEABLE_PORTAL_PAGES, MEMBER_ROLE_OPTIONS, type RoleVisibilityConfig } from '@/lib/constants/member-roles'

const GATEABLE_PAGE_KEYS = new Set(GATEABLE_PORTAL_PAGES.map(p => p.key))
const ROLE_KEYS = new Set(MEMBER_ROLE_OPTIONS.map(o => o.value as string))

// portal_role_visibility の形を検証して正規化（不正なら null を返す）。
// 期待形: { "<pageKey>": { "executive": bool, "manager": bool, "staff": bool } }
function normalizeRoleVisibility(input: unknown): RoleVisibilityConfig | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const out: RoleVisibilityConfig = {}
  for (const [pageKey, roleMap] of Object.entries(input as Record<string, unknown>)) {
    if (!GATEABLE_PAGE_KEYS.has(pageKey)) return null
    if (!roleMap || typeof roleMap !== 'object' || Array.isArray(roleMap)) return null
    const roles: Record<string, boolean> = {}
    for (const [role, val] of Object.entries(roleMap as Record<string, unknown>)) {
      if (!ROLE_KEYS.has(role)) return null
      if (typeof val !== 'boolean') return null
      roles[role] = val
    }
    out[pageKey] = roles
  }
  return out
}

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

    // 許可されたトグルカラム（boolean）と区分表示設定（jsonb）のみ受け付ける
    const updates: Record<string, unknown> = {}
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

    if ('portal_role_visibility' in rest) {
      const normalized = normalizeRoleVisibility(rest.portal_role_visibility)
      if (!normalized) {
        return NextResponse.json(
          { error: 'portal_role_visibility の形式が不正です' },
          { status: 400 }
        )
      }
      updates.portal_role_visibility = normalized
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '更新対象の項目がありません' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('companies')
      .update(updates)
      .eq('id', adminCompanyId) // 自社のみ
      .select(['id', 'portal_role_visibility', ...FEATURE_TOGGLE_COLUMNS].join(', '))
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
