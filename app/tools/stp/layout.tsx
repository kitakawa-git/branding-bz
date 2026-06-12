import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'STP分析ツール｜AIで無料・ポジショニングマップ自動作成 | branding.bz' },
  description: '市場をどう分け、誰を狙い、どう差別化するか。AIが最適なセグメンテーション・ターゲティング・ポジショニングを提案。ポジショニングマップの自動作成・PDF出力対応。無料で利用可能。',
  openGraph: {
    title: 'STP分析ツール｜AIで無料・ポジショニングマップ自動作成 | branding.bz',
    description: 'AIが最適なSTP戦略を提案。ポジショニングマップの自動作成・PDF出力に対応した無料ツール。',
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
