'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/', label: 'トップ' },
  { href: '/plan', label: '料金' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'お問い合わせ' },
]

function Header() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-transparent">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        {/* ロゴ */}
        <Link href="/" className="text-lg font-bold text-gray-900 no-underline hover:opacity-80">
          branding.bz
        </Link>

        {/* デスクトップナビ */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2 text-sm font-semibold text-gray-600 rounded-md hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              {item.label}
            </Link>
          ))}
          <Link href="/portal/login" className="ml-3">
            <button
              className="relative h-8 px-4 rounded-full text-sm font-semibold text-gray-900 overflow-hidden transition-all hover:scale-105 hover:shadow-lg"
              style={{
                background: 'rgba(255, 255, 255, 0.25)',
                backdropFilter: 'blur(12px) saturate(120%)',
                WebkitBackdropFilter: 'blur(12px) saturate(120%)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0px 4px 12px 0 rgba(12, 74, 110, 0.08), inset 0px 1px 0px 0px rgba(255, 255, 255, 0.3)',
              }}
            >
              <span className="relative z-10">ログイン</span>
            </button>
          </Link>
        </nav>

        {/* モバイルハンバーガー */}
        <button
          className="md:hidden p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="メニュー"
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* モバイルメニュー */}
      {menuOpen && (
        <nav className="md:hidden bg-white border-t px-4 py-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2.5 text-sm text-gray-600 rounded-md hover:bg-gray-100 hover:text-gray-900"
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/portal/login"
            className="block px-3 py-2.5 text-sm font-medium text-gray-900"
            onClick={() => setMenuOpen(false)}
          >
            ログイン
          </Link>
          <Link
            href="/admin/login"
            className="block px-3 py-2.5 text-xs text-gray-400"
            onClick={() => setMenuOpen(false)}
          >
            管理者ログイン
          </Link>
        </nav>
      )}
    </header>
  )
}

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

function Footer() {
  return (
    <footer className="relative z-10 bg-gray-950 text-white">
      <div className="mx-auto max-w-7xl px-6 pt-16 pb-10">
        {/* 上部: ロゴ + リンク群 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 md:gap-8">
          {/* ブランド */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="text-lg font-bold text-white no-underline">
              branding.bz
            </Link>
            <p className="mt-3 text-sm text-gray-400 leading-relaxed">
              AIで、ブランディングを加速させる
            </p>
          </div>

          {/* プロダクト */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Product</p>
            <ul className="space-y-2.5">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ツール */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Tools</p>
            <ul className="space-y-2.5">
              {footerLinks.tools.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* リーガル */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Legal</p>
            <ul className="space-y-2.5">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ログイン */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Account</p>
            <ul className="space-y-2.5">
              {footerLinks.login.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 下部: コピーライト + 運営情報 */}
        <div className="mt-14 pt-8 border-t border-gray-800/60 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} branding.bz — ID INC.
          </p>
          <p className="text-xs text-gray-600">
            川崎市 | CEO 北川巧
          </p>
        </div>
      </div>
    </footer>
  )
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div>
      <Header />
      <main>{children}</main>
      <Footer />
    </div>
  )
}
