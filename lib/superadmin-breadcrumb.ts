// スーパー管理画面ヘッダーのパンくずリスト設定
// pathname → { section?, title } をマップし、ヘッダーでパンくず表示する。
// 各ページ本体の見出しはこの定義に移管したため削除済み。

export type SuperAdminCrumb = {
  /** 親セクション。href を持たせて一覧へ戻れるようにする（薄字＋リンク） */
  section?: { label: string; href: string }
  title: string // 現在ページ名
}

const breadcrumbMap: Record<string, SuperAdminCrumb> = {
  '/superadmin/companies': { title: 'ブランド一覧' },
  '/superadmin/orphan-accounts': { title: '孤立アカウントの整理' },
  '/superadmin/news': { title: 'ニュース管理' },
  '/superadmin/inquiries': { title: 'お問い合わせ' },
  '/superadmin/design-system': { title: 'デザインシステム' },
}

export function resolveSuperAdminCrumb(pathname: string): SuperAdminCrumb | null {
  // 完全一致
  if (breadcrumbMap[pathname]) return breadcrumbMap[pathname]

  // サブページ（動的ルート）向けの個別判定
  // /superadmin/companies/[id] → ブランド › 詳細：◯◯
  // 名前はヘッダー側で足す（pathname だけでは分からないため、ここでは「詳細」まで）
  if (/^\/superadmin\/companies\/[^/]+$/.test(pathname)) {
    return { section: { label: 'ブランド', href: '/superadmin/companies' }, title: '詳細' }
  }
  // /superadmin/news/[id]/edit → ニュース管理 › ニュース編集
  if (/^\/superadmin\/news\/[^/]+\/edit$/.test(pathname)) {
    return { section: { label: 'ニュース管理', href: '/superadmin/news' }, title: 'ニュース編集' }
  }

  // 最長プレフィックス一致（その他サブページ）。
  // 一致した親をそのまま出すと「今いる場所」と同じ名前になるので、
  // 親をセクション（リンク）に回して戻れるようにする
  let best: { key: string; crumb: SuperAdminCrumb } | null = null
  for (const key of Object.keys(breadcrumbMap)) {
    if (pathname.startsWith(key + '/')) {
      if (!best || key.length > best.key.length) {
        best = { key, crumb: breadcrumbMap[key] }
      }
    }
  }
  if (!best) return null
  return { section: { label: best.crumb.title, href: best.key }, title: best.crumb.title }
}
