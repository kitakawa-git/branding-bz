'use client'

// 名刺ページ: ブランドセクション（MVV + ページ閲覧行動トラッキング）
// BrandMvvAccordion の開閉状態を BrandPageViewTracker に連携するクライアントラッパー
import { useState, useCallback } from 'react'
import { BrandMvvAccordion } from './BrandMvvAccordion'
import { BrandPageViewTracker } from './BrandPageViewTracker'

interface ValueItem {
  name: string
  description?: string
}

interface CardBrandSectionProps {
  vision: string
  values: ValueItem[]
  profileId: string
  companyId: string
  secondaryFontFamily: string
  hasVision: boolean
  hasValues: boolean
}

export function CardBrandSection({
  vision,
  values,
  profileId,
  companyId,
  secondaryFontFamily,
  hasVision,
  hasValues,
}: CardBrandSectionProps) {
  // アコーディオンが一度でも開かれたかを追跡
  const [mvvOpened, setMvvOpened] = useState(false)

  const handleOpenChange = useCallback((opened: boolean) => {
    if (opened) setMvvOpened(true)
  }, [])

  return (
    <>
      {/* アコーディオン */}
      <BrandMvvAccordion
        vision={vision}
        values={values}
        profileId={profileId}
        companyId={companyId}
        secondaryFontFamily={secondaryFontFamily}
        onOpenChange={handleOpenChange}
      />

      {/* ページ離脱時の閲覧行動記録 */}
      <BrandPageViewTracker
        companyId={companyId}
        sourceProfileId={profileId}
        mvvOpened={mvvOpened}
        hasVision={hasVision}
        hasValues={hasValues}
      />
    </>
  )
}
