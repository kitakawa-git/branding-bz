'use client'

// セットアップの進捗 — ダッシュボードのタブの一つ。
//
// 中身はポータルと同じ OnboardingChecklist。実装を分けると進捗の見え方が
// 2種類になるため、担当者と管理者が同じものを見て話せるように揃えている。
//
// このタブは全ステップ完了で消える（DashboardTabs が出し分ける）。
// 完了後に URL を直接叩いた人は迷子になるので、その場合だけ完了の面を出す。
import Link from 'next/link'
import { ArrowRight, CheckCircle } from 'lucide-react'
import { DashboardTabs } from '../components/DashboardTabs'
import { useAuth } from '../components/AdminDataProvider'
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist'
import { useOnboarding } from '@/components/onboarding/use-onboarding'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function SetupProgressPage() {
  const { company } = useAuth()
  // dismissed は見ない。ポータルで「あとで」を押しても管理画面には残す
  const onboarding = useOnboarding(company)

  return (
    <div>
      <DashboardTabs company={company} />

      {onboarding.loading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : onboarding.view && !onboarding.hidden ? (
        <OnboardingChecklist company={company} view={onboarding.view} surface="admin" />
      ) : (
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-10 text-center">
            <CheckCircle size={40} className="mx-auto mb-4 text-muted-foreground/30" />
            <h2 className="mb-2 text-base font-bold text-foreground">
              セットアップは完了しています
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              登録した内容はブランド基盤の各ページからいつでも編集できます。
            </p>
            <Link
              href="/admin/brand-score"
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-foreground px-6 text-sm font-bold text-background no-underline transition-transform hover:scale-[1.03]"
            >
              ブランドスコアを見る
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
