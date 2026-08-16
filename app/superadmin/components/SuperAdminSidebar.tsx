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
  SidebarGroupLabel,
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
  CreditCard,
  Headset,
  ArrowLeftRight,
  LogOut,
  CircleUser,
  ChevronsUpDown,
  type LucideIcon,
} from 'lucide-react'

type NavItem = { href: string; label: string; icon: LucideIcon }

// 契約中の企業に対して動くもの。待たせている件数のバッジが付くのもこちら
const navItems: NavItem[] = [
  { href: '/superadmin/companies', label: '企業一覧', icon: Building2 },
  { href: '/superadmin/plan-requests', label: 'プラン変更の依頼', icon: CreditCard },
  { href: '/superadmin/support-requests', label: '入力サポートの相談', icon: Headset },
]

// 特定の企業に紐づかない、サイト全体の運営まわり
const siteItems: NavItem[] = [
  { href: '/superadmin/news', label: 'ニュース', icon: Newspaper },
  { href: '/superadmin/inquiries', label: 'お問い合わせ', icon: MessageSquare },
  { href: '/superadmin/design-system', label: 'デザインシステム', icon: Palette },
]

// 承認待ち件数が変わったとき、承認ページからこのイベントで即時反映させる
export const SIGNUP_REQUESTS_CHANGED = 'signup-requests-changed'
export const PLAN_REQUESTS_CHANGED = 'plan-requests-changed'
export const SUPPORT_REQUESTS_CHANGED = 'support-requests-changed'

export function SuperAdminSidebar() {
  const pathname = usePathname()
  const { user, profileName, profilePhotoUrl, signOut } = useAdminData()
  // 承認待ちの新規登録件数（サイドバーの「新規登録の承認」にバッジ表示）
  const [pendingCount, setPendingCount] = useState(0)
  // 未対応のプラン変更依頼件数
  const [planRequestCount, setPlanRequestCount] = useState(0)
  // 未対応の入力サポート相談件数
  const [supportRequestCount, setSupportRequestCount] = useState(0)

  const loadPendingCount = useCallback(async () => {
    const { count } = await supabase
      .from('companies')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'pending')
    setPendingCount(count ?? 0)
  }, [])

  // 依頼系のテーブルは RLS で自社ぶんしか読めない。superadmin でも
  // クライアントから直接引くと0件が返るので、service_role の API を通す
  const loadRequestCount = useCallback(
    async (path: string, setCount: (n: number) => void) => {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) return
      try {
        const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) return
        const data = await res.json()
        setCount((data.requests || []).length)
      } catch {
        // バッジが出ないだけなので握りつぶす
      }
    },
    [],
  )

  const loadPlanRequestCount = useCallback(
    () => loadRequestCount('/api/superadmin/plan-change-requests', setPlanRequestCount),
    [loadRequestCount],
  )
  const loadSupportRequestCount = useCallback(
    () => loadRequestCount('/api/superadmin/setup-support-requests', setSupportRequestCount),
    [loadRequestCount],
  )

  // 初回・ページ遷移時に再取得。承認/却下の直後はカスタムイベントで即時反映。
  useEffect(() => {
    loadPendingCount()
    loadPlanRequestCount()
    loadSupportRequestCount()
    const onSignup = () => loadPendingCount()
    const onPlan = () => loadPlanRequestCount()
    const onSupport = () => loadSupportRequestCount()
    window.addEventListener(SIGNUP_REQUESTS_CHANGED, onSignup)
    window.addEventListener(PLAN_REQUESTS_CHANGED, onPlan)
    window.addEventListener(SUPPORT_REQUESTS_CHANGED, onSupport)
    return () => {
      window.removeEventListener(SIGNUP_REQUESTS_CHANGED, onSignup)
      window.removeEventListener(PLAN_REQUESTS_CHANGED, onPlan)
      window.removeEventListener(SUPPORT_REQUESTS_CHANGED, onSupport)
    }
  }, [loadPendingCount, loadPlanRequestCount, loadSupportRequestCount, pathname])

  // 「まだ返していない件数」を持つ項目だけをここに並べる
  const badgeCounts: Record<string, number> = {
    // 承認キューは企業一覧の上のアコーディオンに移したので、バッジもそちらに付ける
    '/superadmin/companies': pendingCount,
    '/superadmin/plan-requests': planRequestCount,
    '/superadmin/support-requests': supportRequestCount,
  }

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
                {/* branding.bz の bz マーク（画像アセット: public/logo-mark.png） */}
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg border border-gray-700 overflow-hidden">
                  <img src="/logo-mark.png" alt="" aria-hidden="true" className="size-full object-cover" />
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
                // 待たせている件数がある項目だけ通知バッジを出す
                const count = badgeCounts[item.href] ?? 0
                const badge = count > 0 ? count : null
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
                        aria-label={`未対応 ${badge}件`}
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

        {/* サイト管理: 特定の企業に紐づかないもの。バッジは付かない */}
        <SidebarGroup>
          <SidebarGroupLabel>サイト管理</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {siteItems.map((item) => {
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
