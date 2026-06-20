'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X, ChevronDown, Target, UserCircle, Palette, Fingerprint, type LucideIcon } from 'lucide-react'

/* 新デザイン（/lp 系）の共通ヘッダー。
   layout.tsx から全ページ共通で描画される。 */
const linksBefore = [
  { href: '/lp/news', label: 'ニュース' },
  { href: '/lp/features', label: '機能' },
]
const linksAfter = [
  { href: '/lp/plan', label: '料金' },
  { href: '/lp/faq', label: 'よくある質問' },
  { href: '/lp/contact', label: 'お問い合わせ' },
]

const toolItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/tools/stp', label: 'STP分析', icon: Target },
  { href: '/tools/persona', label: 'ペルソナビルダー', icon: UserCircle },
  { href: '/tools/colors', label: 'ブランドカラー定義', icon: Palette },
  { href: '/tools/personality', label: 'パーソナリティ診断', icon: Fingerprint },
]

const linkClass =
  'rounded-full px-3 py-1.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white'

export default function Nav() {
  const [open, setOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="relative flex h-16 w-full items-center justify-between px-6 backdrop-blur-xl md:px-10">
        <Link href="/lp" className="shrink-0">
          <img
            src="/logo.svg"
            alt="branding.bz"
            style={{ height: '18px', width: 'auto', filter: 'brightness(0) invert(1)' }}
          />
        </Link>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
          {linksBefore.map((l) => (
            <a key={l.href} href={l.href} className={linkClass}>
              {l.label}
            </a>
          ))}

          {/* 無料ツール ドロップダウン（ホバーで開閉） */}
          <div
            className="relative"
            onMouseEnter={() => setToolsOpen(true)}
            onMouseLeave={() => setToolsOpen(false)}
          >
            <button className={`flex items-center gap-1 ${linkClass}`}>
              無料ツール
              <ChevronDown size={14} className={`transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
            </button>
            {toolsOpen && (
              <div className="absolute left-1/2 top-full -translate-x-1/2 pt-2">
                <div className="min-w-60 rounded-2xl border border-white/10 bg-black/80 p-1.5 shadow-2xl backdrop-blur-xl">
                  {toolItems.map((t) => (
                    <a
                      key={t.href}
                      href={t.href}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <t.icon size={16} className="text-blue-400" />
                      {t.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {linksAfter.map((l) => (
            <a key={l.href} href={l.href} className={linkClass}>
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/portal/auth"
            className="rounded-full px-4 py-1.5 text-sm font-medium text-white/70 transition-colors hover:text-white"
          >
            ログイン
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-black transition-transform hover:scale-105"
          >
            無料で始める
          </Link>
        </div>

        <button
          className="p-1.5 text-white md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="メニュー"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="mx-3 mt-2 rounded-2xl border border-white/10 bg-black/80 p-3 backdrop-blur-xl md:hidden">
          {linksBefore.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2.5 text-base font-medium text-white/80 hover:bg-white/10"
            >
              {l.label}
            </a>
          ))}

          {/* 無料ツール（モバイルは展開リスト） */}
          <div className="px-3 pb-1 pt-2 text-xs font-semibold text-white/40">無料ツール</div>
          {toolItems.map((t) => (
            <a
              key={t.href}
              href={t.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 pl-5 text-base font-medium text-white/80 hover:bg-white/10"
            >
              <t.icon size={16} className="text-blue-400" />
              {t.label}
            </a>
          ))}

          {linksAfter.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2.5 text-base font-medium text-white/80 hover:bg-white/10"
            >
              {l.label}
            </a>
          ))}

          <div className="my-2 h-px bg-white/10" />
          <Link href="/portal/auth" className="block rounded-xl px-3 py-2.5 text-base font-medium text-white/80 hover:bg-white/10">
            ログイン
          </Link>
          <Link href="/signup" className="mt-1 block rounded-xl bg-white px-3 py-2.5 text-center text-base font-semibold text-black">
            無料で始める
          </Link>
        </div>
      )}
    </header>
  )
}
