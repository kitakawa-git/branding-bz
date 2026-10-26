'use client'

// PWA（standalone起動）専用のプル・トゥ・リフレッシュ。
// ブラウザのタブ内では標準の引っ張り更新があるので何もしない。
import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

const THRESHOLD = 64   // これ以上引いて離したら更新（px・減衰後の値）
const MAX_PULL = 96    // インジケーターの最大移動量
const DAMPING = 0.5    // 指の移動量に対する追従率

function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

// タッチ開始位置から上に辿って、スクロール途中の要素があれば引っ張り更新しない
function isInsideScrolledArea(target: EventTarget | null) {
  let el = target instanceof Element ? target : null
  while (el && el !== document.body) {
    if (el.closest('[data-no-ptr]')) return true
    const style = getComputedStyle(el)
    const scrollable = /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight
    if (scrollable && el.scrollTop > 0) return true
    el = el.parentElement
  }
  return false
}

export function PullToRefresh() {
  const [enabled, setEnabled] = useState(false)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  // 指で引いている最中か（その間はインジケーターを指に追従させ、離したら transition で戻す）
  const [dragging, setDragging] = useState(false)
  const startY = useRef<number | null>(null)
  const startX = useRef(0)
  const locked = useRef<'y' | 'x' | null>(null)
  const pullRef = useRef(0)

  // ハイドレーション後に判定（SSRでは常に無効）
  useEffect(() => {
    setEnabled(isStandalone() && 'ontouchstart' in window)
  }, [])

  useEffect(() => {
    if (!enabled) return

    const reset = () => {
      startY.current = null
      locked.current = null
      pullRef.current = 0
      setPull(0)
      setDragging(false)
    }

    const onStart = (e: TouchEvent) => {
      if (refreshing || e.touches.length !== 1) return
      if (window.scrollY > 0) return
      // ダイアログ・シート・ポップオーバーが開いている間は無効
      if (document.querySelector('[role="dialog"][data-state="open"], [data-radix-popper-content-wrapper]')) return
      // 入力中（キーボード表示中）は無効：reload で入力が消えるため
      const active = document.activeElement
      if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return
      if ((active as HTMLElement | null)?.isContentEditable) return
      if (isInsideScrolledArea(e.target)) return
      startY.current = e.touches[0].clientY
      startX.current = e.touches[0].clientX
      locked.current = null
    }

    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return
      const dy = e.touches[0].clientY - startY.current
      const dx = e.touches[0].clientX - startX.current
      // 最初の10pxで縦横を判定。横スワイプ（カルーセル等）なら以降無視
      if (!locked.current) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
        locked.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      }
      if (locked.current === 'x' || dy <= 0 || window.scrollY > 0) {
        if (pullRef.current) reset()
        return
      }
      const d = Math.min(dy * DAMPING, MAX_PULL)
      pullRef.current = d
      setPull(d)
      setDragging(true)
    }

    const onEnd = () => {
      if (startY.current === null) return
      if (pullRef.current >= THRESHOLD) {
        setRefreshing(true)
        setPull(THRESHOLD)
        setDragging(false)
        // スピナーを一瞬見せてから再読込
        window.setTimeout(() => window.location.reload(), 300)
        return
      }
      reset()
    }

    // passive: true（preventDefault しない＝スクロール性能を落とさない）
    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: true })
    document.addEventListener('touchend', onEnd, { passive: true })
    document.addEventListener('touchcancel', reset, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', reset)
    }
  }, [enabled, refreshing])

  if (!enabled || (pull === 0 && !refreshing)) return null

  const progress = Math.min(pull / THRESHOLD, 1)
  const ready = progress >= 1

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center"
      style={{
        // ノッチ・ステータスバー分を避ける
        transform: `translateY(calc(env(safe-area-inset-top) + ${pull - 8}px))`,
        transition: dragging ? 'none' : 'transform 200ms ease-out',
      }}
    >
      <div
        className={cn(
          'flex size-11 items-center justify-center rounded-full border bg-background shadow-md',
          ready ? 'text-ds-app-accent' : 'text-muted-foreground'
        )}
        style={{ opacity: 0.4 + progress * 0.6 }}
      >
        <RefreshCw
          size={20}
          className={cn(refreshing && 'animate-spin')}
          style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }}
        />
      </div>
      <span className="sr-only">
        {refreshing ? '更新しています' : ready ? '指を離すと更新します' : '下に引いて更新'}
      </span>
    </div>
  )
}
