import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'ペルソナ作成ツール｜AIで無料生成・カスタマージャーニー対応 | branding.bz' },
  description: 'AIがBtoB/BtoCのペルソナを自動生成。名前・年齢・職業・行動パターン・インサイトまで具体化し、カスタマージャーニーマップも作成。中小企業・スタートアップ向け無料ペルソナ作成ツール。',
  openGraph: {
    title: 'ペルソナ作成ツール｜AIで無料生成・カスタマージャーニー対応 | branding.bz',
    description: 'AIがBtoB/BtoCのペルソナを自動生成。カスタマージャーニーマップも作成できる無料ツール。',
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
