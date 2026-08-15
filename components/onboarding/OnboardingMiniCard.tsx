'use client'

// 管理画面ダッシュボードの鏡写しカード（コンパクト版）。
//
// ポータル側で「あとで」を押してもこちらは消えない。
// 案内は消せるが迷子にはさせない、という分担。4/4 完了で自動的に消える。
// 進捗の判定は lib/onboarding/steps.ts を共有していて、二重実装していない。
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useOnboarding } from './use-onboarding'
import { can } from '@/lib/billing/entitlements'

type CompanyLike = Parameters<typeof can>[0]

export function OnboardingMiniCard({ company }: { company: CompanyLike }) {
  const { loading, hidden, view } = useOnboarding(company)
  if (loading || hidden || !view) return null

  const percent = view.total > 0 ? Math.round((view.doneCount / view.total) * 100) : 0
  // 実行できて未完了の最初の1つ。ここまで来ている以上、必ず1つはある
  const next = view.steps.find((s) => s.current)

  return (
    <Card className="mb-4 bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-sm font-bold tracking-wide text-foreground">
            セットアップの進捗
          </h2>
          <span className="text-xs font-semibold text-muted-foreground">
            {view.doneCount}/{view.total} 完了
          </span>
        </div>

        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-ds-app-accent transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>

        {next && (
          <Link
            href={next.href}
            className="inline-flex items-center gap-1 text-sm font-semibold text-ds-app-accent no-underline hover:underline"
          >
            次: {next.title}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
