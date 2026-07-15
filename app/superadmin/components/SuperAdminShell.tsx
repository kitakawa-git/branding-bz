'use client'

// スーパー管理画面の表示シェル（shadcn/ui Sidebar・管理画面と統一）
// 認証は AdminDataProvider に任せ、ここでは is_superadmin チェックと UI 表示だけ
import { useRouter } from 'next/navigation'
import { useAdminData } from '@/app/admin/components/AdminDataProvider'
import { SuperAdminSidebar } from './SuperAdminSidebar'
import { SuperAdminHeader } from './SuperAdminHeader'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { ShieldAlert } from 'lucide-react'

export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const { user, isSuperAdmin, loading, signOut } = useAdminData()
  const router = useRouter()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 text-base text-gray-500">
        読み込み中...
      </div>
    )
  }

  if (!user) {
    // AdminDataProvider 側で /admin/login にリダイレクト済み
    return null
  }

  // スーパー管理者でない場合 → アクセス拒否
  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 font-sans">
        <div className="bg-white rounded-xl p-10 text-center max-w-[400px] shadow-sm">
          <div className="mb-4 flex justify-center text-gray-400">
            <ShieldAlert size={48} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            アクセス権限がありません
          </h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            スーパー管理画面はID INC.スタッフのみアクセスできます。
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push('/admin')}
              className="py-2.5 px-6 bg-transparent text-gray-900 border border-gray-200 rounded-lg text-sm cursor-pointer"
            >
              管理画面へ
            </button>
            <button
              onClick={signOut}
              className="py-2.5 px-6 bg-[#1e3a5f] text-white border-none rounded-lg text-sm font-bold cursor-pointer"
            >
              ログアウト
            </button>
          </div>
        </div>
      </div>
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
