import type { Metadata } from 'next'
import Nav from '@/components/lp/Nav'
import Footer from '@/components/lp/Footer'

export const metadata: Metadata = {
  title: {
    absolute: 'AIブランディングツール｜中小企業・スタートアップのブランド構築SaaS | branding.bz',
  },
  description:
    'AIがブランディングを加速。中小企業・スタートアップ向けのブランド構築・浸透・発信を一気通貫で支援するSaaS。STP分析・ペルソナ作成・ブランドカラー定義など無料ツールも公開中。ブランディング会社の現場ノウハウから生まれました。',
  openGraph: {
    title: 'AIブランディングツール｜中小企業・スタートアップのブランド構築SaaS | branding.bz',
    description:
      'AIがブランディングを加速。ブランドの構築・浸透・発信を一気通貫で支援するSaaS。STP分析・ペルソナ作成・カラー定義など無料ツールも公開中。',
    siteName: 'branding.bz',
    url: 'https://branding.bz',
  },
  alternates: {
    canonical: '/',
  },
}

/* 新デザイン（root / 系）の共通レイアウト。
   ダーク基調＋共通ナビ／フッターを全ページに適用する。
   配下に /<route>/page.tsx を追加すれば、中身だけ書けば共通チロムが付く。 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#08080a] text-white antialiased">
      <Nav />
      {children}
      <Footer />
    </div>
  )
}
