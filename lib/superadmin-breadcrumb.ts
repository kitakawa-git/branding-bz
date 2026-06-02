// スーパー管理画面ヘッダーのパンくずリスト設定
// pathname → { section?, title } をマップし、ヘッダーでパンくず表示する。
// 各ページ本体の見出しはこの定義に移管したため削除済み。

export type SuperAdminCrumb = {
  section?: string // 親セクション（リンクなしの薄字）
  title: string // 現在ページ名
}

const breadcrumbMap: Record<string, SuperAdminCrumb> = {
  '/superadmin/companies': { title: '企業一覧' },
  '/superadmin/companies/new': { section: '企業一覧', title: '新規企業を登録' },
  '/superadmin/news': { title: 'ニュース管理' },
  '/superadmin/news/new': { section: 'ニュース管理', title: 'ニュース新規作成' },
  '/superadmin/inquiries': { title: 'お問い合わせ' },
}

export function resolveSuperAdminCrumb(pathname: string): SuperAdminCrumb | null {
  // 完全一致
  if (breadcrumbMap[pathname]) return breadcrumbMap[pathname]

  // サブページ（動的ルート）向けの個別判定
  // /superadmin/companies/[id] → 企業一覧 › 企業詳細
  if (/^\/superadmin\/companies\/[^/]+$/.test(pathname)) {
    return { section: '企業一覧', title: '企業詳細' }
  }
  // /superadmin/news/[id]/edit → ニュース管理 › ニュース編集
  if (/^\/superadmin\/news\/[^/]+\/edit$/.test(pathname)) {
    return { section: 'ニュース管理', title: 'ニュース編集' }
  }

  // 最長プレフィックス一致（その他サブページ）
  let best: { key: string; crumb: SuperAdminCrumb } | null = null
  for (const key of Object.keys(breadcrumbMap)) {
    if (pathname.startsWith(key + '/')) {
      if (!best || key.length > best.key.length) {
        best = { key, crumb: breadcrumbMap[key] }
      }
    }
  }
  return best?.crumb ?? null
}
