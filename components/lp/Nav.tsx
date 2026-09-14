'use client'

import Link from 'next/link'
import { useState } from 'react'
import { sendGAEvent } from '@next/third-parties/google'
import { Menu, X, ChevronDown, Target, UserCircle, Palette, Fingerprint, type LucideIcon } from 'lucide-react'

/* 新デザイン（/lp 系）の共通ヘッダー。
   layout.tsx から全ページ共通で描画される。 */
const linksBefore = [
  { href: '/news', label: 'ニュース' },
  { href: '/features', label: '機能' },
]
const linksAfter = [
  { href: '/wiki', label: '用語wiki' },
  { href: '/plan', label: '料金' },
  { href: '/faq', label: 'よくある質問' },
  { href: '/contact', label: 'お問い合わせ' },
]

const toolItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/tools/stp', label: 'STP分析', icon: Target },
  { href: '/tools/persona', label: 'ペルソナビルダー', icon: UserCircle },
  { href: '/tools/colors', label: 'ブランドカラー定義', icon: Palette },
  { href: '/tools/personality', label: 'パーソナリティ診断', icon: Fingerprint },
]

const linkClass =
  'whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white'

export default function Nav() {
  const [open, setOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="relative flex h-16 w-full items-center justify-between px-6 backdrop-blur-xl md:px-10">
        <Link href="/" className="shrink-0">
          <img
            src="/logo.svg"
            alt="branding.bz"
            style={{ height: '18px', width: 'auto', filter: 'brightness(0) invert(1)' }}
          />
        </Link>

        {/* 中央ナビ・ハンバーガー・ハンバーガーメニュー本体の3箇所は必ず同じ幅（1160px）で切り替える。
            ずれると「どちらも出ない幅」か「両方出る幅」ができる。
            以前は 1100px から出していたが、幅が足りず各リンクが「ニュー／ス」と折れていた。
            whitespace-nowrap にすると中央ナビの幅は 608px で一定になり、右クラスタ（ログイン／無料で始める）との間隔は
            実測（Playwright）: 1100px で -8.7px（重なり）、1118px で 0、1140px で 11px、1160px で 21px。
            Windows 等の常時表示スクロールバー（約17px）ぶん実幅が狭まっても重ならないよう、1160px から出す */}
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 min-[1160px]:flex">
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

        {/* 右クラスタ：資料請求は1320px以上のみ。ログイン／無料で始める は常時表示。ハンバーガーは1160px未満のみ。
            ⚠️ 中央ナビは absolute で右クラスタと押し合わないため、幅が足りないと「お問い合わせ」と重なる。
            中央ナビは中央寄せなので、画面幅が Δ 広がると間隔は Δ/2 しか広がらない。
            実測（Playwright）: 1280px でリンク同士が 18.7px 重なり文字間 9.3px、1318px 付近で重なり0・文字間28px
            （中央ナビの他の項目と同じ間隔）になる。余裕を持たせて 1320px から出す */}
        <div className="flex items-center gap-1 sm:gap-3">
          <Link
            href="/document"
            className="hidden whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium text-white/70 transition-colors hover:text-white min-[1320px]:inline-flex"
          >
            資料請求
          </Link>
          <Link
            href="/portal/auth"
            className="hidden whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm font-medium text-white/70 transition-colors hover:text-white min-[360px]:inline sm:px-4"
          >
            {/* 360px 未満はロゴ＋2ボタン＋ハンバーガーが物理的に入らない（実測で約26px不足）。
                全部 nowrap だとハンバーガーが画面外に出てメニューに入れず、折り返しを許すと「ログイン」が1文字ずつ縦に並ぶ。
                ハンバーガーメニュー内にもログインがあるので、360px 未満だけここを隠す */}
            ログイン
          </Link>
          <Link
            href="/signup"
            onClick={() => sendGAEvent('event', 'nav_signup_click', { device: 'desktop' })}
            className="whitespace-nowrap rounded-full bg-white px-2.5 py-1.5 text-sm font-semibold text-black transition-transform hover:scale-105 sm:px-4"
          >
            無料で始める
          </Link>
          <button
            className="p-1.5 text-white min-[1160px]:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="メニュー"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="mx-3 mt-2 rounded-2xl border border-white/10 bg-black/80 p-3 backdrop-blur-xl min-[1160px]:hidden">
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
          <Link
            href="/document"
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2.5 text-base font-medium text-white/80 hover:bg-white/10"
          >
            資料請求
          </Link>
          <Link href="/portal/auth" className="block rounded-xl px-3 py-2.5 text-base font-medium text-white/80 hover:bg-white/10">
            ログイン
          </Link>
          <Link
            href="/signup"
            onClick={() => sendGAEvent('event', 'nav_signup_click', { device: 'mobile' })}
            className="mt-1 block rounded-xl bg-white px-3 py-2.5 text-center text-base font-semibold text-black"
          >
            無料で始める
          </Link>
        </div>
      )}
    </header>
  )
}
