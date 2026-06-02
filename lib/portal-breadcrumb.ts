// ポータル画面ヘッダーのパンくずリスト設定
// pathname → { section?, title } をマップし、ヘッダーでパンくず表示する。
// 各ページ本体の h1 はこの定義に移管したため削除済み。

export type PortalCrumb = {
  section?: string // サイドバーのグループ名（リンクなしの薄字）
  title: string // 現在ページ名
}

const breadcrumbMap: Record<string, PortalCrumb> = {
  '/portal': { title: 'ダッシュボード' },
  '/portal/values': { title: '提供価値' },
  '/portal/announcements': { title: 'お知らせ' },
  '/portal/profile': { title: 'マイプロフィール' },
  // 浸透セクション
  '/portal/timeline': { section: '浸透', title: 'Good Job タイムライン' },
  '/portal/kpi': { section: '浸透', title: '目標・KPI' },
  // ブランド基盤セクション
  '/portal/guidelines': { section: 'ブランド基盤', title: 'ブランド方針' },
  '/portal/strategy': { section: 'ブランド基盤', title: 'ブランド戦略' },
  '/portal/visuals': { section: 'ブランド基盤', title: 'ビジュアルアイデンティティ' },
  '/portal/verbal': { section: 'ブランド基盤', title: 'バーバルアイデンティティ' },
}

export function resolvePortalCrumb(pathname: string): PortalCrumb | null {
  // 完全一致
  if (breadcrumbMap[pathname]) return breadcrumbMap[pathname]

  // 最長プレフィックス一致（サブページ向け）
  let best: { key: string; crumb: PortalCrumb } | null = null
  for (const key of Object.keys(breadcrumbMap)) {
    // '/portal' は全ポータルパスにマッチしてしまうので prefix 対象から除外
    if (key === '/portal') continue
    if (pathname.startsWith(key + '/')) {
      if (!best || key.length > best.key.length) {
        best = { key, crumb: breadcrumbMap[key] }
      }
    }
  }
  return best?.crumb ?? null
}
