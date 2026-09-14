import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'STP分析ツール｜AIで無料・ポジショニングマップ自動作成 | branding.bz' },
  description: '市場をどう分け、誰を狙い、どう差別化するか。AIが業種に合ったセグメンテーション・ターゲティング・ポジショニングを提案。ポジショニングマップの自動作成に対応し、無料登録で利用可能。PDF出力は Standard 以上のプランで利用できます。',
  openGraph: {
    title: 'STP分析ツール｜AIで無料・ポジショニングマップ自動作成 | branding.bz',
    description: 'AIが業種に合ったSTP戦略を提案。ポジショニングマップを自動作成できる無料ツール（PDF出力は Standard 以上）。',
  },
  alternates: {
    canonical: '/tools/stp',
  },
}

export default function STPToolLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
