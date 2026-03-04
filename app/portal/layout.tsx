// ポータルレイアウト（サーバーコンポーネント: メタデータ + クライアントラッパー）
import type { Metadata } from 'next'
import PortalLayoutClient from './PortalLayoutClient'

export const metadata: Metadata = {
  title: {
    template: '%s | brandconnect',
    default: 'ダッシュボード',
  },
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalLayoutClient>{children}</PortalLayoutClient>
}
