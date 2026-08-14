'use client'

// プラン外の機能をどう見せるかの共通レイヤー（Phase 4）。
//
// 方針は「隠さずグレーで見せる」。使えないことより「どのプランで使えるか」を伝える。
// 判定は必ず entitlements の can() を通す＝実効プラン（期限切れは free）で見るので、
// 期限が切れた premium にはロックが出る。
//
// ロックバッジの配色は Phase 1.5 のプランバッジ（lib/billing/plan-display）と揃える。
import { useState } from 'react'
import Link from 'next/link'
import { Lock, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { can, getEffectivePlan, minimumPlanFor, type FeatureKey } from '@/lib/billing/entitlements'
import { PLAN_LABELS, PLAN_TONES, PLAN_TONES_ON_DARK } from '@/lib/billing/plan-display'
import { PlanChangeRequestDialog } from './PlanChangeRequestDialog'

type CompanyLike = { plan?: string | null; plan_expires_at?: string | null } | null | undefined

/**
 * 機能が使えるかと、使えない場合の案内材料をまとめて返す。
 * 画面側はこれ1つで「出す/グレーにする/アップセルを出す」を決められる。
 */
export function usePlanGate(company: CompanyLike, feature: FeatureKey) {
  const allowed = can(company, feature)
  const requiredPlan = minimumPlanFor(feature)
  return {
    allowed,
    locked: !allowed,
    requiredPlan,
    requiredLabel: PLAN_LABELS[requiredPlan] ?? requiredPlan,
    toneClass: PLAN_TONES[requiredPlan] ?? PLAN_TONES.free,
    /** サイドバー（暗い面）用 */
    darkToneClass: PLAN_TONES_ON_DARK[requiredPlan] ?? PLAN_TONES_ON_DARK.free,
  }
}

/**
 * サイドバー等に添える小さなロックバッジ。
 * 鍵アイコンだけを出す。プラン名を並べると項目名より目立ってしまい、
 * どのメニューの話か読み取りにくくなるため。必要なプランは色で分かれていて、
 * ホバーとスクリーンリーダーには「Standard から」と伝える。
 */
export function PlanLockBadge({
  company,
  feature,
  className = '',
}: {
  company: CompanyLike
  feature: FeatureKey
  className?: string
}) {
  const gate = usePlanGate(company, feature)
  if (gate.allowed) return null
  const label = `${gate.requiredLabel}から`
  return (
    <span
      title={label}
      aria-label={label}
      className={`ml-auto inline-flex shrink-0 items-center rounded p-1 ${gate.darkToneClass} ${className}`}
    >
      <Lock size={11} aria-hidden="true" />
    </span>
  )
}

/**
 * 機能ページのアップセル面。
 * 「何ができるようになるか → どのプランで → 料金ページへ」の順で出す。
 * 使えない理由の説明ではなく、次の一歩を示すのが役目。
 */
export function PlanUpsell({
  company,
  feature,
  title,
  benefits,
  /** Enterprise は個別見積なので問い合わせへ送る */
  contactInstead = false,
}: {
  company: CompanyLike
  feature: FeatureKey
  /** 「◯◯を使うには」の ◯◯ */
  title: string
  /** そのプランにすると何ができるようになるか。3〜5個 */
  benefits: string[]
  contactInstead?: boolean
}) {
  const gate = usePlanGate(company, feature)
  const [requestOpen, setRequestOpen] = useState(false)
  if (gate.allowed) return null

  const isEnterprise = gate.requiredPlan === 'enterprise'
  const toContact = contactInstead || isEnterprise

  return (
    <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-6 text-center">
        <span
          className={`mb-3 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${gate.toneClass}`}
        >
          <Lock size={11} aria-hidden="true" />
          {gate.requiredLabel} プラン
        </span>

        <h2 className="mb-1 text-base font-bold text-foreground">{title}</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {gate.requiredLabel} にアップグレードすると使えるようになります。
        </p>

        <ul className="mx-auto mb-5 max-w-sm space-y-1.5 text-left">
          {benefits.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-foreground/80">
              <span
                aria-hidden="true"
                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50"
              />
              {b}
            </li>
          ))}
        </ul>

        {/* タップ領域 44px（CLAUDE.md のモバイル基準） */}
        {toContact ? (
          <Link
            href="/contact"
            className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-foreground px-6 text-sm font-bold text-background no-underline transition-transform hover:scale-[1.03]"
          >
            お問い合わせ
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        ) : (
          // 料金ページへ飛ばすと、読んだあと結局どこから申し込むのか分からず途切れる。
          // その場でプランを選んで依頼まで済ませられるようにする
          <button
            type="button"
            onClick={() => setRequestOpen(true)}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-foreground px-6 text-sm font-bold text-background transition-transform hover:scale-[1.03]"
          >
            プラン変更をリクエストする
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        )}
      </CardContent>

      <PlanChangeRequestDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        currentPlan={getEffectivePlan(company)}
      />
    </Card>
  )
}
