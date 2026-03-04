'use client'

// shadcn/ui Sidebar ベースの管理画面サイドバー（floating）
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from './AuthProvider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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
  Users,
  Sparkles,
  CreditCard,
  FileText,
  Palette,
  MessageSquare,
  Compass,
  CircleUser,
  LogOut,
  ShieldCheck,
  ChevronsUpDown,
  Settings2,
  LayoutDashboard,
  Bell,
  Target,
  BookOpen,
  type LucideIcon,
} from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { href: '/admin/dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/admin/company', label: 'ブランド基本情報', icon: Sparkles },
  { href: '/admin/members', label: 'アカウント管理', icon: Users },
  { href: '/admin/kpi', label: '目標・KPI管理', icon: Target },
  { href: '/admin/card-template', label: 'QRコード出力', icon: CreditCard },
  { href: '/admin/announcements', label: 'お知らせ管理', icon: Bell },
]

const brandItems: NavItem[] = [
  { href: '/admin/brand/guidelines', label: 'ブランド方針', icon: FileText },
  { href: '/admin/brand/strategy', label: 'ブランド戦略', icon: Compass },
  { href: '/admin/brand/visuals', label: 'ビジュアル', icon: Palette },
  { href: '/admin/brand/verbal', label: 'バーバル', icon: MessageSquare },
]

const utilityItems: NavItem[] = [
  { href: '/admin/ci-manual', label: 'CIマニュアル出力', icon: BookOpen },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { user, isSuperAdmin, profileName, profilePhotoUrl, signOut } = useAuth()

  const initials = profileName
    ? profileName.slice(0, 1)
    : user?.email?.slice(0, 1)?.toUpperCase() || '?'

  return (
    <Sidebar variant="floating">
      {/* ヘッダー: SidebarMenuButton size="lg" パターン */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/admin">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Settings2 className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">brandconnect</span>
                  <span className="text-xs">管理画面</span>
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
                const isActive =
                  item.href === '/admin/dashboard'
                    ? pathname.startsWith('/admin/dashboard') || pathname.startsWith('/admin/analytics')
                    : pathname.startsWith(item.href)
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

        {/* ブランド掲示セクション */}
        <SidebarGroup>
          <SidebarGroupLabel>ブランド掲示</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {brandItems.map((item) => {
                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)}>
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

        {/* ユーティリティセクション */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {utilityItems.map((item) => {
                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)}>
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
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
              >
                {isSuperAdmin && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/superadmin/companies" className="no-underline">
                        <ShieldCheck className="mr-2 size-4" />
                        スーパー管理画面
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 size-4" />
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
