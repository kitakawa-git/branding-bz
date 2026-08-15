'use client'

// 初回セットアップ案内（ポータル・管理者のみ）。
//
// 未セットアップのあいだ、ポータルのダッシュボードの中身をこれに差し替える。
// 着地先は変えない（リダイレクトしない）ので、迷わせずに次の一手を示すのが役目。
// 「あとで」で閉じられるが、管理画面の鏡写しカードは全完了まで残す。
//
// 見せ方は「次にやる1つに集中させる」形:
//   完了済み … 緑の1行リストで上に畳む
//   次にやる … 大きなカード。カード全体がリンクで、ボタンを別に置かない
//   残り     … コンパクトな1行リスト
// ボタンを並べると、6つ全部が同じ重さに見えて「どれから？」で止まる。
//
// ⚠️ このファイルにプラン分岐を書かない。見出し・ステップ・下部の案内文まで
//    lib/onboarding/steps.ts の getOnboardingConfig() が返すものを並べるだけにする。
import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Check, Lock, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { resolvePlanDisplay } from '@/lib/billing/plan-display'
import type {
  OnboardingStepId,
  OnboardingStepView,
  OnboardingView,
} from '@/lib/onboarding/steps'
import { can } from '@/lib/billing/entitlements'

type CompanyLike = Parameters<typeof can>[0]

/** 「約15分」→ 15。数字が無い目安（「5名まで無料」など）は 0 として合計に混ぜない */
function parseDurationMinutes(duration?: string): number {
  if (!duration || !duration.includes('分')) return 0
  const m = duration.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

function ProgressShell({
  doneCount,
  total,
  percent,
  totalMinutes,
  remainingMinutes,
}: {
  doneCount: number
  total: number
  percent: number
  totalMinutes: number
  remainingMinutes: number
}) {
  const caption =
    doneCount === 0
      ? `スタート！ 約${totalMinutes}分で完成します。`
      : doneCount === total
        ? '完成しました！'
        : `あと${total - doneCount}ステップ・約${remainingMinutes}分`

  return (
    <div className="mb-5 flex items-center gap-4 rounded-xl border border-border bg-gradient-to-br from-[#f0f4ff] to-[#faf5ff] px-4 py-3.5">
      <div className="shrink-0 text-[22px] font-extrabold text-violet-600">
        {doneCount}
        <span className="text-xs font-normal text-muted-foreground">/{total}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="h-2 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-600 to-blue-600 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="m-0 mt-1.5 text-xs text-muted-foreground">{caption}</p>
      </div>
    </div>
  )
}

function DoneStepsList({ steps }: { steps: OnboardingStepView[] }) {
  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-green-200 bg-green-50/50">
      {steps.map((step) => (
        <div
          key={step.id}
          className="flex items-center gap-3 border-t border-green-200 px-4 py-2.5 text-sm first:border-t-0"
        >
          <span
            aria-hidden="true"
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-green-500 text-white"
          >
            <Check size={13} strokeWidth={3} />
          </span>
          <span className="min-w-0 flex-1 truncate font-semibold text-green-800 line-through decoration-green-400">
            {step.title}
          </span>
          <span className="shrink-0 text-xs font-semibold text-green-600">完了</span>
        </div>
      ))}
    </div>
  )
}

/**
 * いま開いている1つ。カード全体がリンクなので、
 * 下書き支援リンクはカードの外に出す（リンクの入れ子は不正）。
 *
 * key に step.id を渡して開くたびに作り直し、開く動きを再生させる。
 */
function ActiveStepCard({ step }: { step: OnboardingStepView }) {
  return (
    <div
      key={step.id}
      className="animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-300 ease-out"
    >
      <Link
        href={step.href}
        className="group relative mb-2 flex items-center gap-4 overflow-hidden rounded-xl border-[1.5px] border-ds-app-accent bg-white p-5 no-underline shadow-[0_6px_20px_rgba(37,99,235,0.10)] transition-all hover:-translate-y-0.5 hover:border-blue-700 hover:shadow-[0_10px_28px_rgba(37,99,235,0.16)] focus-visible:ring-2 focus-visible:ring-ds-app-accent"
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 right-0 w-1 bg-gradient-to-b from-violet-600 to-blue-600 opacity-0 transition-opacity group-hover:opacity-100"
        />
        <div className="min-w-0 flex-1">
          <span className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-ds-app-accent px-2.5 py-[3px] text-[10.5px] font-bold uppercase tracking-wider text-white">
            STEP {step.index}
            {step.current && ' · 次にやる'}
          </span>
          <p className="m-0 mb-1.5 text-lg font-bold text-foreground">{step.title}</p>
          <p className="m-0 text-sm leading-relaxed text-muted-foreground">
            {step.description}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
            {step.duration && (
              <span className="rounded-full bg-muted px-2 py-0.5">⏱ {step.duration}</span>
            )}
            {step.payoff && <span>💡 {step.payoff}</span>}
          </div>
        </div>
        {/* 丸矢印。ds-app-accent は hex 変数で /10 の不透明度修飾が効かない（透明になる）ため、
            地色は同系の blue-50 を使う */}
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-ds-app-accent transition-all group-hover:translate-x-1 group-hover:scale-105 group-hover:bg-ds-app-accent group-hover:text-white"
        >
          <ArrowRight size={20} strokeWidth={2.5} />
        </span>
      </Link>

      {/* 下書き支援。完了判定には関与しない */}
      {step.assist && (
        <p className="m-0 mb-3 pl-1">
          <Link
            href={step.assist.href}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            <Sparkles size={12} aria-hidden="true" />
            迷ったら: {step.assist.label}
          </Link>
        </p>
      )}
    </div>
  )
}

function RestStepRow({
  step,
  onExpand,
}: {
  step: OnboardingStepView
  onExpand: (id: OnboardingStepId) => void
}) {
  // 先に済ませてほしいステップが残っているものは薄く出す。
  // クリックできないことを DOM でも表すため <div> のままにする
  const waiting = !!step.ctaLabelWaiting && !step.current

  const content = (
    <>
      <span
        aria-hidden="true"
        className={`flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] text-[11px] font-bold ${
          waiting
            ? 'border-dashed border-border text-muted-foreground/40'
            : 'border-border text-muted-foreground'
        }`}
      >
        {waiting ? <Lock size={12} /> : step.index}
      </span>
      <span className="min-w-0 flex-1 truncate font-semibold">{step.title}</span>
      {step.duration && (
        <span className="shrink-0 text-xs text-muted-foreground">{step.duration}</span>
      )}
      {!waiting && (
        <ArrowRight
          size={14}
          className="shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-ds-app-accent"
          aria-hidden="true"
        />
      )}
    </>
  )

  if (waiting) {
    return (
      <div className="flex items-center gap-3 border-t border-border px-4 py-3 text-sm opacity-60 first:border-t-0">
        {content}
      </div>
    )
  }

  // 1手目は「開く」。中身（説明・所要・これが終わると何が起きるか）を見てから
  // 進めるようにする。開いたカードをもう一度押すと遷移する
  return (
    <button
      type="button"
      onClick={() => onExpand(step.id)}
      className="group flex w-full cursor-pointer items-center gap-3 border-0 border-t border-border bg-transparent px-4 py-3 text-left text-sm transition-colors first:border-t-0 hover:bg-muted"
    >
      {content}
    </button>
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

  const doneSteps = view.steps.filter((s) => s.done)
  const openSteps = view.steps.filter((s) => !s.done)

  // 既定は「次にやる」1つ。別のステップを押すと、そちらが開く
  const [expandedId, setExpandedId] = useState<OnboardingStepId | null>(null)
  const activeStep =
    openSteps.find((s) => s.id === expandedId) ?? openSteps.find((s) => s.current)

  // 開いたステップは元の位置のまま開く。上に移動させると、押した場所と
  // 開いた場所がずれて「どれを押したのか」が分からなくなる
  const activeIdx = activeStep ? openSteps.findIndex((s) => s.id === activeStep.id) : -1
  const stepsBefore = activeIdx >= 0 ? openSteps.slice(0, activeIdx) : openSteps
  const stepsAfter = activeIdx >= 0 ? openSteps.slice(activeIdx + 1) : []

  const totalMinutes = view.steps.reduce((n, s) => n + parseDurationMinutes(s.duration), 0)
  const remainingMinutes = view.steps
    .filter((s) => !s.done)
    .reduce((n, s) => n + parseDurationMinutes(s.duration), 0)

  return (
    <Card className="mb-4 border bg-[hsl(0_0%_97%)] shadow-none">
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

        <ProgressShell
          doneCount={view.doneCount}
          total={view.total}
          percent={percent}
          totalMinutes={totalMinutes}
          remainingMinutes={remainingMinutes}
        />

        {doneSteps.length > 0 && <DoneStepsList steps={doneSteps} />}

        {stepsBefore.length > 0 && (
          <div className="mb-2 overflow-hidden rounded-xl border border-border bg-white">
            {stepsBefore.map((step) => (
              <RestStepRow key={step.id} step={step} onExpand={setExpandedId} />
            ))}
          </div>
        )}

        {activeStep && <ActiveStepCard step={activeStep} />}

        {stepsAfter.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border bg-white">
            {stepsAfter.map((step) => (
              <RestStepRow key={step.id} step={step} onExpand={setExpandedId} />
            ))}
          </div>
        )}

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
