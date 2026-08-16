// ポータル画面ヘッダーのパンくずリスト設定
// pathname → { section?, title } をマップし、ヘッダーでパンくず表示する。
// 各ページ本体の h1 はこの定義に移管したため削除済み。

export type PortalCrumb = {
  section?: string // サイドバーのグループ名（リンクなしの薄字。対応するページが無いのでリンクにしない）
  /** 一覧へ戻る親ページ。詳細ページで使う（薄字＋リンク） */
  parent?: { label: string; href: string }
  perspective?: string // 視点ワード（主見出し）。指定時は「視点ワード ｜ title」の二段表記で表示
  title: string // 現在ページ名（名詞）
}

const breadcrumbMap: Record<string, PortalCrumb> = {
  '/portal': { title: 'ダッシュボード' },
  '/portal/about': { title: '私たちについて' },
  '/portal/values': { title: '提供価値' },
  '/portal/announcements': { title: 'お知らせ' },
  '/portal/profile': { title: 'マイプロフィール' },
  // 浸透セクション
  '/portal/timeline': { section: '浸透', title: 'Good Action投稿' },
  '/portal/kpi': { section: '浸透', title: '目標・KPI' },
  '/portal/learning': { section: '浸透', title: 'ラーニング' },
  '/portal/survey': { section: '浸透', title: 'サーベイ結果' },
  '/portal/market-survey': { section: '浸透', title: '市場調査' },
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

  // 詳細ページ（動的ルート）は、一覧へ戻れる親を付ける。
  // ⚠️ 下の最長プレフィックス一致だけだと親の名前がそのまま現在地として出て、
  //    「お知らせ」の詳細を開いても見出しが「お知らせ」のままになり戻り先も無い
  if (/^\/portal\/announcements\/[^/]+$/.test(pathname)) {
    return { parent: { label: 'お知らせ', href: '/portal/announcements' }, title: '詳細' }
  }

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
