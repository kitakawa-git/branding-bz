'use client'

// 視聴分析（ラーニング視聴分析）— ダッシュボードのタブの一つ。
// 旧 /admin/learning の「視聴分析」タブから移設。LearningAnalytics は
// /api/learning/analytics（cookieセッションで企業解決）から自前取得するため props 不要。
import { DashboardTabs } from '../../components/DashboardTabs'
import { useAuth } from '../../components/AdminDataProvider'
import { LearningAnalytics } from '../../learning/LearningAnalytics'


export default function LearningAnalyticsPage() {
  const { company } = useAuth()

  // 機能トグルを踏まえたタブ（定義は lib/constants/dashboard-tabs.ts に集約）

  return (
    <div>
      <DashboardTabs company={company} />

      <LearningAnalytics />
    </div>
  )
}
