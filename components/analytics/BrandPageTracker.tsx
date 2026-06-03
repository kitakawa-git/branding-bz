'use client'

// ブランド掲示ページの閲覧行動トラッキング
// マウント時に計測開始、ページ離脱時に trackBrandPageView() を1回だけ送信
import { useEffect, useRef } from 'react'
import { trackBrandPageView } from '@/lib/analytics/track'

type PageType = 'guidelines' | 'strategy' | 'visuals' | 'verbal' | 'personality'

export function BrandPageTracker({
  companyId,
  pageType,
  sourceProfileId,
}: {
  companyId: string
  pageType: PageType
  sourceProfileId?: string
}) {
  // 開始時刻
  const startTimeRef = useRef<number>(0)
  // スクロール深度（0-100）
  const maxScrollDepthRef = useRef<number>(0)
  // Intersection Observerで検出したセクション名
  const sectionsViewedRef = useRef<Set<string>>(new Set())
  // 送信済みフラグ（二重送信防止）
  const sentRef = useRef<boolean>(false)

  useEffect(() => {
    if (!companyId) return

    // 開始時刻をリセット（コンポーネント再マウント対応）
    startTimeRef.current = Date.now()
    sentRef.current = false

    // --- スクロール深度計測 ---
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight
      if (docHeight > 0) {
        const depth = Math.round((scrollTop / docHeight) * 100)
        if (depth > maxScrollDepthRef.current) {
          maxScrollDepthRef.current = depth
        }
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })

    // --- Intersection Observer でセクション表示検出 ---
    let observer: IntersectionObserver | null = null
    const sectionElements = document.querySelectorAll('[data-section]')
    if (sectionElements.length > 0) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const sectionName = (entry.target as HTMLElement).dataset.section
              if (sectionName) {
                sectionsViewedRef.current.add(sectionName)
              }
            }
          })
        },
        { threshold: 0.3 }
      )
      sectionElements.forEach((el) => observer!.observe(el))
    }

    // --- ページ離脱時に送信 ---
    const sendTracking = () => {
      if (sentRef.current) return
      sentRef.current = true

      const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000)
      trackBrandPageView({
        companyId,
        sourceProfileId,
        pageType,
        sectionsViewed: Array.from(sectionsViewedRef.current),
        scrollDepth: maxScrollDepthRef.current,
        durationSeconds,
      })
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        sendTracking()
      }
    }

    const handleBeforeUnload = () => {
      sendTracking()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (observer) {
        observer.disconnect()
      }
      // アンマウント時にも送信（SPA内遷移対応）
      sendTracking()
    }
  }, [companyId, pageType, sourceProfileId])

  return null
}
