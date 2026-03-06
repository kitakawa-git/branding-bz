'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Menu, X, ChevronDown, Palette, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Footer from '@/components/Footer'

const navItems = [
  { href: '/', label: 'トップ' },
  { href: '/plan', label: '料金' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'お問い合わせ' },
]

const toolItems = [
  { href: '/tools/colors', label: 'ブランドカラー定義', icon: Palette },
  { href: '/tools/stp', label: 'STP分析', icon: Target },
]

function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [isOverDark, setIsOverDark] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const headerBottom = 56 // h-14 = 56px
      // フッター等の暗い背景セクションとの重なりを検出
      const darkElements = document.querySelectorAll('footer, [data-dark]')
      let overDark = false
      darkElements.forEach((el) => {
        const rect = el.getBoundingClientRect()
        if (rect.top < headerBottom && rect.bottom > 0) {
          overDark = true
        }
      })
      setIsOverDark(overDark)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
    {/* ロゴ（独立レイヤー: mix-blend-mode: difference で背景色に応じて自動反転） */}
    <div
      className="fixed top-0 left-0 right-0 z-50 pointer-events-none"
      style={{ mixBlendMode: 'difference' }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center px-6">
        <Link href="/" className="text-lg font-bold text-white no-underline hover:opacity-80 pointer-events-auto">
          branding.bz
        </Link>
      </div>
    </div>

    <header className="fixed top-0 left-0 right-0 z-50 bg-transparent">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        {/* ロゴの幅分のスペーサー（クリックでトップへ遷移） */}
        <Link href="/" className="text-lg font-bold opacity-0">branding.bz</Link>

        {/* デスクトップナビ */}
        <nav className="hidden md:flex items-center gap-1">
          {/* トップ */}
          <Link
            href="/"
            className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-300 ${
              isOverDark
                ? 'text-gray-300 hover:text-white hover:bg-white/10'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            トップ
          </Link>

          {/* ツールドロップダウン（ホバーで開閉） */}
          <div
            onMouseEnter={() => setToolsOpen(true)}
            onMouseLeave={() => setToolsOpen(false)}
          >
          <DropdownMenu open={toolsOpen} onOpenChange={setToolsOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className={`flex items-center gap-1 px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-300 outline-none ${
                  isOverDark
                    ? 'text-gray-300 hover:text-white hover:bg-white/10'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                ツール
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="border-0 p-1"
              style={{
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(12px) saturate(120%)',
                WebkitBackdropFilter: 'blur(12px) saturate(120%)',
                border: '1px solid rgba(255, 255, 255, 0.8)',
                boxShadow: '0px 8px 24px 0 rgba(12, 74, 110, 0.12), inset 0px 0px 4px 2px rgba(255, 255, 255, 0.15)',
              }}
            >
              {toolItems.map((tool) => (
                <DropdownMenuItem key={tool.href} asChild>
                  <Link href={tool.href} className="cursor-pointer">
                    {tool.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          </div>

          {/* 料金・FAQ・お問い合わせ */}
          {navItems.slice(1).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-300 ${
                isOverDark
                  ? 'text-gray-300 hover:text-white hover:bg-white/10'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </Link>
          ))}
          <Link href="/portal/login" className="ml-3">
            <button
              className={`relative h-8 px-4 rounded-full text-sm font-semibold overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-lg ${isOverDark ? 'text-white' : 'text-gray-900'}`}
              style={{
                background: isOverDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.25)',
                backdropFilter: 'blur(12px) saturate(120%)',
                WebkitBackdropFilter: 'blur(12px) saturate(120%)',
                border: `1px solid ${isOverDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.4)'}`,
                boxShadow: isOverDark
                  ? '0px 4px 12px 0 rgba(0, 0, 0, 0.3), inset 0px 1px 0px 0px rgba(255, 255, 255, 0.1)'
                  : '0px 4px 12px 0 rgba(12, 74, 110, 0.08), inset 0px 1px 0px 0px rgba(255, 255, 255, 0.3)',
              }}
            >
              <span className="relative z-10">ログイン</span>
            </button>
          </Link>
        </nav>

        {/* モバイルハンバーガー */}
        <button
          className={`md:hidden p-2 transition-colors duration-300 ${isOverDark ? 'text-white' : 'text-gray-900'}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="メニュー"
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* モバイルメニュー */}
      {menuOpen && (
        <nav className="md:hidden bg-white border-t px-4 py-3 space-y-1">
          <Link
            href="/"
            className="block px-3 py-2.5 text-sm text-gray-600 rounded-md hover:bg-gray-100 hover:text-gray-900"
            onClick={() => setMenuOpen(false)}
          >
            トップ
          </Link>
          {/* ツール */}
          <div className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400">ツール</div>
          {toolItems.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="flex items-center gap-2 px-3 py-2.5 pl-5 text-sm text-gray-600 rounded-md hover:bg-gray-100 hover:text-gray-900"
              onClick={() => setMenuOpen(false)}
            >
              <tool.icon className="h-4 w-4" />
              {tool.label}
            </Link>
          ))}
          {navItems.slice(1).map((item) => (
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
    </>
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
