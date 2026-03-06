import Link from 'next/link'

// フッターリンクデータ
const footerLinks = {
  product: [
    { href: '/', label: 'トップ' },
    { href: '/plan', label: '料金プラン' },
    { href: '/faq', label: 'よくある質問' },
    { href: '/contact', label: 'お問い合わせ' },
  ],
  tools: [
    { href: '/tools/colors', label: 'ブランドカラー定義' },
  ],
  legal: [
    { href: '/portal/terms', label: '利用規約' },
    { href: '/privacy-policy', label: 'プライバシーポリシー' },
    { href: '/tokusho', label: '特定商取引法に基づく表記' },
  ],
  login: [
    { href: '/portal/login', label: 'メンバーログイン' },
    { href: '/admin/login', label: '管理者ログイン' },
  ],
}

/**
 * 共通フッターコンポーネント
 * マーケティングページ・ツールLPなど公開ページで共通使用
 */
export default function Footer() {
  return (
    <footer className="relative z-10 bg-white text-gray-900">
      <div className="mx-auto max-w-7xl px-6 pt-16 pb-10">
        {/* 上部: リンク群 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-8">
          {/* プロダクト */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Product</p>
            <ul className="space-y-2.5">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ツール */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Tools</p>
            <ul className="space-y-2.5">
              {footerLinks.tools.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* リーガル */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Legal</p>
            <ul className="space-y-2.5">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ログイン */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Account</p>
            <ul className="space-y-2.5">
              {footerLinks.login.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 下部: ブランド + コピーライト */}
        <div className="mt-14 pt-8 border-t border-gray-200 flex flex-col items-start gap-2">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-lg font-bold text-gray-900 no-underline">
              branding.bz
            </Link>
            <span className="text-sm text-gray-500">
              AIで、ブランディングを加速させる
            </span>
          </div>
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} branding.bz — ID INC.
          </p>
        </div>
      </div>
    </footer>
  )
}
