// 管理画面レイアウト
// AppAuthProvider（セッション層） + AdminDataProvider（アプリ固有データ層）の2層構造
import type { Metadata } from 'next'
import { AppAuthProvider } from '@/components/providers/AppAuthProvider'
import { AdminDataProvider } from './components/AdminDataProvider'

export const metadata: Metadata = {
  title: {
    template: '管理 %s | branding.bz',
    default: '管理',
  },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppAuthProvider redirectOnSignOutTo="/admin/login">
      <AdminDataProvider>{children}</AdminDataProvider>
    </AppAuthProvider>
  )
}
