'use client'

// ポータル用サイドバー（floating + 明るい配色）
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePortalAuth } from './PortalAuthProvider'
import { CardPreviewDialog } from './CardPreviewDialog'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Compass,
  Map,
  Palette,
  MessageSquare,
  MessageSquareHeart,
  Milestone,
  LayoutDashboard,
  CircleUser,
  CreditCard,
  LogOut,
  ChevronsUpDown,
  ArrowLeftRight,
  type LucideIcon,
} from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

// ブランド基盤グループ
const brandItems: NavItem[] = [
  { href: '/portal/guidelines', label: 'ブランド方針', icon: Compass },
  { href: '/portal/strategy', label: 'ブランド戦略', icon: Map },
  { href: '/portal/visuals', label: 'ビジュアル', icon: Palette },
  { href: '/portal/verbal', label: 'バーバル', icon: MessageSquare },
]

// 浸透グループ
const engagementItems: NavItem[] = [
  { href: '/portal', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/portal/timeline', label: 'タイムライン', icon: MessageSquareHeart },
  { href: '/portal/kpi', label: '目標・KPI', icon: Milestone },
]

function NavGroup({ label, items, pathname }: { label: string; items: NavItem[]; pathname: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const Icon = item.icon
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={item.href === '/portal' ? pathname === '/portal' : pathname.startsWith(item.href)}>
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
  )
}

export function PortalSidebar() {
  const pathname = usePathname()
  const { member, companyName, companyLogoUrl, slogan, profileName, profilePhotoUrl, profileSlug, isAdmin, signOut } = usePortalAuth()
  const [cardPreviewOpen, setCardPreviewOpen] = useState(false)

  const brandInitial = companyName?.slice(0, 1) || 'B'

  const profileInitial = profileName
    ? profileName.slice(0, 1)
    : member?.display_name?.slice(0, 1) || '?'

  const displayName = profileName || member?.display_name || member?.email

  return (
    <>
      <Sidebar variant="floating">
        {/* ブランド情報ヘッダー（サンプル準拠: SidebarMenuButton size="lg"） */}
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/portal">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground overflow-hidden">
                    {companyLogoUrl ? (
                      <img src={companyLogoUrl} alt={companyName || ''} className="size-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold">{brandInitial}</span>
                    )}
                  </div>
                  <div className={`flex flex-col leading-none ${slogan ? 'gap-0.5' : 'justify-center'}`}>
                    <span className="font-semibold">{companyName || 'branding.bz'}</span>
                    {slogan && <span className="text-xs text-sidebar-foreground/70">{slogan}</span>}
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          {/* 浸透（ラベルなし） */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {engagementItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={item.href === '/portal' ? pathname === '/portal' : pathname.startsWith(item.href)}>
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
          <NavGroup label="ブランド基盤" items={brandItems} pathname={pathname} />

        </SidebarContent>

        {/* ユーザーメニュー */}
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                    <Avatar className="size-8 shrink-0">
                      {profilePhotoUrl && <AvatarImage src={profilePhotoUrl} alt={displayName || ''} />}
                      <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">
                        {profilePhotoUrl ? profileInitial : <CircleUser className="size-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 leading-tight">
                      <span className="block truncate text-sm font-semibold">
                        {displayName}
                      </span>
                      {profileName && member?.email && (
                        <span className="block truncate text-xs opacity-70">
                          {member.email}
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
                  <DropdownMenuItem asChild className="h-10 px-3 gap-2 text-base font-medium rounded-md">
                    <Link href="/portal/profile" className="no-underline">
                      <CircleUser className="size-4" />
                      マイプロフィール
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCardPreviewOpen(true)} className="h-10 px-3 gap-2 text-base font-medium rounded-md">
                    <CreditCard className="size-4" />
                    名刺プレビュー
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild className="h-10 px-3 gap-2 text-base font-medium rounded-md">
                      <Link href="/admin" className="no-underline">
                        <ArrowLeftRight className="size-4" />
                        管理画面
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={signOut} className="h-10 px-3 gap-2 text-base font-medium rounded-md">
                    <LogOut className="size-4" />
                    ログアウト
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {/* 名刺プレビューDialog */}
      <CardPreviewDialog
        open={cardPreviewOpen}
        onOpenChange={setCardPreviewOpen}
        slug={profileSlug}
        name={profileName}
      />
    </>
  )
}
