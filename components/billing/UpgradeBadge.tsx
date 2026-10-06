'use client'

// プラン外の機能ボタンの横に出す「{required} から」小バッジ。
// クリックで /plan へ。中身は minimumPlanFor(feature) で機械的に決まる。
// 使い方:
//   {currentPlan === 'free' && <UpgradeBadge feature="pdfExport" />}
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { minimumPlanFor, type FeatureKey } from '@/lib/billing/entitlements'
import { PLAN_LABELS } from '@/lib/billing/plan-display'

export function UpgradeBadge({
  feature,
  className = '',
}: {
  feature: FeatureKey
  className?: string
}) {
  const required = minimumPlanFor(feature)
  const label = PLAN_LABELS[required] ?? required
  return (
    <Link
      href="/plan"
      aria-label={`${label} から`}
      className={`inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-100/70 px-2 py-0.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 ${className}`}
    >
      <Lock size={10} aria-hidden="true" />
      {label} から
    </Link>
  )
}
