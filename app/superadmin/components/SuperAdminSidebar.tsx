'use client'

// スーパー管理画面サイドバー（紺色: 通常管理画面と区別）
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, ArrowLeft, type LucideIcon } from 'lucide-react'

type NavItem = { href: string; label: string; icon: LucideIcon }

const navItems: NavItem[] = [
  { href: '/superadmin/companies', label: '企業一覧', icon: Building2 },
]

export function SuperAdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-[240px] bg-[#1e3a5f] min-h-screen py-6 fixed left-0 top-0">
      {/* ロゴ・タイトル */}
      <div className="px-5 mb-8">
        <Link href="/superadmin" className="no-underline">
          <h1 className="text-white text-lg m-0 font-bold">
            branding.bz
          </h1>
        </Link>
        <div className="inline-block mt-1.5 py-0.5 px-2 bg-amber-500 text-[#1e3a5f] text-[10px] font-bold rounded tracking-wide">
          SUPER ADMIN
        </div>
      </div>

      {/* ナビゲーションリンク */}
      <nav>
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 py-3 px-5 no-underline text-sm transition-colors duration-150 ${
                isActive
                  ? 'text-white bg-[#2a4a6f]'
                  : 'text-[#94b8d9] bg-transparent'
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* 通常管理画面へのリンク */}
      <div className="px-5 pt-6 border-t border-[#2a4a6f] mt-6">
        <Link
          href="/admin"
          className="block py-2.5 text-[#94b8d9] no-underline text-[13px]"
        >
          <ArrowLeft size={14} className="inline" /> 通常管理画面へ
        </Link>
      </div>
    </aside>
  )
}
