'use client'

// スーパー管理画面サイドバー（shadcn/ui Sidebar ベース・管理画面と統一）
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAdminData } from '@/app/admin/components/AdminDataProvider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Building2,
  Newspaper,
  MessageSquare,
  Palette,
  ShieldCheck,
  UserCheck,
  ArrowLeftRight,
  LogOut,
  CircleUser,
  ChevronsUpDown,
  type LucideIcon,
} from 'lucide-react'

type NavItem = { href: string; label: string; icon: LucideIcon }

const navItems: NavItem[] = [
  { href: '/superadmin/companies', label: '企業一覧', icon: Building2 },
  { href: '/superadmin/signup-requests', label: '新規登録の承認', icon: UserCheck },
  { href: '/superadmin/news', label: 'ニュース', icon: Newspaper },
  { href: '/superadmin/inquiries', label: 'お問い合わせ', icon: MessageSquare },
  { href: '/superadmin/design-system', label: 'デザインシステム', icon: Palette },
]

// 承認待ち件数が変わったとき、承認ページからこのイベントで即時反映させる
export const SIGNUP_REQUESTS_CHANGED = 'signup-requests-changed'

export function SuperAdminSidebar() {
  const pathname = usePathname()
  const { user, profileName, profilePhotoUrl, signOut } = useAdminData()
  // 承認待ちの新規登録件数（サイドバーの「新規登録の承認」にバッジ表示）
  const [pendingCount, setPendingCount] = useState(0)

  const loadPendingCount = useCallback(async () => {
    const { count } = await supabase
      .from('companies')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'pending')
    setPendingCount(count ?? 0)
  }, [])

  // 初回・ページ遷移時に再取得。承認/却下の直後はカスタムイベントで即時反映。
  useEffect(() => {
    loadPendingCount()
    const onChanged = () => loadPendingCount()
    window.addEventListener(SIGNUP_REQUESTS_CHANGED, onChanged)
    return () => window.removeEventListener(SIGNUP_REQUESTS_CHANGED, onChanged)
  }, [loadPendingCount, pathname])

  const initials = profileName
    ? profileName.slice(0, 1)
    : user?.email?.slice(0, 1)?.toUpperCase() || '?'

  return (
    <Sidebar variant="floating">
      {/* ヘッダー: ロゴ + スーパー管理 */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/superadmin">
                {/* 琥珀色のまま、暗い背景から輪郭が立つよう薄いグレーの外線を付ける */}
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg border border-gray-300 bg-sidebar-primary text-sidebar-primary-foreground overflow-hidden">
                  <ShieldCheck className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">branding.bz</span>
                  <span className="text-xs">スーパー管理</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* メインナビゲーション */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname.startsWith(item.href)
                // 「新規登録の承認」だけ、承認待ち件数を通知バッジで出す
                const badge =
                  item.href === '/superadmin/signup-requests' && pendingCount > 0
                    ? pendingCount
                    : null
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.href}>
                        <Icon size={18} />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {badge !== null && (
                      // rounded-full: 通知バッジらしい見た目＋globals.css の本文14px底上げ対象外にする
                      // top-1/2 + -translate-y-1/2: 既定の top-1.5（上寄せ）を打ち消して項目の上下中央に置く
                      <SidebarMenuBadge
                        className="peer-data-[size=default]/menu-button:top-1/2 -translate-y-1/2 rounded-full bg-red-500 font-bold text-white peer-hover/menu-button:text-white peer-data-[active=true]/menu-button:text-white"
                        aria-label={`承認待ち ${badge}件`}
                      >
                        {badge > 99 ? '99+' : badge}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ユーザーメニュー（フッター固定） */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <Avatar className="size-8 shrink-0">
                    {profilePhotoUrl && <AvatarImage src={profilePhotoUrl} alt={profileName || ''} />}
                    <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">
                      {profilePhotoUrl ? initials : <CircleUser className="size-4" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 leading-tight">
                    <span className="block truncate text-sm font-semibold">
                      {profileName || user?.email}
                    </span>
                    {profileName && (
                      <span className="block truncate text-xs opacity-70">
                        {user?.email}
                      </span>
                    )}
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 p-2"
              >
                <DropdownMenuItem asChild className="h-11 px-3 gap-2 text-base font-medium rounded-md">
                  <Link href="/admin" className="no-underline">
                    <ArrowLeftRight className="size-4" />
                    通常管理画面へ
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="h-11 px-3 gap-2 text-base font-medium rounded-md">
                  <LogOut className="size-4" />
                  ログアウト
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
