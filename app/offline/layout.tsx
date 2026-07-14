import type { Metadata } from 'next'

// PWAのオフラインフォールバック。検索インデックスから外す。
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function OfflineLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
