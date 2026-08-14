// スーパー管理画面でプランを表示するためのモジュール。
//
// 実効プランの判定そのものは持たない。entitlements.getEffectivePlan に委譲し、
// ここはラベル・配色・注記の組み立てだけを担う（判定ロジックの実体は1箇所）。
//
// 表示専用。ゲート判定には使わない（ゲートは can() / requirePlan()）。
import { getEffectivePlan, SELLABLE_PLANS } from './entitlements'

/** 選択肢に出すプラン。card は販売終了なので含まれない */
export const PLAN_VALUES = SELLABLE_PLANS
export type PlanValue = (typeof SELLABLE_PLANS)[number]

export const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  card: 'Card', // 販売終了。過去データが残っていても表示できるように残す
  standard: 'Standard',
  premium: 'Premium',
  enterprise: 'Enterprise',
}

/** 上位ほど濃い色。淡色背景は不透明度修飾を使わないので Tailwind の淡色クラスのまま */
export const PLAN_TONES: Record<string, string> = {
  free: 'bg-gray-100 text-gray-600',
  card: 'bg-blue-100 text-blue-800',
  standard: 'bg-green-100 text-green-800',
  premium: 'bg-amber-100 text-amber-800',
  enterprise: 'bg-purple-100 text-purple-800',
}

/** 期限切れが近いと判断する日数 */
const EXPIRY_SOON_DAYS = 7

export type PlanDisplay = {
  /** 契約上のプラン（companies.plan の生値） */
  contracted: string
  /** 実効プラン。期限切れなら free */
  effective: string
  label: string
  toneClass: string
  /** 期限切れなら「Premium 期限切れ」など、期限が近ければ「残り3日」 */
  note: string | null
}

/**
 * 表示用にプランを解決する。
 * 期限切れの判定は getEffectivePlan に任せ、ここは注記の文言だけを組み立てる。
 */
export function resolvePlanDisplay(
  company: { plan?: string | null; plan_expires_at?: string | null },
  now: Date = new Date(),
): PlanDisplay {
  const contracted = company.plan ?? 'free'
  const effective = getEffectivePlan(company, now)
  const expiresAt = company.plan_expires_at ? new Date(company.plan_expires_at) : null
  // 「期限切れ」と書けるのは期限日が実在して過ぎているときだけ。
  // effective !== contracted で判定すると、未知のプラン名（free に落ちる）まで
  // 期限切れと表示してしまう
  const isExpired =
    expiresAt !== null &&
    !Number.isNaN(expiresAt.getTime()) &&
    expiresAt.getTime() <= now.getTime()

  let note: string | null = null
  if (isExpired) {
    note = `${PLAN_LABELS[contracted] ?? contracted} 期限切れ`
  } else if (expiresAt !== null) {
    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000)
    if (daysLeft <= EXPIRY_SOON_DAYS) note = `残り${daysLeft}日`
  }

  return {
    contracted,
    effective,
    label: PLAN_LABELS[effective] ?? effective,
    toneClass: PLAN_TONES[effective] ?? PLAN_TONES.free,
    note,
  }
}
