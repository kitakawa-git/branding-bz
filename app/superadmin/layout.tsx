// スーパー管理画面レイアウト
// AdminDataProvider 配下にして isSuperAdmin チェックを共通化
// SuperAdminShell が isSuperAdmin=false の時にアクセス拒否画面を出す
import { AppAuthProvider } from '@/components/providers/AppAuthProvider'
import { AdminDataProvider } from '@/app/admin/components/AdminDataProvider'
import { SuperAdminShell } from './components/SuperAdminShell'

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppAuthProvider redirectOnSignOutTo="/admin/login">
      <AdminDataProvider>
        <SuperAdminShell>{children}</SuperAdminShell>
      </AdminDataProvider>
    </AppAuthProvider>
  )
}
