'use client'

import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PersonaCarouselProps {
  children: ReactNode[]
}

export function PersonaCarousel({ children }: PersonaCarouselProps) {
  const items = Array.isArray(children) ? children : [children]
  const count = items.length
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  // 現在カードの幅 + gap を取得
  const getStep = useCallback((): number => {
    const scroller = scrollerRef.current
    if (!scroller) return 0
    const firstCard = scroller.querySelector<HTMLElement>(':scope > *')
    if (!firstCard) return 0
    const gap = parseFloat(getComputedStyle(scroller).gap) || 12
    return firstCard.offsetWidth + gap
  }, [])

  // スクロール位置から現在indexを更新
  const updateActive = useCallback(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const step = getStep()
    if (step === 0) return
    const idx = Math.round(scroller.scrollLeft / step)
    setActiveIdx(Math.max(0, Math.min(count - 1, idx)))
  }, [count, getStep])

  // 指定indexまでスクロール
  const goTo = useCallback((idx: number) => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const step = getStep()
    const target = Math.max(0, Math.min(count - 1, idx))
    scroller.scrollTo({ left: step * target, behavior: 'smooth' })
  }, [count, getStep])

  // スクロールイベント（debounce）
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const onScroll = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(updateActive, 80)
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      if (timer) clearTimeout(timer)
    }
  }, [updateActive])

  // キーボード操作（コンテナフォーカス時）
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(activeIdx - 1) }
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(activeIdx + 1) }
  }, [activeIdx, goTo])

  if (count === 0) return null

  // ペルソナ1人なら静的表示
  if (count === 1) {
    return <div>{items[0]}</div>
  }

  return (
    <div
      className="relative"
      role="region"
      aria-roledescription="carousel"
      aria-label="ペルソナ"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* ヘッダー：インデックス + 前後ボタン */}
      <div className="flex items-center justify-end gap-2 mb-3 -mt-1">
        <span className="text-xs text-muted-foreground font-semibold mr-1">
          {activeIdx + 1} / {count}
        </span>
        <button
          type="button"
          onClick={() => goTo(activeIdx - 1)}
          disabled={activeIdx === 0}
          aria-label="前のペルソナ"
          className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-border bg-card hover:bg-soft disabled:opacity-35 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => goTo(activeIdx + 1)}
          disabled={activeIdx === count - 1}
          aria-label="次のペルソナ"
          className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-border bg-card hover:bg-soft disabled:opacity-35 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* スクローラー */}
      <div
        ref={scrollerRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 -mx-1 px-1"
        style={{ scrollbarWidth: 'thin' }}
      >
        {items.map((item, i) => (
          <div
            key={i}
            className="flex-none snap-start w-[calc(85%-7.2px)] sm:w-[calc(40%-7.2px)]"
          >
            {item}
          </div>
        ))}
      </div>

      {/* ドットインジケーター */}
      <div className="flex justify-center gap-2 mt-3">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`ペルソナ ${i + 1} を表示`}
            aria-current={i === activeIdx ? 'true' : undefined}
            className={`h-2 rounded-full transition-all ${
              i === activeIdx
                ? 'w-6 bg-ds-app-accent'
                : 'w-2 bg-border hover:bg-muted-foreground'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
