// 管理画面レイアウト（AuthProviderでラップ）
import type { Metadata } from 'next'
import { AuthProvider } from './components/AuthProvider'

export const metadata: Metadata = {
  title: {
    template: '管理 %s | branding.bz',
    default: '管理',
  },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
