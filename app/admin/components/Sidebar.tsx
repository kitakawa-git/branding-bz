'use client'

// サイドバーナビゲーション
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { colors, layout } from './AdminStyles'
import {
  Users,
  Sparkles,
  BarChart3,
  CreditCard,
  UserPlus,
  FileText,
  Diamond,
  Palette,
  MessageSquare,
  Compass,
} from 'lucide-react'
import { type LucideIcon } from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { href: '/admin/members', label: 'アカウント一覧', icon: Users },
  { href: '/admin/company', label: 'ブランド基本情報', icon: Sparkles },
  { href: '/admin/analytics', label: 'アクセス解析', icon: BarChart3 },
  { href: '/admin/card-template', label: 'QRコード出力', icon: CreditCard },
  { href: '/admin/members-portal', label: 'アカウント作成', icon: UserPlus },
]

const brandItems: NavItem[] = [
  { href: '/admin/brand/guidelines', label: 'ブランド方針', icon: FileText },
  { href: '/admin/brand/strategy', label: 'ブランド戦略', icon: Compass },
  { href: '/admin/brand/visuals', label: 'ビジュアル', icon: Palette },
  { href: '/admin/brand/verbal', label: 'バーバル', icon: MessageSquare },
  { href: '/admin/brand/values', label: '提供価値', icon: Diamond },
]

export function Sidebar() {
  const pathname = usePathname()

  const renderNavLink = (item: NavItem) => {
    const isActive = pathname.startsWith(item.href)
    const Icon = item.icon
    return (
      <Link
        key={item.href}
        href={item.href}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 20px',
          color: isActive ? colors.sidebarActiveText : colors.sidebarText,
          backgroundColor: isActive ? colors.sidebarActiveBg : 'transparent',
          textDecoration: 'none',
          fontSize: 14,
          transition: 'background-color 0.15s',
        }}
      >
        <Icon size={18} />
        {item.label}
      </Link>
    )
  }

  return (
    <aside style={{
      width: layout.sidebarWidth,
      backgroundColor: colors.sidebarBg,
      minHeight: '100vh',
      padding: '24px 0',
      position: 'fixed',
      left: 0,
      top: 0,
    }}>
      {/* ロゴ・タイトル */}
      <div style={{ padding: '0 20px', marginBottom: 32 }}>
        <Link href="/admin" style={{ textDecoration: 'none' }}>
          <h1 style={{
            color: '#ffffff',
            fontSize: 18,
            margin: 0,
            fontWeight: 'bold',
          }}>
            brandconnect
          </h1>
        </Link>
        <p style={{
          color: colors.sidebarText,
          fontSize: 12,
          margin: '4px 0 0',
        }}>
          管理画面
        </p>
      </div>

      {/* ナビゲーションリンク */}
      <nav>
        {navItems.map(renderNavLink)}

        {/* 区切り線 + ブランド掲示セクション */}
        <div style={{
          borderTop: `1px solid ${colors.sidebarActiveBg}`,
          margin: '12px 20px',
        }} />
        <p style={{
          padding: '4px 20px 8px',
          fontSize: 11,
          color: colors.sidebarText,
          margin: 0,
          letterSpacing: 1,
        }}>
          ブランド掲示
        </p>
        {brandItems.map(renderNavLink)}
      </nav>
    </aside>
  )
}
