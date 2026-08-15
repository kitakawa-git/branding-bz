'use client'

// ダッシュボードの共通ヘッダー（セットアップ進捗＋タブバー）。
//
// タブバーは brand-score / dashboard / analytics / analytics/learning の
// 4ページに同じ JSX が複製されていた（brand-score の中だけで2回）。
// タブを1本足すたびに5箇所を直すことになるのでここへ寄せる。
//
// セットアップの進捗をタブの「上」に置く。
// 進捗の中身は「会社の基本情報を整える」などアカウント全体の話で、
// ブランドスコアという1指標の持ち物ではない。ブランドスコアのページ内に
// 置いていたため、同じダッシュボードの中でタブを切り替えるだけで
// 案内が消えていた。
//
// 出すのはポータルと同じ OnboardingChecklist。以前は管理画面だけ
// コンパクト版（OnboardingMiniCard）で、同じ進捗の見え方が2種類あった。
// 担当者と管理者が同じ画面を見て話せるように実装を1つに揃える。
// 管理画面では「あとで」を出さない＝ポータルで閉じても全完了まで残す、
// という従来の分担は維持する（onDismiss を渡さないことで表現）。
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { visibleDashboardTabs } from '@/lib/constants/dashboard-tabs'
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist'
import { useOnboarding } from '@/components/onboarding/use-onboarding'
import { can } from '@/lib/billing/entitlements'

type CompanyLike = Parameters<typeof can>[0]

export function DashboardTabs({ company }: { company: CompanyLike }) {
  const pathname = usePathname()
  const visibleTabs = visibleDashboardTabs(company)
  // notifyOnComplete はポータルだけ。管理画面でも鳴らすと同じ完了で2回出る
  const onboarding = useOnboarding(company)
  // dismissed は見ない。ポータルで「あとで」を押しても管理画面には残す
  const showOnboarding = !onboarding.loading && !onboarding.hidden && !!onboarding.view

  return (
    <>
      {showOnboarding && (
        <div className="mb-4">
          <OnboardingChecklist
            company={company}
            view={onboarding.view!}
            surface="admin"
          />
        </div>
      )}
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
