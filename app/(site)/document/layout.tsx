import type { Metadata } from 'next'

const TITLE = 'サービス資料ダウンロード | branding.bz'
const DESCRIPTION =
  'branding.bz の機能・料金・導入の流れをまとめた資料（全16ページ）を無料でダウンロードいただけます。'

// openGraph は親の値を継承させず明示する（過去に脱落事故あり）
export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    canonical: 'https://branding.bz/document',
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://branding.bz/document',
  },
}

export default function DocumentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
