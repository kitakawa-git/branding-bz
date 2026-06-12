import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'ブランドカラー決め方｜AIで無料生成のカラーパレットツール | branding.bz' },
  description: 'AIがブランドのパーソナリティや業種に合わせてプロ品質のカラーパレットを提案。プライマリ・セカンダリ・アクセントカラーを定義し、WCAG準拠のアクセシビリティチェックも自動で実施。PDF・CSS出力対応。無料で利用可能。',
  openGraph: {
    title: 'ブランドカラー決め方｜AIで無料生成のカラーパレットツール | branding.bz',
    description: 'AIがプロ品質のカラーパレットを提案。WCAG準拠チェック、PDF・CSS出力対応の無料ツール。',
  },
  alternates: {
    canonical: '/tools/colors',
  },
}

export default function ColorsToolLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
