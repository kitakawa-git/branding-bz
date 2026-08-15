'use client'

// ダッシュボードの共通ヘッダー（セットアップ進捗＋タブバー）。
//
// タブバーは brand-score / dashboard / analytics / analytics/learning の
// 4ページに同じ JSX が複製されていた（brand-score の中だけで2回）。
// タブを1本足すたびに5箇所を直すことになるのでここへ寄せる。
//
// セットアップの進捗をタブの「上」に置くのが本題。
// 進捗の中身は「会社の基本情報を整える」などアカウント全体の話で、
// ブランドスコアという1指標の持ち物ではない。ブランドスコアのページ内に
// 置いていたため、同じダッシュボードの中でタブを切り替えるだけで
// 案内が消えていた。
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { visibleDashboardTabs } from '@/lib/constants/dashboard-tabs'
import { OnboardingMiniCard } from '@/components/onboarding/OnboardingMiniCard'
import { can } from '@/lib/billing/entitlements'

type CompanyLike = Parameters<typeof can>[0]

export function DashboardTabs({ company }: { company: CompanyLike }) {
  const pathname = usePathname()
  const visibleTabs = visibleDashboardTabs(company)

  return (
    <>
      {/* 完了すれば OnboardingMiniCard 側で自動的に消える */}
      <OnboardingMiniCard company={company} />
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
