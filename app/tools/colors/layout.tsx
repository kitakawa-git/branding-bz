import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'ブランドカラー決め方｜AIで無料生成のカラーパレットツール | branding.bz' },
  description: 'AIが業種やブランドの個性に合わせたカラーパレットを提案。プライマリ・セカンダリ・アクセントカラーを定義し、主要な3組の配色について文字の読みやすさの目安となるコントラスト比も確認できます。PDF・CSS出力対応。無料で利用可能。',
  openGraph: {
    title: 'ブランドカラー決め方｜AIで無料生成のカラーパレットツール | branding.bz',
    description: 'AIがカラーパレットを提案。主要な3組の配色のコントラスト比チェック、PDF・CSS出力に対応した無料ツール。',
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
