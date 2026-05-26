'use client'

// スーパー管理画面の表示シェル
// 認証は AdminDataProvider に任せ、ここでは is_superadmin チェックと UI 表示だけ
import { useRouter } from 'next/navigation'
import { useAdminData } from '@/app/admin/components/AdminDataProvider'
import { SuperAdminSidebar } from './SuperAdminSidebar'
import { SuperAdminHeader } from './SuperAdminHeader'
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

  // スーパー管理者: サイドバー + ヘッダー + コンテンツ
  return (
    <div className="flex min-h-screen">
      <div className="hidden md:block">
        <SuperAdminSidebar />
      </div>
      <div className="flex-1 ml-0 md:ml-[240px]">
        <SuperAdminHeader />
        <main className="p-6 bg-gray-50 min-h-[calc(100vh-60px)]">
          {children}
        </main>
      </div>
    </div>
  )
}
