'use client'

// スーパー管理画面ヘッダー（SidebarTrigger + パンくず + スーパー管理バッジ）
import { usePathname } from 'next/navigation'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { resolveSuperAdminCrumb } from '@/lib/superadmin-breadcrumb'

export function SuperAdminHeader() {
  const pathname = usePathname()
  const crumb = resolveSuperAdminCrumb(pathname)

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 px-4 bg-background/80 backdrop-blur-sm">
      {/* 通常管理画面(AdminHeader)・ポータルと同一指定に統一（タップ領域44px・アイコン24px） */}
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
            <BreadcrumbItem>
              <BreadcrumbPage className="text-base font-bold">
                {crumb.title}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      )}
    </header>
  )
}
