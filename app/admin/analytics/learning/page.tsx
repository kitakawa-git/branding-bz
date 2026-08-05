'use client'

// 視聴分析（ラーニング視聴分析）— ダッシュボードのタブの一つ。
// 旧 /admin/learning の「視聴分析」タブから移設。LearningAnalytics は
// /api/learning/analytics（cookieセッションで企業解決）から自前取得するため props 不要。
import { visibleDashboardTabs } from '@/lib/constants/dashboard-tabs'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '../../components/AdminDataProvider'
import { LearningAnalytics } from '../../learning/LearningAnalytics'


export default function LearningAnalyticsPage() {
  const pathname = usePathname()
  const { company } = useAuth()

  // 機能トグルを踏まえたタブ（定義は lib/constants/dashboard-tabs.ts に集約）
  const visibleTabs = visibleDashboardTabs(company)

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
