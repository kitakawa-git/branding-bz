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
