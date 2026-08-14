'use client'

// 管理画面ヘッダー（SidebarTrigger + パンくずリスト）
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { resolveAdminCrumb } from '@/lib/admin-breadcrumb'
import { useAuth } from './AdminDataProvider'
import { PlanExpiryNotice } from '@/components/billing/plan-expiry-notice'

export function AdminHeader() {
  const pathname = usePathname()
  const { company } = useAuth()
  const crumb = resolveAdminCrumb(pathname)

  return (
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
                  {crumb.sectionHref ? (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.sectionHref} className="text-muted-foreground">
                        {crumb.section}
                      </Link>
                    </BreadcrumbLink>
                  ) : (
                    <span className="text-muted-foreground">{crumb.section}</span>
                  )}
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            )}
            <BreadcrumbItem>
              {/* 一覧の名前をそのまま出しているサブページでは、
                  タイトル側が一覧への戻り導線になる */}
              {crumb.titleHref ? (
                <BreadcrumbLink asChild>
                  <Link href={crumb.titleHref} className="text-base font-bold">
                    {crumb.title}
                  </Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="text-base font-bold">
                  {crumb.title}
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      )}

      {/* 期限が近い／切れているときだけ出る控えめな表示。
          Early Access は plan='premium' + 90日後の期限で運用するので、
          これがそのまま終了予告を兼ねる（専用の分岐は作らない） */}
      <div className="ml-auto">
        <PlanExpiryNotice company={company} />
      </div>
    </header>
  )
}
