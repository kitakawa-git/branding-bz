'use client'

// ポータル用サイドバー（floating + 明るい配色）
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePortalAuth } from './PortalDataProvider'
import { isFeatureEnabled } from '@/lib/constants/feature-toggles'
import { isPortalPageVisibleForRole, isStaffRole, memberRoleLabel } from '@/lib/constants/member-roles'
import { PlanLockBadge, PlanUpsell } from '@/components/billing/plan-gate'
import { can, type FeatureKey } from '@/lib/billing/entitlements'
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
  useSidebar,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useOnboarding } from '@/components/onboarding/use-onboarding'
import { SetupSupportBanner } from '@/components/onboarding/SetupSupportBanner'
import {
  Compass,
  Target,
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
  GraduationCap,
  Users,
  ClipboardList,
  Globe,
  type LucideIcon,
} from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  /** プラン外なら 🔒＋「◯◯から」バッジを出す（隠さずグレーで見せる） */
  feature?: FeatureKey
  /** 機能トグル（companies の *_enabled 列）。off なら項目ごと消す */
  toggleKey?: string
  /** 区分ごとの表示設定（GATEABLE_PORTAL_PAGES の key） */
  roleKey?: string
}

// 浸透グループ
const engagementItems: NavItem[] = [
  { href: '/portal', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/portal/timeline', label: 'Good Action投稿', icon: MessageSquareHeart, feature: 'timeline', toggleKey: 'timeline_enabled', roleKey: 'timeline' },
  { href: '/portal/kpi', label: '目標・KPI', icon: Milestone, feature: 'kpi', toggleKey: 'kpi_enabled', roleKey: 'kpi' },
  { href: '/portal/learning', label: 'ラーニング', icon: GraduationCap, feature: 'videoLearning', toggleKey: 'learning_enabled', roleKey: 'learning' },
  { href: '/portal/survey', label: 'サーベイ結果', icon: ClipboardList, feature: 'innerSurvey', toggleKey: 'survey_enabled', roleKey: 'survey' },
  { href: '/portal/market-survey', label: '市場調査', icon: Globe, feature: 'brandScoreFull', toggleKey: 'market_survey_enabled', roleKey: 'market_survey' },
]

// 「私たちの『らしさ』」グループ（内部→外部の視点ワード構成）
// バリュー(values)は「考え方」、用語(terms)は「バーバル」配下に内包（独立メニューにはしない／ルートは生存）
function RashisaGroup({ pathname, onNavClick }: { pathname: string; onNavClick: () => void }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>私たちの「らしさ」</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {/* 1. 考え方（バリューを内包） */}
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith('/portal/guidelines')}>
              <Link href="/portal/guidelines" onClick={onNavClick}>
                <Compass size={18} />
                <span>考え方</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* 2. 感じられ方（ブランドパーソナリティ：人格・トーンオブボイス） */}
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith('/portal/personality')}>
              <Link href="/portal/personality" onClick={onNavClick}>
                <Smile size={18} />
                <span>感じられ方</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* 3. 見え方・聞こえ方（ビジュアル/バーバルはページ上部のタブで切替。サブメニューは持たない） */}
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith('/portal/visuals') || pathname.startsWith('/portal/verbal')}>
              <Link href="/portal/visuals" onClick={onNavClick}>
                <Eye size={18} />
                <span>見え方・聞こえ方</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* 4. 接し方（ブランド戦略） */}
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith('/portal/strategy')}>
              <Link href="/portal/strategy" onClick={onNavClick}>
                <Target size={18} />
                <span>接し方</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* 5. 私たちについて（会社/ブランド基本情報） */}
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith('/portal/about')}>
              <Link href="/portal/about" onClick={onNavClick}>
                <Users size={18} />
                <span>私たちについて</span>
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
  const { member, companyName, companyLogoUrl, company, slogan, profileName, profilePhotoUrl, profileSlug, roleCategory, isAdmin, signOut } = usePortalAuth()
  const [cardPreviewOpen, setCardPreviewOpen] = useState(false)
  const [cardLockedOpen, setCardLockedOpen] = useState(false)
  // スマホ時は項目タップでサイドバー（モバイルシート）を閉じる
  const { isMobile, setOpenMobile } = useSidebar()
  const handleNavClick = () => { if (isMobile) setOpenMobile(false) }

  // 機能トグル: 無効な機能のメニュー項目を非表示にする
  const cardEnabled = isFeatureEnabled(company, 'card_enabled')

  // セットアップ中の管理者にだけ入力サポートの案内を出す。
  // hidden は「管理者でない・全ステップ完了」を含むので、これだけで条件を満たす。
  // dismissed は見ない＝ポータルの「あとで」で消す対象ではない
  const onboarding = useOnboarding(company)
  const setupOpen = !onboarding.loading && !onboarding.hidden
  const showSupportBanner = setupOpen
  // セットアップ中は管理画面の先頭タブが「セットアップの進捗」になる。
  // /admin は無条件に /admin/brand-score へ飛ばすので、ここで直接そのタブへ送る
  // （管理画面のサイドバー・タブは既に同じ出し分けをしている）
  const adminHref = setupOpen ? '/admin/setup' : '/admin'
  // 会社の機能トグルと、区分ごとの表示設定（管理画面「設定」）の AND。
  // href の直書き分岐だと項目が増えるたびに書き足す必要があるので、項目側に持たせる
  const visibleEngagementItems = engagementItems.filter(
    (item) =>
      // プラン外は一般メンバーには出さない。契約を変えられない人に
      // 使えない項目を見せても迷わせるだけ。管理者にはロック付きで見せ、
      // 「上げれば使える」ことが分かるようにする（管理画面と同じ扱い）
      (!item.feature || isAdmin || can(company, item.feature)) &&
      (!item.toggleKey || isFeatureEnabled(company, item.toggleKey)) &&
      (!item.roleKey || isPortalPageVisibleForRole(company, item.roleKey, roleCategory, isAdmin)),
  )

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
                <Link href="/portal/about" onClick={handleNavClick}>
                  {/* ロゴ未登録時はアイコン枠を表示しない（フォールバックの頭文字も出さない） */}
                  {companyLogoUrl && (
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground overflow-hidden">
                      <img src={companyLogoUrl} alt={companyName || ''} className="size-full object-cover" />
                    </div>
                  )}
                  {/* 従業員はスローガン、それ以外は区分ラベル（経営層/管理職を明示する目的） */}
                  {(() => {
                    const subText = isStaffRole(roleCategory) ? slogan : memberRoleLabel(roleCategory)
                    return (
                      <div className={`flex flex-col leading-none ${subText ? 'gap-0.5' : 'justify-center'}`}>
                        <span className="font-semibold">{companyName || 'branding.bz'}</span>
                        {subText && <span className="text-xs text-sidebar-foreground/70">{subText}</span>}
                      </div>
                    )
                  })()}
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
                        <Link href={item.href} onClick={handleNavClick}>
                          <Icon size={18} />
                          <span>{item.label}</span>
                          {item.feature && <PlanLockBadge company={company} feature={item.feature} tone="light" />}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <RashisaGroup pathname={pathname} onNavClick={handleNavClick} />

        </SidebarContent>

        {/* セットアップ中の管理者にだけ、入力サポートの案内を出す。
            折りたたみ（アイコンのみ）では幅が足りず崩れるので出さない */}
        {showSupportBanner && (
          <div className="px-2 pb-1 group-data-[collapsible=icon]:hidden">
            <SetupSupportBanner variant="sidebar" />
          </div>
        )}

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
                  <DropdownMenuItem asChild className="h-11 px-3 gap-2 text-base font-medium rounded-md">
                    <Link href="/portal/profile" className="no-underline" onClick={handleNavClick}>
                      <CircleUser className="size-4" />
                      マイプロフィール
                    </Link>
                  </DropdownMenuItem>
                  {cardEnabled && (
                    <DropdownMenuItem
                      // プラン外ならプレビューは出さず、使えない旨の面を出す。
                      // 項目ごと消さないのは「隠さずグレーで見せる」方針に合わせるため
                      onClick={() => {
                        handleNavClick()
                        if (can(company, 'smartCard')) setCardPreviewOpen(true)
                        else setCardLockedOpen(true)
                      }}
                      className="h-11 px-3 gap-2 text-base font-medium rounded-md"
                    >
                      <CreditCard className="size-4" />
                      名刺プレビュー
                      {/* スマート名刺は Standard 以上。明るい面なので tone は light */}
                      <PlanLockBadge company={company} feature="smartCard" tone="light" />
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem asChild className="h-11 px-3 gap-2 text-base font-medium rounded-md">
                      <Link href={adminHref} className="no-underline" onClick={handleNavClick}>
                        <ArrowLeftRight className="size-4" />
                        管理画面
                      </Link>
                    </DropdownMenuItem>
                  )}
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

      {/* プラン外のときの面。アップセルの体裁は他の画面と共通のものを使う */}
      <Dialog open={cardLockedOpen} onOpenChange={setCardLockedOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-none bg-transparent p-0 shadow-none sm:max-w-md">
          <DialogTitle className="sr-only">スマート名刺を使うには</DialogTitle>
          <PlanUpsell
            company={company}
            feature="smartCard"
            title="スマート名刺を使うには"
            benefits={[
              'QRコードから社員プロフィール＋ブランドページを表示',
              '閲覧数・アウタースコアで効果を測定',
              '閲覧者からの印象タグ（マイクロフィードバック）を収集',
            ]}
            readOnly={!isAdmin}
          />
        </DialogContent>
      </Dialog>

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
