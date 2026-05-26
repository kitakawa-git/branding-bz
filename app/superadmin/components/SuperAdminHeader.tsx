'use client'

// スーパー管理画面ヘッダー
import Link from 'next/link'
import { useAdminData } from '@/app/admin/components/AdminDataProvider'

export function SuperAdminHeader() {
  const { user, signOut } = useAdminData()

  return (
    <header className="h-[60px] bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* 左側: バッジ + 通常管理画面リンク */}
      <div className="flex items-center gap-3">
        <span className="py-1 px-2.5 bg-[#1e3a5f] text-white text-xs font-bold rounded">
          スーパー管理
        </span>
        <Link
          href="/admin/members"
          className="py-1.5 px-3.5 bg-blue-600 text-white text-[13px] font-bold rounded-md no-underline"
        >
          通常管理画面へ →
        </Link>
      </div>

      {/* 右側: ユーザー情報+ログアウト */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">
          {user?.email}
        </span>
        <button
          onClick={signOut}
          className="py-2 px-4 bg-transparent border border-gray-200 rounded-md text-sm cursor-pointer text-gray-900"
        >
          ログアウト
        </button>
      </div>
    </header>
  )
}
