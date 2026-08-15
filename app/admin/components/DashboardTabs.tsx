'use client'

// ダッシュボードの共通ヘッダー（セットアップ進捗＋タブバー）。
//
// タブバーは brand-score / dashboard / analytics / analytics/learning の
// 4ページに同じ JSX が複製されていた（brand-score の中だけで2回）。
// タブを1本足すたびに5箇所を直すことになるのでここへ寄せる。
//
// セットアップの進捗は独立したタブ（/admin/setup）。中身はポータルと同じ
// OnboardingChecklist で、実装は1つに揃えてある。
//
// このタブだけは機能トグルではなくオンボーディングの状態で出し分ける。
// 全ステップ完了で消える＝役目を終えた案内をナビに残さない。
// 静的な DASHBOARD_TABS に混ぜないのは、あちらが company だけで決まる
// 純関数なのに対し、こちらは API で取る進捗に依存するため。
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { visibleDashboardTabs } from '@/lib/constants/dashboard-tabs'
import { useOnboarding } from '@/components/onboarding/use-onboarding'
import { useAuth } from './AdminDataProvider'
import { can } from '@/lib/billing/entitlements'

type CompanyLike = Parameters<typeof can>[0]

export function DashboardTabs({ company }: { company: CompanyLike }) {
  const pathname = usePathname()
  const { user } = useAuth()
  // notifyOnComplete はポータルだけ。管理画面でも鳴らすと同じ完了で2回出る。
  // dismissed も見ない（ポータルで「あとで」を押しても管理画面には残す）
  const onboarding = useOnboarding(company, { userId: user?.id })
  const setupOpen = !onboarding.loading && !onboarding.hidden && !!onboarding.view

  // 未完了のあいだは先頭に置く。最初にやることが左端にある状態にしたいのと、
  // 完了して消えたときに他のタブの並びが動かないため
  const visibleTabs = [
    ...(setupOpen ? [{ label: 'セットアップの進捗', href: '/admin/setup' }] : []),
    ...visibleDashboardTabs(company),
  ]

  return (
    <>
      <div className="flex gap-6 border-b mb-6">
        {visibleTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`pb-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              pathname === tab.href
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </>
  )
}
