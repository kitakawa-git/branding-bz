import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'お問い合わせ｜branding.bz | AIブランディングツール' },
  description:
    'AIブランディングツール branding.bz へのお問い合わせ。導入相談・料金見積・カスタマイズ要件・無料デモのご依頼はこちら。中小企業・スタートアップのブランディングをご支援します。',
  openGraph: {
    title: 'お問い合わせ｜branding.bz | AIブランディングツール',
    description:
      'AIブランディングツール branding.bz へのお問い合わせ。導入相談・料金見積・カスタマイズ要件・無料デモのご依頼はこちら。',
    url: 'https://branding.bz/contact',
    images: [{ url: '/og/og_page_contact.png', width: 1200, height: 630 }],
  },
  twitter: {
    images: ['/og/og_page_contact.png'],
  },
  alternates: {
    canonical: '/contact',
  },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
