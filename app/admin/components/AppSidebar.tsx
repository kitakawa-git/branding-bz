'use client'

// shadcn/ui Sidebar ベースの管理画面サイドバー（floating）
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from './AdminDataProvider'
import { isFeatureEnabled } from '@/lib/constants/feature-toggles'
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
  Compass,
  Map,
  Eye,
  Smile,
  MessageSquare,
  Milestone,
  CircleUser,
  LogOut,
  ShieldCheck,
  ArrowLeftRight,
  ChevronsUpDown,
  LayoutDashboard,
  Bell,
  Printer,
  BarChart3,
  ClipboardCheck,
  GraduationCap,
  Settings,
  Crosshair,
  UserRound,
  Palette,
  Fingerprint,
  type LucideIcon,
} from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { href: '/admin/dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/admin/card-template', label: 'スマート名刺', icon: CreditCard },
  { href: '/admin/kpi', label: '目標・KPI管理', icon: Milestone },
  { href: '/admin/announcements', label: 'お知らせ管理', icon: Bell },
]

const brandItems: NavItem[] = [
  { href: '/admin/brand/guidelines', label: 'ブランド方針', icon: Compass },
  { href: '/admin/brand/personality', label: 'ブランドパーソナリティ', icon: Smile },
  { href: '/admin/brand/visuals', label: 'ビジュアル', icon: Eye },
  { href: '/admin/brand/verbal', label: 'バーバル', icon: MessageSquare },
  { href: '/admin/brand/strategy', label: 'ブランド戦略', icon: Map },
  { href: '/admin/ci-manual', label: 'CIマニュアル出力', icon: Printer },
]

// 構築（ミニアプリ群）: STP分析・ペルソナビルダー・ブランドカラー定義の各ツールのアプリ画面へ
const buildItems: NavItem[] = [
  { href: '/tools/stp/app', label: 'STP分析', icon: Crosshair },
  { href: '/tools/persona/app', label: 'ペルソナビルダー', icon: UserRound },
  { href: '/tools/colors/app', label: 'ブランドカラー定義', icon: Palette },
  { href: '/tools/personality/app', label: 'パーソナリティ診断', icon: Fingerprint },
]

// 浸透（branding.bz本体の浸透施策）: サーベイ・理解度テスト・ラーニング
const penetrationItems: NavItem[] = [
  { href: '/admin/brand-score/surveys', label: 'サーベイ管理', icon: BarChart3 },
  { href: '/admin/brand-score/quizzes', label: '理解度テスト', icon: ClipboardCheck },
  { href: '/admin/learning', label: 'ラーニング', icon: GraduationCap },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { user, companyName, companyLogoUrl, company, isSuperAdmin, profileName, profilePhotoUrl, signOut } = useAuth()

  // 機能トグル: 無効な機能のメニュー項目を非表示にする
  const kpiEnabled = isFeatureEnabled(company, 'kpi_enabled')
  const cardEnabled = isFeatureEnabled(company, 'card_enabled')
  const visibleNavItems = navItems.filter((item) => {
    if (item.href === '/admin/kpi') return kpiEnabled
    if (item.href === '/admin/card-template') return cardEnabled
    return true
  })

  const initials = profileName
    ? profileName.slice(0, 1)
    : user?.email?.slice(0, 1)?.toUpperCase() || '?'

  return (
    <Sidebar variant="floating">
      {/* ヘッダー: 企業ロゴ + 企業名 */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/admin">
                {/* ロゴ未登録時はアイコン枠を表示しない（フォールバックの頭文字も出さない） */}
                {companyLogoUrl && (
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground overflow-hidden">
                    <img src={companyLogoUrl} alt={companyName || ''} className="size-full object-cover" />
                  </div>
                )}
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">{companyName || 'branding.bz'}</span>
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
              {visibleNavItems.map((item) => {
                const Icon = item.icon
                const isActive =
                  item.href === '/admin/dashboard'
                    ? pathname.startsWith('/admin/dashboard') || pathname.startsWith('/admin/analytics') || pathname === '/admin/brand-score'
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

        {/* ブランド基盤セクション */}
        <SidebarGroup>
          <SidebarGroupLabel>ブランド基盤</SidebarGroupLabel>
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

        {/* 構築セクション（ミニアプリ群へのリンク） */}
        <SidebarGroup>
          <SidebarGroupLabel>構築</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {buildItems.map((item) => {
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

        {/* 浸透セクション（サーベイ・理解度テスト・ラーニング） */}
        <SidebarGroup>
          <SidebarGroupLabel>浸透</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {penetrationItems.map((item) => {
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
                <DropdownMenuItem asChild>
                  <Link href="/admin/company" className="no-underline">
                    <Sparkles className="mr-2 size-4" />
                    基本情報
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/members" className="no-underline">
                    <Users className="mr-2 size-4" />
                    アカウント
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/settings" className="no-underline">
                    <Settings className="mr-2 size-4" />
                    設定
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/portal" className="no-underline">
                    <ArrowLeftRight className="mr-2 size-4" />
                    サービス画面
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
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
