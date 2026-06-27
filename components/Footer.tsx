import Link from 'next/link'
import { Mail, Calendar } from 'lucide-react'

// フッターリンクデータ
// 注意: URL は一部仮設定（北川さん確認後に差し替え予定）
const footerLinks = {
  features: [
    { href: '/features#feature-brand', label: 'ブランド掲示' },
    { href: '/features#feature-timeline', label: 'タイムライン' },
    { href: '/features#feature-kpi', label: 'KPI・目標' },
    { href: '/features#feature-score', label: 'ブランドスコア' },
    { href: '/features#feature-card', label: 'スマート名刺' },
  ],
  tools: [
    { href: '/tools/stp', label: 'STP分析' },
    { href: '/tools/persona', label: 'ペルソナビルダー' },
    { href: '/tools/colors', label: 'ブランドカラー定義' },
    { href: '/tools/personality', label: 'パーソナリティ診断' },
  ],
  company: [
    { href: 'https://include.bz/', label: 'ID INC. について', external: true },
    { href: '/news', label: 'ニュース' },
    { href: '/contact', label: 'お問い合わせ' },
    { href: 'https://include.bz/recruit', label: '採用', external: true },
  ],
  legal: [
    { href: '/terms', label: '利用規約' },
    { href: '/privacy-policy', label: 'プライバシーポリシー' },
    { href: '/tokusho', label: '特定商取引法' },
  ],
}

const contactItems = [
  { href: 'mailto:info@include.bz', label: 'メールでお問い合わせ', Icon: Mail },
  { href: '/contact', label: '導入相談を予約', Icon: Calendar },
]

const snsItems = [
  {
    href: 'https://x.com/branding_bz',
    label: 'X',
    svg: <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />,
  },
  {
    href: 'https://www.linkedin.com/company/include-inc',
    label: 'LinkedIn',
    svg: <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452z" />,
  },
  {
    href: 'https://note.com/branding_bz',
    label: 'note',
    svg: (
      <>
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <text x="12" y="16" fontSize="10" fontWeight="bold" textAnchor="middle" fill="currentColor">n</text>
      </>
    ),
  },
]

function NavColumn({ title, links }: { title: string; links: Array<{ href: string; label: string; external?: boolean }> }) {
  return (
    <div>
      <h4 className="mb-4 text-sm font-bold tracking-wide text-foreground">{title}</h4>
      <ul className="flex flex-col gap-2.5">
        {links.map((link) => (
          <li key={link.href}>
            {link.external ? (
              <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                {link.label}
              </a>
            ) : (
              <Link href={link.href} className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * 共通フッターコンポーネント（CTA強化型・5カラム）
 * マーケティングページ・ツールLPなど公開ページで共通使用
 */
export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-border bg-white text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        {/* 上部: 5カラム（モバイルは2カラム） */}
        <div className="grid grid-cols-2 gap-x-16 gap-y-10 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
          {/* 左ロゴ列 */}
          <div className="col-span-2 lg:col-span-1">
            {/* ブランド（実ロゴ） */}
            <Link href="/" className="mb-2 inline-flex items-center no-underline">
              <img src="/logo.svg" alt="branding.bz" style={{ height: '20px', width: 'auto' }} />
            </Link>

            {/* タグライン（短縮版） */}
            <p className="mb-5 max-w-[280px] !text-xs font-bold leading-[1.8] text-foreground">
              AIで、ブランディングを加速させる。
            </p>

            {/* お問い合わせカード */}
            <div className="mb-4 flex max-w-[200px] flex-col gap-2">
              {contactItems.map(({ href, label, Icon }) => {
                const isExternal = href.startsWith('mailto:') || href.startsWith('http')
                const className =
                  'flex items-center gap-2.5 rounded-lg border border-border bg-muted px-3 py-2.5 text-xs font-bold text-foreground no-underline transition-all hover:border-muted-foreground hover:bg-muted/70'
                return isExternal ? (
                  <a key={href} href={href} className={className}>
                    <Icon className="h-3.5 w-3.5 flex-none" />
                    <span>{label}</span>
                  </a>
                ) : (
                  <Link key={href} href={href} className={className}>
                    <Icon className="h-3.5 w-3.5 flex-none" />
                    <span>{label}</span>
                  </Link>
                )
              })}
            </div>

            {/* SNSアイコン */}
            <div className="flex gap-2">
              {snsItems.map(({ href, label, svg }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground transition-colors hover:border-violet-600 hover:bg-violet-50 hover:text-violet-600"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                    {svg}
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* 4ナビカラム */}
          <NavColumn title="機能" links={footerLinks.features} />
          <NavColumn title="構築ツール" links={footerLinks.tools} />
          <NavColumn title="会社情報" links={footerLinks.company} />
          <NavColumn title="規約" links={footerLinks.legal} />
        </div>

        {/* ボトム: copyright のみ */}
        <div className="mt-12 pt-8">
          <p className="text-[11px] text-muted-foreground/70">
            &copy; {new Date().getFullYear()} ID INC. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
