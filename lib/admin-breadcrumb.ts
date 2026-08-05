// 管理画面ヘッダーのパンくずリスト設定
// pathname → { section?, title } をマップし、ヘッダーでパンくず表示する。
// 各ページ本体の h1 はこの定義に移管したため削除済み。

export type AdminCrumb = {
  section?: string // サイドバーのグループ名（リンクなしの薄字）
  title: string // 現在ページ名
}

// 完全一致を優先、なければ最長プレフィックス一致で解決する
const breadcrumbMap: Record<string, AdminCrumb> = {
  // ダッシュボードは4つのタブを持つ1つの領域。
  // セクションに領域名、タイトルに現在のタブ名を置く（タブ名は
  // lib/constants/dashboard-tabs.ts の DASHBOARD_TABS と揃えること）
  '/admin/dashboard': { section: 'ダッシュボード', title: 'タイムライン分析' },
  '/admin/brand-score': { section: 'ダッシュボード', title: 'ブランドスコア' },
  '/admin/analytics': { section: 'ダッシュボード', title: 'スマート名刺' },
  '/admin/analytics/learning': { section: 'ダッシュボード', title: '視聴分析' },
  // 浸透セクション（サイドバーのグループ名に合わせる）
  // 詳細ページ（/surveys/[id] 等）はプレフィックス一致でこのcrumbを継承する
  '/admin/brand-score/surveys': { section: '浸透', title: 'サーベイ管理' },
  '/admin/brand-score/quizzes': { section: '浸透', title: '理解度テスト' },
  '/admin/learning': { section: '浸透', title: 'ラーニング' },
  // サイドバーでグループに属さない項目はセクションなし
  '/admin/company': { title: '基本情報' },
  '/admin/members': { title: 'アカウント管理' },
  '/admin/members-portal': { title: 'アカウント作成' },
  '/admin/card-template': { title: 'スマート名刺' },
  '/admin/kpi': { title: '目標・KPI管理' },
  '/admin/announcements': { title: 'お知らせ管理' },
  '/admin/settings': { title: '設定' },
  // ブランド基盤セクション
  '/admin/brand/guidelines': { section: 'ブランド基盤', title: 'ブランド方針' },
  '/admin/brand/strategy': { section: 'ブランド基盤', title: 'ブランド戦略' },
  '/admin/brand/visuals': { section: 'ブランド基盤', title: 'ビジュアルアイデンティティ' },
  '/admin/brand/personality': { section: 'ブランド基盤', title: 'ブランドパーソナリティ' },
  '/admin/brand/verbal': { section: 'ブランド基盤', title: 'バーバルアイデンティティ' },
  '/admin/ci-manual': { section: 'ブランド基盤', title: 'CIマニュアル出力' },
}

export function resolveAdminCrumb(pathname: string): AdminCrumb | null {
  // 完全一致
  if (breadcrumbMap[pathname]) return breadcrumbMap[pathname]

  // 最長プレフィックス一致（/admin/announcements/[id] 等のサブページ向け）
  let best: { key: string; crumb: AdminCrumb } | null = null
  for (const key of Object.keys(breadcrumbMap)) {
    if (pathname.startsWith(key + '/')) {
      if (!best || key.length > best.key.length) {
        best = { key, crumb: breadcrumbMap[key] }
      }
    }
  }
  return best?.crumb ?? null
}
