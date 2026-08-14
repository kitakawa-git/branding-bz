// 分析系ページ共通のタブ定義（唯一の定義源）
// ============================================================
// /admin/brand-score, /admin/dashboard, /admin/analytics,
// /admin/analytics/learning の4ページが同じタブ列を表示する。
// 以前は各ページに同じ配列がコピーされており、ラベル変更のたびに
// 4箇所直す必要があった（実際に表記がズレる温床だった）ため集約した。
//
// 「視聴分析」はラーニング機能のタブなので、learning_enabled が false の
// 企業では出さない。出し分けは visibleDashboardTabs() を使う。

import { isFeatureEnabled } from './feature-toggles'

export type DashboardTab = {
  label: string
  href: string
  /** 表示条件となる機能トグルのキー（無指定なら常時表示） */
  featureKey?: string
}

export const DASHBOARD_TABS: readonly DashboardTab[] = [
  { label: 'ブランドスコア', href: '/admin/brand-score' },
  { label: 'タイムライン分析', href: '/admin/dashboard', featureKey: 'timeline_enabled' },
  { label: 'スマート名刺', href: '/admin/analytics', featureKey: 'card_enabled' },
  { label: '視聴分析', href: '/admin/analytics/learning', featureKey: 'learning_enabled' },
]

/** 機能トグルを踏まえて表示するタブだけを返す */
export function visibleDashboardTabs(
  company: Record<string, unknown> | null | undefined
): DashboardTab[] {
  return DASHBOARD_TABS.filter(
    (tab) => !tab.featureKey || isFeatureEnabled(company, tab.featureKey)
  )
}
