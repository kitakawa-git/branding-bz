import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ブランドカラー定義ツール | branding.bz',
  description: 'AIがガイドする、ブランドに最適なカラーパレット策定ツール。プライマリ・セカンダリ・アクセントカラーをプロ品質で定義。',
}

export default function ColorsToolLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
