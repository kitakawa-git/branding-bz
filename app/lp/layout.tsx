import type { Metadata } from 'next'
import Nav from './_components/Nav'
import Footer from './_components/Footer'

export const metadata: Metadata = {
  title: 'branding.bz — AIでブランディングを加速させる',
  description:
    'つくる・ひろげる・とどける。ブランドの構築から浸透、発信までをひとつのプラットフォームで。AIが伴走する、はじめてのブランディングSaaS。',
  openGraph: {
    title: 'branding.bz — AIでブランディングを加速させる',
    description:
      'つくる・ひろげる・とどける。ブランドの構築から浸透、発信までをひとつのプラットフォームで。',
    siteName: 'branding.bz',
    url: 'https://branding.bz',
  },
}

/* 新デザイン（/lp 系）の共通レイアウト。
   ダーク基調＋共通ナビ／フッターを全ページに適用する。
   配下に /lp/<route>/page.tsx を追加すれば、中身だけ書けば共通チロムが付く。 */
export default function LpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#08080a] text-white antialiased">
      <Nav />
      {children}
      <Footer />
    </div>
  )
}
