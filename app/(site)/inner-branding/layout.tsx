import type { Metadata } from 'next'

const TITLE = 'インナーブランディングツール｜理念を社内に根づかせる仕組み | branding.bz'
const DESCRIPTION =
  '理念やスローガンを掲げても社内に根づかない。branding.bz は、ブランドの掲示・称賛・学習・理解度テスト・浸透スコアまでを1つにまとめ、インナーブランディングを「仕組み」として運用できるツールです。'
const URL = 'https://branding.bz/inner-branding'

// openGraph は親（app/(site)/layout.tsx）の値を継承させず明示する（過去に脱落事故あり）
export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    canonical: URL,
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    siteName: 'branding.bz',
  },
}

export default function InnerBrandingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
