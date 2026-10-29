import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '日程調整ツール | 候補日を選んでリンクを送るだけ',
  description: 'カレンダーで候補日と時間を選んで、共有リンクを送るだけ。回答する人はログイン不要。参加できる人が多い日程がひと目でわかる、branding.bz の日程調整ツール。',
  openGraph: {
    title: '日程調整ツール | branding.bz',
    description: 'カレンダーで候補日と時間を選んで、共有リンクを送るだけ。回答する人はログイン不要。',
    url: 'https://branding.bz/tools/sorou',
    // 専用の OG 画像（og_tools_sorou.png）を用意するまでは共通の画像を使う
    images: [{ url: '/og/og_default.png', width: 1200, height: 630 }],
  },
  twitter: {
    images: ['/og/og_default.png'],
  },
  alternates: {
    canonical: '/tools/sorou',
  },
}

export default function SorouToolLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
