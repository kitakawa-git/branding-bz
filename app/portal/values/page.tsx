'use client'

// 提供価値 閲覧ページ
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePortalAuth } from '../components/PortalAuthProvider'
import { getSubtitle } from '@/lib/portal-subtitles'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getPageCache, setPageCache } from '@/lib/page-cache'

type ValueItem = {
  title: string
  description: string | null
}

export default function PortalValuesPage() {
  const { companyId, portalSubtitles } = usePortalAuth()
  const cacheKey = `portal-values-${companyId}`
  const cached = companyId ? getPageCache<ValueItem[]>(cacheKey) : null
  const [values, setValues] = useState<ValueItem[]>(cached ?? [])
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<ValueItem[]>(cacheKey)) return

    supabase
      .from('brand_values')
      .select('*')
      .eq('company_id', companyId)
      .order('sort_order')
      .then(({ data }) => {
        if (data) {
          const parsed = data.map((d: Record<string, unknown>) => ({
            title: (d.title as string) || '',
            description: (d.description as string) || null,
          }))
          setValues(parsed)
          setPageCache(cacheKey, parsed)
        }
        setLoading(false)
      })
  }, [companyId, cacheKey])

  if (loading) return (
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-6 space-y-6">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-lg border border-border bg-background p-4 flex items-start gap-4">
              <Skeleton className="w-9 h-9 rounded-full shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-5 w-40 mb-2" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
  if (values.length === 0) return <div className="text-center py-16 text-muted-foreground text-[15px]">まだ登録されていません</div>

  return (
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">提供価値</h1>
        <p className="text-sm text-muted-foreground">
          {getSubtitle(portalSubtitles, 'values')}
        </p>
      </div>

      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5 space-y-3">
          {values.map((val, i) => (
            <div key={i} className="rounded-lg border border-border bg-background p-4 flex items-start gap-4">
              <div className="shrink-0 w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-base font-bold">
                {i + 1}
              </div>
              <div>
                <div className="text-base font-bold text-foreground mb-1">
                  {val.title}
                </div>
                {val.description && (
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    {val.description}
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
