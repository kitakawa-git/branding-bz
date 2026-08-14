// スーパー管理画面でプランを表示するための暫定モジュール（Phase 1.5）。
//
// ⚠️ Phase 2 で lib/billing/entitlements.ts の getEffectivePlan が入ったら、
//    resolvePlanDisplay の中の期限判定をそれに差し替えること。
//    ここに閉じ込めてあるのは、一覧ページと詳細ページの2箇所に同じ判定を
//    書くと片方だけ直す事故が起きるため（プラン判定の二重実装を残さない）。
//
// 表示専用。ゲート判定には使わない。

/** DB の check 制約と同じ並び。card は販売終了のため含めない */
export const PLAN_VALUES = ['free', 'standard', 'premium', 'enterprise'] as const
export type PlanValue = (typeof PLAN_VALUES)[number]

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
 * plan_expires_at が過去なら free 扱いにする（Phase 2 の getEffectivePlan と同じ考え方）。
 */
export function resolvePlanDisplay(
  company: { plan?: string | null; plan_expires_at?: string | null },
  now: Date = new Date(),
): PlanDisplay {
  const contracted = company.plan ?? 'free'
  const expiresAt = company.plan_expires_at ? new Date(company.plan_expires_at) : null
  const isExpired = expiresAt !== null && expiresAt.getTime() <= now.getTime()
  const effective = isExpired ? 'free' : contracted

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
