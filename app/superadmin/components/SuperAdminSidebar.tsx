'use client'

// スーパー管理画面サイドバー（shadcn/ui Sidebar ベース・管理画面と統一）
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAdminData } from '@/app/admin/components/AdminDataProvider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
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

export function SuperAdminSidebar() {
  const pathname = usePathname()
  const { user, profileName, profilePhotoUrl, signOut } = useAdminData()

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
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground overflow-hidden">
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
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.href}>
                        <Icon size={18} />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
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
