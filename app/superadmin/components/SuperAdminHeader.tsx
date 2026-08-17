'use client'

// スーパー管理画面ヘッダー（SidebarTrigger + パンくず + スーパー管理バッジ）
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
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
import { resolveSuperAdminCrumb } from '@/lib/superadmin-breadcrumb'

/** 一度引いたブランド名は覚えておく。行き来のたびに問い合わせない */
const nameCache = new Map<string, string>()

export function SuperAdminHeader() {
  const pathname = usePathname()
  const crumb = resolveSuperAdminCrumb(pathname)

  // ブランド詳細だけは「詳細：◯◯」と名前まで出す。
  // どのブランドを開いているかはページ内の見出しでしか分からず、
  // タブを何枚も開くと見分けが付かないため
  const brandId = pathname.match(/^\/superadmin\/companies\/([^/]+)$/)?.[1] ?? null
  const [brandName, setBrandName] = useState<string | null>(
    brandId ? nameCache.get(brandId) ?? null : null,
  )

  useEffect(() => {
    if (!brandId) {
      setBrandName(null)
      return
    }
    const cached = nameCache.get(brandId)
    if (cached) {
      setBrandName(cached)
      return
    }
    let cancelled = false
    supabase
      .from('companies')
      .select('name')
      .eq('id', brandId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data?.name) return
        nameCache.set(brandId, data.name)
        setBrandName(data.name)
      })
    return () => {
      cancelled = true
    }
  }, [brandId])

  // 名前が届くまでは「詳細」だけ出す（あとから「詳細：◯◯」に伸びる）
  const title = brandId && brandName ? `詳細：${brandName}` : crumb?.title

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
                  {/* 親セクションは一覧へ戻る導線。薄字のまま押せるようにする */}
                  <BreadcrumbLink asChild>
                    <Link
                      href={crumb.section.href}
                      className="text-muted-foreground no-underline hover:text-foreground"
                    >
                      {crumb.section.label}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            )}
            <BreadcrumbItem>
              <BreadcrumbPage className="text-base font-bold">
                {title}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      )}
    </header>
  )
}
