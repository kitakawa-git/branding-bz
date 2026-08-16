'use client'

// ポータルレイアウト: floating サイドバー + コンテンツ
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AppAuthProvider } from '@/components/providers/AppAuthProvider'
import { PortalDataProvider, usePortalData } from './components/PortalDataProvider'
import { PortalDynamicTitle } from './components/PortalDynamicTitle'
import { PortalSidebar } from './components/PortalSidebar'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { resolvePortalCrumb } from '@/lib/portal-breadcrumb'
import {
  PortalHeaderSearch,
  PortalSearchProvider,
} from '@/components/portal/portal-search'
import { RashisaCardVisibilityProvider } from '@/components/portal/rashisa-card-visibility'
import { Bell } from 'lucide-react'

// 認証不要のパス
const publicPaths = ['/portal/login', '/portal/register', '/portal/auth']

function PortalLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, companyId } = usePortalData()
  const [unreadCount, setUnreadCount] = useState(0)
  const isPublic = publicPaths.some(p => pathname.startsWith(p))
  const crumb = resolvePortalCrumb(pathname)

  useEffect(() => {
    if (!companyId || !user?.id) return
    const fetchUnread = async () => {
      try {
        const [publishedRes, readsRes] = await Promise.all([
          supabase.from('announcements').select('id').eq('company_id', companyId).eq('is_published', true),
          supabase.from('announcement_reads').select('announcement_id').eq('user_id', user.id).eq('company_id', companyId),
        ])
        const published = publishedRes.data || []
        const readIds = new Set((readsRes.data || []).map(r => r.announcement_id))
        setUnreadCount(published.filter(a => !readIds.has(a.id)).length)
      } catch {
        // ヘッダーのバッジなのでエラーは無視
      }
    }
    fetchUnread()
  }, [companyId, user?.id])

  if (isPublic) {
    return <>{children}</>
  }

  return (
    <div data-portal="">
      <PortalDynamicTitle />
      <SidebarProvider
        style={{ '--sidebar-width': '19rem' } as React.CSSProperties}
      >
        <PortalSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 px-4 bg-background/80 backdrop-blur-sm">
            <SidebarTrigger className="-ml-1 size-11 [&_svg]:size-6" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            {crumb && (
              <Breadcrumb>
                <BreadcrumbList>
                  {crumb.section && (
                    <>
                      <BreadcrumbItem>
                        <span className="text-muted-foreground">{crumb.section}</span>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                    </>
                  )}
                  {/* 詳細ページの親。一覧へ戻る導線なので押せるようにする */}
                  {crumb.parent && (
                    <>
                      <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                          <Link
                            href={crumb.parent.href}
                            className="text-muted-foreground no-underline hover:text-foreground"
                          >
                            {crumb.parent.label}
                          </Link>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                    </>
                  )}
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-base font-bold">
                      {crumb.perspective ? (
                        <span className="flex items-baseline gap-1.5">
                          <span>{crumb.perspective}</span>
                          <span className="text-sm font-normal text-muted-foreground">｜{crumb.title}</span>
                        </span>
                      ) : (
                        crumb.title
                      )}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            )}
            {/* 右端に検索（虫眼鏡）とお知らせベル。
                検索はページが登録したときだけ出る（portal-search 参照） */}
            <div className="ml-auto flex items-center gap-1">
              <PortalHeaderSearch />
              <Link
                href="/portal/announcements"
                className="relative inline-flex items-center justify-center size-11 rounded-md hover:bg-muted transition-colors no-underline"
              >
                <Bell size={24} className={pathname.startsWith('/portal/announcements') ? 'text-foreground' : 'text-muted-foreground'} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </Link>
            </div>
          </header>
          <div className="flex flex-1 flex-col">
            <main className="flex-1">{children}</main>
            <footer className="px-6 py-4 text-center">
              <Separator className="mb-4" />
              <p className="text-xs text-muted-foreground m-0">
                Powered by branding.bz
              </p>
            </footer>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}

export default function PortalLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <AppAuthProvider redirectOnSignOutTo="/portal/auth">
      <PortalDataProvider>
        <PortalSearchProvider>
          {/* サイドバーのスイッチとダッシュボードのカードを繋ぐ。
              両方を含むこの層に置く */}
          <RashisaCardVisibilityProvider>
            <PortalLayoutInner>
              {children}
            </PortalLayoutInner>
          </RashisaCardVisibilityProvider>
        </PortalSearchProvider>
      </PortalDataProvider>
    </AppAuthProvider>
  )
}
