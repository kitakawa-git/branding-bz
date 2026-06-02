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
      {/* chrome=false: 通常管理画面のサイドバーを描画させず、SuperAdminShell 独自のシェルだけを使う */}
      <AdminDataProvider chrome={false}>
        <SuperAdminShell>{children}</SuperAdminShell>
      </AdminDataProvider>
    </AppAuthProvider>
  )
}
