'use client'

// 視聴分析（ラーニング視聴分析）— ダッシュボードのタブの一つ。
// 旧 /admin/learning の「視聴分析」タブから移設。LearningAnalytics は
// /api/learning/analytics（cookieセッションで企業解決）から自前取得するため props 不要。
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '../../components/AdminDataProvider'
import { isFeatureEnabled } from '@/lib/constants/feature-toggles'
import { LearningAnalytics } from '../../learning/LearningAnalytics'

const dashboardTabs = [
  { label: 'スコア', href: '/admin/brand-score' },
  { label: 'タイムライン分析', href: '/admin/dashboard' },
  { label: 'スマート名刺', href: '/admin/analytics' },
  { label: '視聴分析', href: '/admin/analytics/learning' },
]

export default function LearningAnalyticsPage() {
  const pathname = usePathname()
  const { company } = useAuth()

  // 機能トグル: スマート名刺が無効なら「スマート名刺」タブを非表示（dashboard/brand-score と統一）
  const cardEnabled = isFeatureEnabled(company, 'card_enabled')
  const visibleTabs = dashboardTabs.filter(
    (tab) => tab.href !== '/admin/analytics' || cardEnabled
  )

  return (
    <div>
      <div className="flex gap-6 border-b mb-6">
        {visibleTabs.map(tab => (
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

      <LearningAnalytics />
    </div>
  )
}
