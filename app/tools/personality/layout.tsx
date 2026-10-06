import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ブランドパーソナリティ診断 | 無料AI診断ツール',
  description: '10問の質問に答えるだけで、AIがブランドの人格を診断。Aaker 5次元のスコア型と12アーキタイプのタイプ型、2つのフレームワークで「らしさ」を言語化。経営者・マーケター向け無料ツール。',
  openGraph: {
    title: 'ブランドパーソナリティ診断 | 無料AI診断ツール | branding.bz',
    description: '10問の質問に答えるだけで、AIがブランドの人格を診断。経営者・マーケター向け無料ツール。',
    url: 'https://branding.bz/tools/personality',
    images: [{ url: '/og/og_tools_personality.png', width: 1200, height: 630 }],
  },
  twitter: {
    images: ['/og/og_tools_personality.png'],
  },
  alternates: {
    canonical: '/tools/personality',
  },
}

export default function PersonalityToolLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
