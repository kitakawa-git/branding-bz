import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'お問い合わせ｜branding.bz | AIブランディングツール' },
  description:
    'AIブランディングツール branding.bz へのお問い合わせ。導入相談・料金見積・カスタマイズ要件・無料デモのご依頼はこちら。中小企業・スタートアップのブランディングをご支援します。',
  alternates: {
    canonical: '/contact',
  },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
