'use client'

// shadcn/ui Sidebar ベースの管理画面サイドバー（floating）
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from './AdminDataProvider'
import { isFeatureEnabled } from '@/lib/constants/feature-toggles'
import { PlanLockBadge } from '@/components/billing/plan-gate'
import { useOnboarding } from '@/components/onboarding/use-onboarding'
import type { FeatureKey } from '@/lib/billing/entitlements'
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
import { PortalBackCoachMark } from '@/components/onboarding/PortalBackCoachMark'
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
  Globe,
  ToggleLeft,
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
  /** プラン外なら 🔒＋「◯◯から」バッジを出す（隠さずグレーで見せる） */
  feature?: FeatureKey
  /** 構築ツール。free/card では今月の残り回数を出す（429 の予告） */
  appType?: string
  /**
   * 機能トグル（companies の *_enabled 列）。off なら項目ごと消す。
   * feature がプラン上の可否なのに対し、こちらは「使わないので見せない」という会社の意思。
   */
  toggleKey?: string
}

const navItems: NavItem[] = [
  { href: '/admin/brand-score', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/admin/card-template', label: 'スマート名刺', icon: CreditCard, feature: 'smartCard', toggleKey: 'card_enabled' },
  { href: '/admin/kpi', label: '目標・KPI', icon: Milestone, feature: 'kpi', toggleKey: 'kpi_enabled' },
  { href: '/admin/announcements', label: 'お知らせ', icon: Bell, feature: 'announcements', toggleKey: 'announcements_enabled' },
]

const brandItems: NavItem[] = [
  { href: '/admin/brand/guidelines', label: 'ブランド方針', icon: Compass },
  { href: '/admin/brand/personality', label: 'ブランドパーソナリティ', icon: Smile },
  { href: '/admin/brand/visuals', label: 'ビジュアル', icon: Eye },
  { href: '/admin/brand/verbal', label: 'バーバル', icon: MessageSquare },
  { href: '/admin/brand/strategy', label: 'ブランド戦略', icon: Map },
  { href: '/admin/ci-manual', label: 'CIマニュアル出力', icon: Printer, feature: 'ciManualPdf', toggleKey: 'ci_manual_enabled' },
]

// 構築（ミニアプリ群）: STP分析・ペルソナビルダー・ブランドカラー定義の各ツールのアプリ画面へ
const buildItems: NavItem[] = [
  { href: '/tools/stp/app', label: 'STP分析', icon: Crosshair, appType: 'stp' },
  { href: '/tools/persona/app', label: 'ペルソナビルダー', icon: UserRound, appType: 'persona' },
  { href: '/tools/colors/app', label: 'ブランドカラー定義', icon: Palette, appType: 'brand_colors' },
  { href: '/tools/personality/app', label: 'パーソナリティ診断', icon: Fingerprint, appType: 'personality' },
]

// 浸透（branding.bz本体の浸透施策）: サーベイ・市場調査・理解度テスト・ラーニング
const penetrationItems: NavItem[] = [
  { href: '/admin/brand-score/surveys', label: 'サーベイ', icon: BarChart3, feature: 'innerSurvey', toggleKey: 'survey_enabled' },
  // 社外の浸透（外部調査）。サーベイ管理が社内なのと対になる
  { href: '/admin/brand-score/market-surveys', label: '市場調査', icon: Globe, feature: 'brandScoreIntegrated', toggleKey: 'market_survey_enabled' },
  { href: '/admin/brand-score/quizzes', label: '理解度テスト', icon: ClipboardCheck, feature: 'brandQuiz', toggleKey: 'quiz_enabled' },
  { href: '/admin/learning', label: 'ラーニング', icon: GraduationCap, feature: 'videoLearning', toggleKey: 'learning_enabled' },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { user, companyName, companyLogoUrl, company, isSuperAdmin, profileName, profilePhotoUrl, signOut } = useAuth()

  // 機能トグル: 無効な機能のメニュー項目を非表示にする。
  // href の直書き分岐だと項目が増えるたびに書き足す必要があり、
  // 実際「トグルはあるのに消えないメニュー」が出たので toggleKey 方式に統一した
  const isVisible = (item: NavItem) => !item.toggleKey || isFeatureEnabled(company, item.toggleKey)
  const visibleNavItems = navItems.filter(isVisible)
  const visibleBrandItems = brandItems.filter(isVisible)
  const visiblePenetrationItems = penetrationItems.filter(isVisible)

  // セットアップが途中なら、ダッシュボードの着地先を「セットアップの進捗」タブにする。
  // 未完了の人にとっての「まず見る画面」はスコアではなく次にやること。
  // userId を渡してページキャッシュを DashboardTabs と共有し、遷移のたびに
  // 行き先が一瞬 brand-score に戻るのを防ぐ
  const onboarding = useOnboarding(company, { userId: user?.id })
  const setupOpen = !onboarding.loading && !onboarding.hidden && !!onboarding.view
  const dashboardHref = setupOpen ? '/admin/setup' : '/admin/brand-score'

  // 構築ツールの残り回数（free/card のみ。無制限のプランでは limit=null で何も出ない）
  const [toolUsage, setToolUsage] = useState<{ limit: number | null; remaining: Record<string, number> | null }>({ limit: null, remaining: null })
  useEffect(() => {
    let cancelled = false
    fetch('/api/tools/usage')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d) setToolUsage(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

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
                // ダッシュボードはタブの束。どのタブにいても項目を点灯させる
                const isDashboard = item.href === '/admin/brand-score'
                const isActive = isDashboard
                  ? pathname === '/admin/brand-score' ||
                    pathname.startsWith('/admin/setup') ||
                    pathname.startsWith('/admin/dashboard') ||
                    pathname.startsWith('/admin/analytics')
                  : pathname.startsWith(item.href)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={isDashboard ? dashboardHref : item.href}>
                        <Icon size={18} />
                        <span>{item.label}</span>
                        {item.feature && <PlanLockBadge company={company} feature={item.feature} />}
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
              {visibleBrandItems.map((item) => {
                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)}>
                      <Link href={item.href}>
                        <Icon size={18} />
                        <span>{item.label}</span>
                        {item.feature && <PlanLockBadge company={company} feature={item.feature} />}
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
                const left = item.appType && toolUsage.remaining
                  ? toolUsage.remaining[item.appType]
                  : undefined
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)}>
                      <Link href={item.href}>
                        <Icon size={18} />
                        <span>{item.label}</span>
                        {/* 上限のあるプランだけ。使い切ったことも予告になるので 0 も出す。
                            ! 付きなのは globals.css の「本文の最低フォントサイズ14px」が
                            text-[9px] を 14px に底上げしてしまうため。サイドバーの項目は
                            button ではなく a なので、あのルールの除外に当たらない */}
                        {left !== undefined && (
                          <span className={`ml-auto shrink-0 rounded px-1 py-0.5 !text-[11px] !leading-[16px] font-medium ${left === 0 ? 'bg-gray-100 text-gray-500' : 'bg-gray-100 text-gray-600'}`}>
                            {left === 0 ? '今月分終了' : `残り${left}回`}
                          </span>
                        )}
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
              {visiblePenetrationItems.map((item) => {
                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)}>
                      <Link href={item.href}>
                        <Icon size={18} />
                        <span>{item.label}</span>
                        {item.feature && <PlanLockBadge company={company} feature={item.feature} />}
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
        {/* ポータルへ戻るリンクはこの下のアカウントメニューの中にあり畳まれている。
            セットアップ案内から来た人には、1回だけ場所を教える */}
        <PortalBackCoachMark />
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
                {isSuperAdmin && (
                  <>
                    <DropdownMenuItem asChild className="h-11 px-3 gap-2 text-base font-medium rounded-md">
                      <Link href="/superadmin/companies" className="no-underline">
                        <ShieldCheck className="size-4" />
                        スーパー管理画面
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem asChild className="h-11 px-3 gap-2 text-base font-medium rounded-md">
                  <Link href="/admin/company" className="no-underline">
                    <Sparkles className="size-4" />
                    基本情報
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="h-11 px-3 gap-2 text-base font-medium rounded-md">
                  <Link href="/admin/members" className="no-underline">
                    <Users className="size-4" />
                    アカウント
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="h-11 px-3 gap-2 text-base font-medium rounded-md">
                  {/* 中身はトグルスイッチが並ぶ画面そのものなので歯車ではなくトグル。
                      目のアイコンは「見え方・聞こえ方」で使っているので避ける */}
                  <Link href="/admin/settings" className="no-underline">
                    <ToggleLeft className="size-4" />
                    表示設定
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="h-11 px-3 gap-2 text-base font-medium rounded-md">
                  <Link href="/portal" className="no-underline">
                    <ArrowLeftRight className="size-4" />
                    ポータル画面
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
