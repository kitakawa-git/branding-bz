'use client'

// ポータル用サイドバー（floating + 明るい配色）
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePortalAuth } from './PortalDataProvider'
import { isFeatureEnabled } from '@/lib/constants/feature-toggles'
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
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
  Target,
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
  Smile,
  Eye,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

// 浸透グループ
const engagementItems: NavItem[] = [
  { href: '/portal', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/portal/timeline', label: 'タイムライン', icon: MessageSquareHeart },
  { href: '/portal/kpi', label: '目標・KPI', icon: Milestone },
]

// 「私たちの『らしさ』」グループ（内部→外部の視点ワード構成）
// バリュー(values)は「考え方」、用語(terms)は「バーバル」配下に内包（独立メニューにはしない／ルートは生存）
function RashisaGroup({ pathname }: { pathname: string }) {
  // 「見え方・聞こえ方」は展開式。子ルート（visuals/verbal）にいるときは初期展開
  const [open, setOpen] = useState(
    pathname.startsWith('/portal/visuals') || pathname.startsWith('/portal/verbal')
  )
  return (
    <SidebarGroup>
      <SidebarGroupLabel>私たちの「らしさ」</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {/* 1. 考え方（バリューを内包） */}
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith('/portal/guidelines')}>
              <Link href="/portal/guidelines">
                <Compass size={18} />
                <span>考え方</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* 2. 感じられ方（ブランドパーソナリティ：人格・トーンオブボイス） */}
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith('/portal/personality')}>
              <Link href="/portal/personality">
                <Smile size={18} />
                <span>感じられ方</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* 3. 見え方・聞こえ方（展開式：ビジュアル／バーバル） */}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setOpen((v) => !v)}
              isActive={pathname.startsWith('/portal/visuals') || pathname.startsWith('/portal/verbal')}
            >
              <Eye size={18} />
              <span>見え方・聞こえ方</span>
              <ChevronRight size={16} className={`ml-auto transition-transform ${open ? 'rotate-90' : ''}`} />
            </SidebarMenuButton>
            {open && (
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild isActive={pathname.startsWith('/portal/visuals')}>
                    <Link href="/portal/visuals">
                      <Palette size={16} />
                      <span>ビジュアル</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  {/* 用語(terms)はバーバル配下に内包 */}
                  <SidebarMenuSubButton asChild isActive={pathname.startsWith('/portal/verbal')}>
                    <Link href="/portal/verbal">
                      <MessageSquare size={16} />
                      <span>バーバル</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            )}
          </SidebarMenuItem>

          {/* 4. 接し方（ブランド戦略） */}
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith('/portal/strategy')}>
              <Link href="/portal/strategy">
                <Target size={18} />
                <span>接し方</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function PortalSidebar() {
  const pathname = usePathname()
  const { member, companyName, companyLogoUrl, company, slogan, profileName, profilePhotoUrl, profileSlug, isAdmin, signOut } = usePortalAuth()
  const [cardPreviewOpen, setCardPreviewOpen] = useState(false)

  // 機能トグル: 無効な機能のメニュー項目を非表示にする
  const timelineEnabled = isFeatureEnabled(company, 'timeline_enabled')
  const kpiEnabled = isFeatureEnabled(company, 'kpi_enabled')
  const cardEnabled = isFeatureEnabled(company, 'card_enabled')
  const visibleEngagementItems = engagementItems.filter((item) => {
    if (item.href === '/portal/timeline') return timelineEnabled
    if (item.href === '/portal/kpi') return kpiEnabled
    return true
  })

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
                  {/* ロゴ未登録時はアイコン枠を表示しない（フォールバックの頭文字も出さない） */}
                  {companyLogoUrl && (
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground overflow-hidden">
                      <img src={companyLogoUrl} alt={companyName || ''} className="size-full object-cover" />
                    </div>
                  )}
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
                {visibleEngagementItems.map((item) => {
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
          <RashisaGroup pathname={pathname} />

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
                  {cardEnabled && (
                    <DropdownMenuItem onClick={() => setCardPreviewOpen(true)} className="h-10 px-3 gap-2 text-base font-medium rounded-md">
                      <CreditCard className="size-4" />
                      名刺プレビュー
                    </DropdownMenuItem>
                  )}
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
