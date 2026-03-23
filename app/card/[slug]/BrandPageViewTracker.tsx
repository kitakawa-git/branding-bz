'use client'

// 名刺ページ: ページ離脱時にブランドページ閲覧行動を brand_page_views に記録
// - scroll_depth: 最大スクロール深度（0-100）
// - duration_seconds: 滞在秒数（最大3600秒でキャップ）
// - sections_viewed: アコーディオンが開かれたセクション
// 送信: navigator.sendBeacon（離脱時の送信保証）
import { useEffect, useRef, useCallback } from 'react'
import { sendBrandPageViewBeacon } from '@/lib/analytics/track'

interface BrandPageViewTrackerProps {
  companyId: string
  sourceProfileId: string
  /** アコーディオンが開かれたかどうか（親から受け取る） */
  mvvOpened: boolean
  hasVision: boolean
  hasValues: boolean
}

// 滞在時間の上限（秒）
const MAX_DURATION_SECONDS = 3600

export function BrandPageViewTracker({
  companyId,
  sourceProfileId,
  mvvOpened,
  hasVision,
  hasValues,
}: BrandPageViewTrackerProps) {
  const hasSentRef = useRef(false)
  const startTimeRef = useRef(0)
  const maxScrollDepthRef = useRef(0)

  // スクロール深度の追跡
  useEffect(() => {
    startTimeRef.current = Date.now()
    const handleScroll = () => {
      const scrollDepth = Math.round(
        ((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100
      )
      if (scrollDepth > maxScrollDepthRef.current) {
        maxScrollDepthRef.current = Math.min(scrollDepth, 100)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    // 初回計算（スクロールしなくても画面内に収まるケース）
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // 送信処理
  const sendData = useCallback(() => {
    if (hasSentRef.current) return
    hasSentRef.current = true

    const durationSeconds = Math.min(
      Math.round((Date.now() - startTimeRef.current) / 1000),
      MAX_DURATION_SECONDS
    )

    // sections_viewed: アコーディオンが開かれた場合のみセクション名を含める
    const sectionsViewed: string[] = []
    if (mvvOpened) {
      if (hasVision) sectionsViewed.push('vision')
      if (hasValues) sectionsViewed.push('values')
    }

    sendBrandPageViewBeacon({
      companyId,
      sourceProfileId,
      pageType: 'guidelines',
      sectionsViewed,
      scrollDepth: maxScrollDepthRef.current,
      durationSeconds,
    })
  }, [companyId, sourceProfileId, mvvOpened, hasVision, hasValues])

  // 離脱イベントのリスナー登録
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        sendData()
      }
    }

    const handleBeforeUnload = () => {
      sendData()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [sendData])

  // レンダリングなし
  return null
}
