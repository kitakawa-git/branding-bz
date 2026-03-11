'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Menu, X, ChevronDown, Palette, Target } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const navItems = [
  { href: '/', label: 'トップ' },
  { href: '/news', label: 'お知らせ' },
  { href: '/plan', label: '料金・機能' },
  { href: '/faq', label: 'よくある質問' },
  { href: '/contact', label: 'お問い合わせ' },
]

const toolItems = [
  { href: '/tools/colors', label: 'ブランドカラー定義', icon: Palette },
  { href: '/tools/stp', label: 'STP分析', icon: Target },
]

/**
 * 共通ヘッダーコンポーネント
 * マーケティングページ・ツールLPなど公開ページで共通使用
 * - ロゴ: mix-blend-mode: difference で背景色に応じて自動反転
 * - デスクトップ: ナビ + ツールドロップダウン + ログインボタン
 * - モバイル: ハンバーガーメニュー
 */
export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [isOverDark, setIsOverDark] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const headerBottom = 56 // h-14 = 56px
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
          <Link href="/" className="no-underline hover:opacity-80 pointer-events-auto cursor-pointer">
            <img src="/logo.svg" alt="branding.bz" style={{ height: '22px', width: 'auto', filter: 'brightness(0) invert(1)' }} />
          </Link>
        </div>
      </div>

      <header className="fixed top-0 left-0 right-0 z-50 bg-transparent">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          {/* ロゴの幅分のスペーサー */}
          <Link href="/" className="opacity-0 cursor-pointer">
            <img src="/logo.svg" alt="" style={{ height: '22px', width: 'auto' }} />
          </Link>

          {/* デスクトップナビ */}
          <nav className="hidden md:flex items-center gap-1">
            {/* お知らせ */}
            <Link
              href="/news"
              className={`px-3 py-2 text-sm font-semibold rounded-md transition-all duration-300 hover:bg-white/30 hover:backdrop-blur-[10px] ${
                isOverDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              お知らせ
            </Link>

            {/* ツールドロップダウン（ホバーで開閉） */}
            <div
              onMouseEnter={() => setToolsOpen(true)}
              onMouseLeave={() => setToolsOpen(false)}
            >
              <DropdownMenu open={toolsOpen} onOpenChange={setToolsOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`flex items-center gap-1 px-3 py-2 text-sm font-semibold rounded-md transition-all duration-300 outline-none hover:bg-white/30 hover:backdrop-blur-[10px] ${
                      isOverDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    無料ツール
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="p-1 rounded-xl data-[state=open]:duration-300 data-[state=closed]:duration-200 data-[state=open]:ease-out data-[state=closed]:ease-in"
                  style={{
                    background: 'rgba(255, 255, 255, 0.12)',
                    backdropFilter: 'blur(12px) saturate(120%)',
                    WebkitBackdropFilter: 'blur(12px) saturate(120%)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    boxShadow: '0px 8px 24px 0 rgba(12, 74, 110, 0.12), inset 0px 0px 4px 2px rgba(255, 255, 255, 0.15)',
                  }}
                >
                  {toolItems.map((tool) => (
                    <DropdownMenuItem key={tool.href} asChild className="focus:bg-white/30 focus:text-foreground rounded-sm">
                      <Link href={tool.href} className={`cursor-pointer font-semibold ${isOverDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {tool.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* 料金・FAQ・お問い合わせ */}
            {navItems.slice(2).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 text-sm font-semibold rounded-md transition-all duration-300 hover:bg-white/30 hover:backdrop-blur-[10px] ${
                  isOverDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {item.label}
              </Link>
            ))}

            <Link href="/portal/auth" className="ml-3">
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

        {/* モバイルメニュー（リキッドグラス） */}
        {menuOpen && (
          <>
            <style>{`
              @keyframes mobileMenuIn {
                from { opacity: 0; transform: translateY(-8px) scale(0.98); }
                to   { opacity: 1; transform: translateY(0)   scale(1);    }
              }
            `}</style>
            <nav
              className="md:hidden absolute left-3 right-3 top-[58px] rounded-2xl px-4 py-3 space-y-1 overflow-hidden"
              style={{
                background: 'rgba(255, 255, 255, 0.75)',
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                border: '1px solid rgba(255, 255, 255, 0.65)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)',
                animation: 'mobileMenuIn 0.22s cubic-bezier(0.22,1,0.36,1) forwards',
              }}
            >
              <Link
                href="/news"
                className="block px-3 py-2.5 text-base font-semibold text-gray-600 rounded-xl hover:bg-white/60 hover:text-gray-900 transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                お知らせ
              </Link>
              <div className="px-3 pt-2 pb-1 text-sm font-semibold text-gray-400">無料ツール</div>
              {toolItems.map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="block px-3 py-2.5 pl-5 text-base font-semibold text-gray-600 rounded-xl hover:bg-white/60 hover:text-gray-900 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  {tool.label}
                </Link>
              ))}
              {navItems.slice(2).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block px-3 py-2.5 text-base font-semibold text-gray-600 rounded-xl hover:bg-white/60 hover:text-gray-900 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <div
                className="my-2 mx-3"
                style={{ height: '1px', background: 'rgba(0,0,0,0.06)' }}
              />
              <Link
                href="/portal/auth"
                className="block px-3 py-2.5 text-base font-semibold text-gray-900 rounded-xl hover:bg-white/60 transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                ログイン
              </Link>
              <Link
                href="/admin/login"
                className="block px-3 py-2 text-sm text-gray-400 rounded-xl hover:bg-white/40 transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                管理者ログイン
              </Link>
            </nav>
          </>
        )}
      </header>
    </>
  )
}
