'use client'

// 初回セットアップ案内（ポータル・管理者のみ）。
//
// 未セットアップのあいだ、ポータルのダッシュボードの中身をこれに差し替える。
// 着地先は変えない（リダイレクトしない）ので、迷わせずに次の一手を示すのが役目。
// 「あとで」で閉じられるが、管理画面の鏡写しカードは全完了まで残す。
//
// ⚠️ このファイルにプラン分岐を書かない。見出し・ステップ・下部の案内文まで
//    lib/onboarding/steps.ts の getOnboardingConfig() が返すものを並べるだけにする。
import Link from 'next/link'
import { ArrowUpRight, Check, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { resolvePlanDisplay } from '@/lib/billing/plan-display'
import type { OnboardingStepView, OnboardingView } from '@/lib/onboarding/steps'
import { can } from '@/lib/billing/entitlements'

type CompanyLike = Parameters<typeof can>[0]

function StepRow({ step, isLast }: { step: OnboardingStepView; isLast: boolean }) {
  const waiting = !!step.ctaLabelWaiting && !step.current
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 ${isLast ? '' : 'mb-2'} ${
        step.current ? 'border-ds-app-accent bg-white' : 'border-transparent'
      }`}
    >
      {/* 状態アイコン 26px */}
      <span
        aria-hidden="true"
        className={`mt-0.5 flex size-[26px] shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          step.done
            ? 'bg-green-100 text-green-700'
            : step.current
              ? 'bg-ds-app-accent text-white'
              : 'bg-muted text-muted-foreground'
        }`}
      >
        {step.done ? <Check size={14} /> : step.index}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={`m-0 text-base font-semibold sm:text-sm ${
              step.done ? 'text-muted-foreground line-through' : 'text-foreground'
            }`}
          >
            {step.title}
          </p>
          {!step.done && step.duration && (
            <span className="text-xs text-muted-foreground">{step.duration}</span>
          )}
        </div>

        <p className="m-0 mt-1 text-base leading-relaxed text-muted-foreground sm:text-sm">
          {step.done ? '— 完了しています' : step.description}
        </p>

        {!step.done && (
          <>
            <Button
              asChild
              // 先に済ませてほしいステップが残っているあいだは体裁で順序を促す。
              // 押せることは変えない（強制しない）
              variant={waiting ? 'outline' : 'default'}
              className="mt-3 h-11 rounded-xl px-5"
            >
              <Link href={step.href} className="no-underline">
                {waiting ? step.ctaLabelWaiting : step.ctaLabel}
              </Link>
            </Button>

            {/* 下書き支援。完了判定には関与しない */}
            {step.assist && (
              <p className="m-0 mt-2">
                <Link
                  href={step.assist.href}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  <Sparkles size={12} aria-hidden="true" />
                  迷ったら: {step.assist.label}
                </Link>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function OnboardingChecklist({
  company,
  view,
  onDismiss,
}: {
  company: CompanyLike
  view: OnboardingView
  onDismiss: () => void
}) {
  const { config } = view
  const percent = view.total > 0 ? Math.round((view.doneCount / view.total) * 100) : 0
  // resolvePlanDisplay は company 必須。カードが出ている時点で会社は取れている
  const plan = resolvePlanDisplay(company ?? { plan: 'free' })

  return (
    <Card className="mb-4 bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-4">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="m-0 text-base font-bold text-foreground">{config.heading}</h2>
              {config.showPlanBadge && (
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${plan.toneClass}`}
                >
                  {plan.label}
                </span>
              )}
            </div>
            <p className="m-0 mt-1 text-base leading-relaxed text-muted-foreground sm:text-sm">
              {config.lead}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            あとで
          </button>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-ds-app-accent transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-semibold text-muted-foreground">
            {view.doneCount}/{view.total} 完了
          </span>
        </div>

        <div>
          {view.steps.map((step, i) => (
            <StepRow key={step.id} step={step} isLast={i === view.steps.length - 1} />
          ))}
        </div>

        {/* 次の段への案内。ロックではないので鍵アイコンは使わない */}
        {config.upsell && (
          <p className="m-0 mt-4">
            <Link
              href={config.upsell.href}
              className="inline-flex items-start gap-1 text-xs leading-relaxed text-ds-app-accent no-underline hover:underline"
            >
              <ArrowUpRight size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              {config.upsell.text}
            </Link>
          </p>
        )}

        <p className="m-0 mt-4 text-xs leading-relaxed text-muted-foreground">
          この案内は管理者にだけ表示されています。{view.total}つ完了すると通常のダッシュボードに切り替わります。
        </p>
      </CardContent>
    </Card>
  )
}
