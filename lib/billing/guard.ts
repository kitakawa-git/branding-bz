// API Route でプランを判定するためのサーバ側ヘルパー。
//
// 判定そのものは entitlements に任せ、ここは「会社のプランを引く」「403 を組み立てる」
// という API 都合の部分だけを持つ。
//
// ⚠️ UI でボタンを隠すだけでは URL 直叩きで通ってしまうため、
//    ゲートはこの層（サーバ側）に置くこと。
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  can,
  minimumPlanFor,
  getEffectivePlan,
  getMaxMembers,
  fitsWithinMemberLimit,
  type FeatureKey,
  type Plan,
  type PlanBearer,
} from './entitlements'

/** 会社のプラン判定に必要な列だけを引く。company_id が無ければ null */
export async function fetchCompanyPlan(companyId: string | null | undefined): Promise<PlanBearer> {
  if (!companyId) return null
  const { data } = await getSupabaseAdmin()
    .from('companies')
    .select('plan, plan_expires_at')
    .eq('id', companyId)
    .maybeSingle()
  return data ?? null
}

/** auth_id から所属会社を引く（admin_users → members の順に見る） */
export async function fetchCompanyIdForAuth(authId: string | null | undefined): Promise<string | null> {
  if (!authId) return null
  const supabase = getSupabaseAdmin()
  const { data: admin } = await supabase
    .from('admin_users').select('company_id').eq('auth_id', authId).maybeSingle()
  if (admin?.company_id) return admin.company_id
  const { data: member } = await supabase
    .from('members').select('company_id').eq('auth_id', authId).maybeSingle()
  return member?.company_id ?? null
}

/**
 * 403 のレスポンス。UI 側のアップセル表示で使えるよう、必要プランを含める。
 * 形は指示書 v1 §3-2 のとおり。
 */
export function planRequiredResponse(feature: FeatureKey): NextResponse {
  return NextResponse.json(
    { error: 'plan_required', requiredPlan: minimumPlanFor(feature), feature },
    { status: 403 },
  )
}

/** 使用量超過の 429。上限は超えたがプランは足りている場合に使う */
export function usageLimitResponse(message: string, resetsAt?: string): NextResponse {
  return NextResponse.json(
    { error: 'usage_limit_exceeded', message, ...(resetsAt ? { resetsAt } : {}) },
    { status: 429 },
  )
}

/**
 * company_id からプランを引いて機能を判定する。
 * 使える場合は null、使えない場合は 403 のレスポンスを返す。
 *
 *   const denied = await guardCompanyFeature(companyId, 'kpi')
 *   if (denied) return denied
 */
export async function guardCompanyFeature(
  companyId: string | null | undefined,
  feature: FeatureKey,
): Promise<NextResponse | null> {
  const company = await fetchCompanyPlan(companyId)
  return can(company, feature) ? null : planRequiredResponse(feature)
}

/** 会社の実効プランを返す。プランで挙動を変えたい（止めない）ときに使う */
export async function getCompanyEffectivePlan(
  companyId: string | null | undefined,
): Promise<Plan> {
  return getEffectivePlan(await fetchCompanyPlan(companyId))
}

/**
 * 構築ツールのセッションから会社を引く。
 * PDF 出力・本体連携のゲートで使う（未ログインのセッションは company_id が null）。
 */
export async function fetchCompanyIdForSession(sessionId: string | null | undefined): Promise<string | null> {
  if (!sessionId) return null
  const { data } = await getSupabaseAdmin()
    .from('mini_app_sessions').select('company_id').eq('id', sessionId).maybeSingle()
  return data?.company_id ?? null
}

/** profile_id から所属会社を引く（公開名刺ページの記録系で使う） */
export async function fetchCompanyIdForProfile(profileId: string | null | undefined): Promise<string | null> {
  if (!profileId) return null
  const { data } = await getSupabaseAdmin()
    .from('profiles').select('company_id').eq('id', profileId).maybeSingle()
  return data?.company_id ?? null
}

/**
 * 公開ページからの記録（名刺の閲覧ログ等）を残してよいか。
 *
 * ここは 403 を返さない。名刺ページ自体は free でも見えるままにする方針で
 * （配布済みの QR を殺さない）、記録だけを止める。閲覧者のブラウザに
 * エラーを出しても意味がないため、呼び出し側は 200 + recorded:false を返す。
 */
export async function canRecordAnalytics(companyId: string | null | undefined): Promise<boolean> {
  return can(await fetchCompanyPlan(companyId), 'cardAnalytics')
}

/**
 * メンバーを追加できるか（プランごとの人数上限）。
 *
 * 上限そのものは entitlements.getMaxMembers が正本。ここは「今何人いるか」を
 * 数えて突き合わせるだけ。UI で追加ボタンを隠しても API を直接叩けば通るので、
 * メンバーを作る経路（個別作成・CSV一括・自己登録・参加申請の承認）はすべて
 * この関数を通す。
 *
 * @param adding これから増やす人数。CSV一括のように複数入れる場合に使う
 */
export async function checkMemberCapacity(
  companyId: string | null | undefined,
  adding = 1,
): Promise<{ ok: true } | { ok: false; limit: number; current: number; plan: Plan }> {
  const company = await fetchCompanyPlan(companyId)
  const plan = getEffectivePlan(company)
  const limit = getMaxMembers(plan)
  if (limit === null) return { ok: true }

  // 数えるのは席を実際に占めている人だけ。参加申請中（status='pending'・
  // is_active=false）は承認するまで席を使わない。承認する側でこの関数を通す
  const { count } = await getSupabaseAdmin()
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId as string)
    .eq('is_active', true)
  const current = count ?? 0

  if (fitsWithinMemberLimit(limit, current, adding)) return { ok: true }
  return { ok: false, limit, current, plan }
}

/**
 * 人数上限に当たったときの 403。
 * UI はこの本文をそのまま出せばよいので、次の一手（上位プランへ）まで含める。
 */
export function memberLimitResponse(info: { limit: number; current: number; plan: Plan }): NextResponse {
  return NextResponse.json(
    {
      error: 'member_limit_exceeded',
      message:
        `${PLAN_LABELS_FOR_ERROR[info.plan] ?? info.plan} プランのメンバー上限は ${info.limit}名です` +
        `（現在 ${info.current}名）。人数を増やすには上位プランへの変更をリクエストしてください。`,
      limit: info.limit,
      current: info.current,
    },
    { status: 403 },
  )
}

/** エラーメッセージ用の最小限のラベル。表示用の plan-display は 'use client' 側なので持ち込まない */
const PLAN_LABELS_FOR_ERROR: Record<string, string> = {
  free: 'Free',
  card: 'Card',
  standard: 'Standard',
  premium: 'Premium',
  enterprise: 'Enterprise',
}

/**
 * 呼び出し元がその会社に属していることを確かめる。
 *
 * ⚠️ guardCompanyFeature は「その会社のプランで使えるか」しか見ない。
 *    company_id をクライアントから受け取るルートでは、それだけでは
 *    他社の ID を渡された時に素通りしてしまう（他社データの読み書き）。
 *    service_role で company スコープのデータを触るルートは、必ずこれを先に通すこと。
 *
 * 返り値が NextResponse ならそのまま return する。null なら通過。
 */
export async function requireCompanyMember(companyId: string): Promise<NextResponse | null> {
  // 動的 import は循環参照を避けるため（supabase/server は next/headers に依存する）
  const { createClient } = await import('@/lib/supabase/server')
  const supabaseUser = await createClient()
  const {
    data: { user },
  } = await supabaseUser.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }
  const callerCompanyId = await fetchCompanyIdForAuth(user.id)
  if (!callerCompanyId || callerCompanyId !== companyId) {
    // 存在の有無を教えないため、権限不足と資源なしを区別せず 403 で返す
    return NextResponse.json({ error: 'この会社のデータにはアクセスできません' }, { status: 403 })
  }
  return null
}

/** AI 機能の実行を記録する。集計・上限判定の材料。失敗しても本体は止めない */
export async function recordAiFeatureUsage(
  companyId: string,
  featureKey: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('ai_feature_usage')
    .insert({ company_id: companyId, feature_key: featureKey, metadata })
  if (error) console.error('[ai_feature_usage] 記録に失敗:', error.message)
}

/**
 * URL のリソース ID から会社を引き、呼び出し元の所属を照合する。
 *
 * generate-questions で確立した「リソースを引く → requireCompanyMember」を
 * そのまま関数にしただけで、新しい判定は足していない。
 * リソース ID を受けるルートが多く、手書きで散らすと必ず抜けが出るためまとめた。
 *
 * 返り値が NextResponse ならそのまま return する。
 * 通過したときは、以降の処理で使えるように companyId を返す。
 */
export async function requireResourceCompany(
  table: string,
  id: string,
): Promise<{ error: NextResponse; companyId?: undefined } | { error?: undefined; companyId: string }> {
  const { data, error } = await getSupabaseAdmin()
    .from(table)
    .select('company_id')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return { error: NextResponse.json({ error: error.message }, { status: 500 }) }
  }
  if (!data?.company_id) {
    return { error: NextResponse.json({ error: '見つかりません' }, { status: 404 }) }
  }

  const forbidden = await requireCompanyMember(data.company_id as string)
  if (forbidden) return { error: forbidden }

  return { companyId: data.company_id as string }
}

/**
 * 呼び出し元自身の会社を、セッションから解決する。
 *
 * 連携（tools 配下の connect 系）のように「ログインしている人が自分の会社に取り込む」
 * 操作で使う。クライアントから companyId / userId を受け取って信用してはいけない
 * （受け取ると、他社の ID を渡すだけでその会社に書き込めてしまう）。
 *
 * 返り値が error なら return する。通れば自分の会社の companyId と、
 * セッションの持ち主の authId が返る（セッション所有者の照合に使う）。
 */
export async function requireCallerCompany(): Promise<
  { error: NextResponse; companyId?: undefined; authId?: undefined }
  | { error?: undefined; companyId: string; authId: string }
> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabaseUser = await createClient()
  const {
    data: { user },
  } = await supabaseUser.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: '認証が必要です' }, { status: 401 }) }
  }
  const companyId = await fetchCompanyIdForAuth(user.id)
  if (!companyId) {
    return { error: NextResponse.json({ error: '所属会社が見つかりません' }, { status: 403 }) }
  }
  return { companyId, authId: user.id }
}
