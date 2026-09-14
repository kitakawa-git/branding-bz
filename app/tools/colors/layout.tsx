import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'ブランドカラー決め方｜AIで無料生成のカラーパレットツール | branding.bz' },
  description: 'AIが業種やブランドの個性に合わせたカラーパレットを提案。プライマリ・セカンダリ・アクセントカラーを定義し、主要な3組の配色について文字の読みやすさの目安となるコントラスト比も確認できます。無料登録で利用可能。CSSカスタムプロパティのコピーに対応し、PDF出力は Standard 以上のプランで利用できます。',
  openGraph: {
    title: 'ブランドカラー決め方｜AIで無料生成のカラーパレットツール | branding.bz',
    description: 'AIがカラーパレットを提案。主要な3組の配色のコントラスト比チェックとCSSのコピーに対応した無料ツール（PDF出力は Standard 以上）。',
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
