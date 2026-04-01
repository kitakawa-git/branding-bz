import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ペルソナビルダー | 無料AIペルソナ作成ツール',
  description: 'AIがターゲット顧客のペルソナを自動生成。名前・年齢・職業・行動パターン・インサイトまで具体化。カスタマージャーニーマップの作成にも対応。経営者・マーケター向け無料ツール。',
  openGraph: {
    title: 'ペルソナビルダー | 無料AIペルソナ作成ツール | branding.bz',
    description: 'AIがターゲット顧客のペルソナを自動生成。経営者・マーケター向け無料ツール。',
  },
  alternates: {
    canonical: '/tools/persona',
  },
}

export default function PersonaToolLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
