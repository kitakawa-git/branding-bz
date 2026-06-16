import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'branding.bz — ブランドを、もっと速く。',
  description:
    'つくる・ひろげる・とどける。ブランドの構築から浸透、発信までをひとつのプラットフォームで。AIが伴走する、はじめてのブランディングSaaS。',
  openGraph: {
    title: 'branding.bz — ブランドを、もっと速く。',
    description:
      'つくる・ひろげる・とどける。ブランドの構築から浸透、発信までをひとつのプラットフォームで。',
    siteName: 'branding.bz',
    url: 'https://branding.bz',
  },
}

export default function LpLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-[#08080a] text-white antialiased">{children}</div>
}
