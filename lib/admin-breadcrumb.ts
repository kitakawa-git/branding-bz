// 管理画面ヘッダーのパンくずリスト設定
// pathname → { section?, title } をマップし、ヘッダーでパンくず表示する。
// 各ページ本体の h1 はこの定義に移管したため削除済み。

export type AdminCrumb = {
  section?: string // 親の領域名。実体のあるページなら sectionHref でリンクにする
  /**
   * section の遷移先。サイドバーのグループ名（浸透・ブランド基盤など）は
   * 対応するページが無いので未指定のまま薄字で置く。
   */
  sectionHref?: string
  title: string // 現在ページ名
  /**
   * title の遷移先。詳細ページで一覧の名前をそのまま出しているときだけ入る
   * （resolveAdminCrumb が補う）。一覧ページ自身では未指定。
   */
  titleHref?: string
  /**
   * サブページ（/xxx/[id] 等）で使う crumb。
   * 未指定ならサブページは親と同じ crumb を継承する。
   * 一覧→詳細で表示を変えたいページだけ指定する。
   */
  child?: Omit<AdminCrumb, 'child'>
}

// 完全一致を優先、なければ最長プレフィックス一致で解決する
const breadcrumbMap: Record<string, AdminCrumb> = {
  // ダッシュボードは4つのタブを持つ1つの領域。
  // セクションに領域名、タイトルに現在のタブ名を置く（タブ名は
  // lib/constants/dashboard-tabs.ts の DASHBOARD_TABS と揃えること）。
  // セクションの戻り先はブランドスコア（先頭タブ）。サイドバーの
  // 「ダッシュボード」と同じ場所に着かないと、パンくずで戻ったつもりが
  // タイムライン分析に飛ばされる
  '/admin/setup': { section: 'ダッシュボード', sectionHref: '/admin/brand-score', title: 'セットアップの進捗' },
  '/admin/dashboard': { section: 'ダッシュボード', sectionHref: '/admin/brand-score', title: 'タイムライン分析' },
  '/admin/brand-score': { section: 'ダッシュボード', sectionHref: '/admin/brand-score', title: 'ブランドスコア' },
  '/admin/analytics': { section: 'ダッシュボード', sectionHref: '/admin/brand-score', title: 'スマート名刺' },
  '/admin/analytics/learning': { section: 'ダッシュボード', sectionHref: '/admin/brand-score', title: 'ラーニング分析' },
  // 浸透セクション（サイドバーのグループ名に合わせる）
  // 詳細ページ（/surveys/[id] 等）はプレフィックス一致でこのcrumbを継承する
  '/admin/brand-score/surveys': {
    section: '浸透',
    title: 'サーベイ管理',
    // 詳細画面は「サーベイ管理 › 詳細」。ページ本体に調査名のH1があるため
    // パンくずでは調査名を繰り返さない
    child: { section: 'サーベイ管理', title: '詳細' },
  },
  '/admin/brand-score/market-surveys': {
    section: '浸透',
    title: '市場調査',
    // 詳細・マッピング画面は「市場調査 › …」。sectionHref は resolveAdminCrumb が補う
    child: { section: '市場調査', title: '詳細' },
  },
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
  if (!best) return null

  // ここに来た時点で「一覧の下のページ」にいる。どちらの分岐でも
  // 一覧へ戻れるリンクを持たせる（戻るボタンの代わり）
  if (best.crumb.child) {
    // child の section は親ページの名前なので、親へのリンクを補う
    return { sectionHref: best.key, ...best.crumb.child }
  }
  // child 指定がないサブページは親の crumb をそのまま出す。
  // 表示されている名前は一覧のものなので、タイトル側をリンクにする
  return { ...best.crumb, child: undefined, titleHref: best.key }
}
