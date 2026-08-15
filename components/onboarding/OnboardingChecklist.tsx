'use client'

// 初回セットアップ案内（ポータル・管理者のみ）。
//
// 未セットアップのあいだ、ポータルのダッシュボードの中身をこれに差し替える。
// 着地先は変えない（リダイレクトしない）ので、迷わせずに次の一手を示すのが役目。
// 「あとで」で閉じられるが、管理画面の鏡写しカードは 4/4 完了まで残す。
import Link from 'next/link'
import { Check, Lock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePlanGate } from '@/components/billing/plan-gate'
import type { OnboardingStepView, OnboardingView } from '@/lib/onboarding/steps'
import type { FeatureKey } from '@/lib/billing/entitlements'

type CompanyLike = Parameters<typeof usePlanGate>[0]

/** ロック行の「Standard から」。表記も配色も Phase 4 のロック表示に合わせる */
function LockedNote({ company, feature }: { company: CompanyLike; feature: FeatureKey }) {
  const gate = usePlanGate(company, feature)
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${gate.toneClass}`}
    >
      <Lock size={10} aria-hidden="true" />
      {gate.requiredLabel}から
    </span>
  )
}

function StepRow({
  step,
  company,
  isLast,
}: {
  step: OnboardingStepView
  company: CompanyLike
  isLast: boolean
}) {
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
            : step.locked
              ? 'bg-muted text-muted-foreground'
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
          {!step.done && step.duration && !step.locked && (
            <span className="text-xs text-muted-foreground">{step.duration}</span>
          )}
          {step.locked && step.feature && <LockedNote company={company} feature={step.feature} />}
        </div>

        <p className="m-0 mt-1 text-base leading-relaxed text-muted-foreground sm:text-sm">
          {step.done ? '— 完了しています' : step.description}
        </p>

        {!step.done && !step.locked && (
          <Button
            asChild
            // ②③が未完了のうちは招待を急がせない。押せるが体裁で順序を促す
            variant={step.id === 'invite' && !step.current ? 'outline' : 'default'}
            className="mt-3 h-11 rounded-xl px-5"
          >
            <Link href={step.href} className="no-underline">
              {step.id === 'invite' && !step.current ? 'ステップ2・3のあとで' : step.ctaLabel}
            </Link>
          </Button>
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
  const percent = view.total > 0 ? Math.round((view.doneCount / view.total) * 100) : 0

  return (
    <Card className="mb-4 bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-4">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="m-0 text-base font-bold text-foreground">
              ようこそ、branding.bz へ
            </h2>
            <p className="m-0 mt-1 text-base leading-relaxed text-muted-foreground sm:text-sm">
              ここは、あなたの会社の全員がブランドと出会う場所です。
              <br className="hidden sm:block" />
              いまは空っぽ——{view.total}つのステップで、社員を迎える準備をしましょう。
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

        {/* 進捗。分母は実行できるステップ数（free は 🔒 の②③を数えない） */}
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
            <StepRow
              key={step.id}
              step={step}
              company={company}
              isLast={i === view.steps.length - 1}
            />
          ))}
        </div>

        <p className="m-0 mt-4 text-xs leading-relaxed text-muted-foreground">
          この案内は管理者にだけ表示されています。{view.total}つ完了すると通常のダッシュボードに切り替わります。
        </p>
      </CardContent>
    </Card>
  )
}
