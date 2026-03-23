'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/supabase-fetch'
import { parseFontsFromDB, type BrandFonts, DEFAULT_FONT_ID } from '@/lib/brand-fonts'

const cache = new Map<string, BrandFonts>()

/** brand_visuals.fonts を取得・パースするフック */
export function useBrandFonts(companyId: string | null | undefined): BrandFonts | null {
  const [fonts, setFonts] = useState<BrandFonts | null>(() => {
    if (!companyId) return null
    return cache.get(companyId) ?? null
  })
  const [prevCompanyId, setPrevCompanyId] = useState(companyId)

  // companyId が変わった場合、キャッシュから同期的にセット（React推奨パターン）
  if (prevCompanyId !== companyId) {
    setPrevCompanyId(companyId)
    if (!companyId) {
      setFonts(null)
    } else if (cache.has(companyId)) {
      setFonts(cache.get(companyId)!)
    }
  }

  useEffect(() => {
    if (!companyId || cache.has(companyId)) return
    fetchWithRetry(() =>
      supabase
        .from('brand_visuals')
        .select('fonts')
        .eq('company_id', companyId)
        .single()
    ).then(({ data }) => {
      const parsed = parseFontsFromDB((data as Record<string, unknown> | null)?.fonts)
      cache.set(companyId, parsed)
      setFonts(parsed)
    })
  }, [companyId])

  return fonts
}
