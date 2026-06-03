// ポータル画面ヘッダーのパンくずリスト設定
// pathname → { section?, title } をマップし、ヘッダーでパンくず表示する。
// 各ページ本体の h1 はこの定義に移管したため削除済み。

export type PortalCrumb = {
  section?: string // サイドバーのグループ名（リンクなしの薄字）
  perspective?: string // 視点ワード（主見出し）。指定時は「視点ワード ｜ title」の二段表記で表示
  title: string // 現在ページ名（名詞）
}

const breadcrumbMap: Record<string, PortalCrumb> = {
  '/portal': { title: 'ダッシュボード' },
  '/portal/values': { title: '提供価値' },
  '/portal/announcements': { title: 'お知らせ' },
  '/portal/profile': { title: 'マイプロフィール' },
  // 浸透セクション
  '/portal/timeline': { section: '浸透', title: 'Good Job タイムライン' },
  '/portal/kpi': { section: '浸透', title: '目標・KPI' },
  '/portal/learning': { section: '浸透', title: 'ラーニング' },
  // 私たちの「らしさ」セクション（視点ワード｜名詞 の二段表記）
  '/portal/guidelines': { section: '私たちの「らしさ」', perspective: '考え方', title: 'ブランド方針' },
  '/portal/personality': { section: '私たちの「らしさ」', perspective: '感じられ方', title: 'ブランドパーソナリティ' },
  '/portal/strategy': { section: '私たちの「らしさ」', perspective: '接し方', title: 'ブランド戦略' },
  '/portal/visuals': { section: '私たちの「らしさ」', perspective: '見え方', title: 'ビジュアルアイデンティティ' },
  '/portal/verbal': { section: '私たちの「らしさ」', perspective: '聞こえ方', title: 'バーバルアイデンティティ' },
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
