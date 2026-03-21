'use client'

// 名刺ページ: 「もっとみる」で展開するビジョン・バリュー + トラッキング
import { useState, useRef, useCallback } from 'react'
import { trackCardEvent } from '@/lib/analytics/track'
import { ChevronDown } from 'lucide-react'

interface ValueItem {
  name: string
  description?: string
}

interface BrandMvvAccordionProps {
  vision: string
  values: ValueItem[]
  profileId: string
  companyId: string
  secondaryFontFamily: string
  /** 開閉状態が変わった時のコールバック（trueで開いた） */
  onOpenChange?: (opened: boolean) => void
}

export function BrandMvvAccordion({
  vision,
  values,
  profileId,
  companyId,
  secondaryFontFamily,
  onOpenChange,
}: BrandMvvAccordionProps) {
  const [open, setOpen] = useState(false)
  const trackedRef = useRef(false)

  const handleToggle = useCallback(() => {
    const next = !open
    setOpen(next)
    onOpenChange?.(next)

    // 開いた時だけトラッキング（1回のみ）
    if (next && !trackedRef.current) {
      trackedRef.current = true
      if (vision.trim()) {
        trackCardEvent({
          profileId,
          companyId,
          eventType: 'brand_page_click',
          eventData: { section: 'vision' },
        })
      }
      if (values.length > 0) {
        trackCardEvent({
          profileId,
          companyId,
          eventType: 'brand_page_click',
          eventData: { section: 'values' },
        })
      }
    }
  }, [open, profileId, companyId, vision, values, onOpenChange])

  const hasVision = vision.trim().length > 0
  const hasValues = values.length > 0

  if (!hasVision && !hasValues) return null

  return (
    <div className="mt-3">
      {/* トリガー */}
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground/70 transition-colors cursor-pointer bg-transparent border-0 p-0 m-0"
      >
        {open ? 'とじる' : 'もっとみる'}
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* コンテンツ */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: open ? '600px' : '0px',
          opacity: open ? 1 : 0,
        }}
      >
        <div className="pt-3 space-y-4">
          {/* ビジョン */}
          {hasVision && (
            <div>
              <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
                Vision
              </span>
              <p
                className="text-[13px] text-foreground/70 leading-[1.8] whitespace-pre-line m-0 mt-1"
                style={{ fontFamily: secondaryFontFamily }}
              >
                {vision}
              </p>
            </div>
          )}

          {/* バリュー */}
          {hasValues && (
            <div>
              <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
                Values
              </span>
              <ul className="space-y-2 m-0 mt-1 p-0 list-none">
                {values.map((v, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="text-xs font-mono text-muted-foreground tabular-nums pt-0.5 shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span
                        className="text-[13px] font-semibold text-foreground/80"
                        style={{ fontFamily: secondaryFontFamily }}
                      >
                        {v.name}
                      </span>
                      {v.description && (
                        <p
                          className="text-xs text-muted-foreground leading-relaxed mt-0.5 m-0"
                          style={{ fontFamily: secondaryFontFamily }}
                        >
                          {v.description}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
