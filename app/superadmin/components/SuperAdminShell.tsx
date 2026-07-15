'use client'

// スーパー管理画面の表示シェル（shadcn/ui Sidebar・管理画面と統一）
// 認証は AdminDataProvider に任せ、ここでは is_superadmin チェックと UI 表示だけ
import { useRouter } from 'next/navigation'
import { useAdminData } from '@/app/admin/components/AdminDataProvider'
import { SuperAdminSidebar } from './SuperAdminSidebar'
import { SuperAdminHeader } from './SuperAdminHeader'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { ShieldAlert } from 'lucide-react'
import { GateShell } from '@/components/admin/GateShell'
import { AuthSplash } from '@/components/admin/AuthSplash'

export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const { user, isSuperAdmin, loading, signOut } = useAdminData()
  const router = useRouter()

  if (loading) {
    return <AuthSplash />
  }

  if (!user) {
    // AdminDataProvider 側で /admin/login にリダイレクト済み
    return null
  }

  // スーパー管理者でない場合 → アクセス拒否
  if (!isSuperAdmin) {
    return (
      <GateShell
        icon={<ShieldAlert size={48} />}
        title="アクセス権限がありません"
        body="スーパー管理画面はID INC.スタッフのみアクセスできます。"
        secondary={{ label: '管理画面へ', onClick: () => router.push('/admin') }}
        primary={{ label: 'ログアウト', onClick: signOut }}
      />
    )
  }

  // スーパー管理者: サイドバー + ヘッダー + コンテンツ（管理画面と同じ floating Sidebar）
  // サイドバーの配色だけ独自テーマに上書き（通常管理画面と区別）。
  // SidebarInset(本体)は bg-background、SidebarTrigger は ghost ボタンのため影響なし。
  return (
    <SidebarProvider
      style={{
        '--sidebar-width': '19rem',
        // 背景はほぼ黒（無彩色のダークグレー）。
        '--sidebar-background': '0 0% 10%',
        '--sidebar-foreground': '210 40% 90%',
        // ロゴ／フォーカスリングのみアクセントカラー（琥珀・紺）を残す
        '--sidebar-primary': '38 92% 50%',
        '--sidebar-primary-foreground': '214 60% 18%',
        // アクティブ/ホバー背景は背景と同じ無彩色で明度+8pt（通常管理画面の 18%→26% と同じ関係）。
        // 背景に馴染ませ、区別は文字色(白)と font-semibold で付ける。
        '--sidebar-accent': '0 0% 18%',
        '--sidebar-accent-foreground': '0 0% 100%',
        '--sidebar-border': '0 0% 18%',
        '--sidebar-ring': '214 50% 55%',
      } as React.CSSProperties}
    >
      <SuperAdminSidebar />
      <SidebarInset>
        <SuperAdminHeader />
        <main className="max-w-4xl mx-auto px-5 pt-4 pb-6 w-full">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
