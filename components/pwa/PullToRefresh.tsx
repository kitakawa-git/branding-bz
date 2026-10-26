'use client'

// PWA（standalone起動）専用のプル・トゥ・リフレッシュ。
// ブラウザのタブ内では標準の引っ張り更新があるので何もしない。
//
// 引いた分だけページ（body）を下にずらし、上にできた隙間にインジケーターを出す（画面に被せない）。
// ・body に transform を掛けると、position: fixed の要素（ヘッダー等）も一緒に下がる＝画面全体が下がる
// ・インジケーター自体は body の外（<html> 直下に作った専用の div）に portal で置く。body の中だと一緒に動いてしまう。
//   createPortal の宛先に document.documentElement を直接渡すと、React 19 は <html> を特別扱いして body の中に入れるため使えない
// ・戻し終わったら body の transform を必ず消す。残すと fixed の要素が body 基準になり位置がずれる
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

const THRESHOLD = 64   // これ以上引いて離したら更新（px・減衰後の値）
const MAX_PULL = 96    // インジケーターの最大移動量
const DAMPING = 0.5    // 指の移動量に対する追従率
const INDICATOR = 44   // インジケーターの直径（size-11）
const BACK_MS = 200    // 離したときにページが戻るアニメーション

// 画面最上部の背景色（透明でない最も近い祖先の色）。ずらしてできた隙間をこの色で塗る
// （塗らないと <html> の地の色＝白が見え、暗いページでは白い帯になる）
function topBackgroundColor() {
  let el: Element | null = document.elementFromPoint(window.innerWidth / 2, 1)
  while (el) {
    const c = getComputedStyle(el).backgroundColor
    if (c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)) return c
    el = el.parentElement
  }
  return ''
}

// ページ全体（body）を下にずらす。0 に戻すときはアニメーション後に指定ごと消す
let clearTimer: number | undefined
function shiftPage(px: number, animate: boolean) {
  const b = document.body
  const html = document.documentElement
  window.clearTimeout(clearTimer)
  if (px > 0 && !b.style.transform) html.style.backgroundColor = topBackgroundColor()
  b.style.transition = animate ? `transform ${BACK_MS}ms ease-out` : 'none'
  b.style.transform = `translateY(${px}px)`
  if (px === 0) {
    clearTimer = window.setTimeout(() => {
      b.style.transition = ''
      b.style.transform = ''
      html.style.backgroundColor = ''
    }, animate ? BACK_MS + 20 : 0)
  }
}

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
  // インジケーターの置き場所（<html> 直下・body の外）。有効なときだけ作る
  const [host, setHost] = useState<HTMLElement | null>(null)
  const startY = useRef<number | null>(null)
  const startX = useRef(0)
  const locked = useRef<'y' | 'x' | null>(null)
  const pullRef = useRef(0)
  // 更新中か（タッチ処理から参照する）。state だけで持つと、変わるたびにタッチ処理の effect が
  // 張り直され、その後始末で body の transform が消えて、更新中にページが上に戻ってしまう
  const refreshingRef = useRef(false)

  // ハイドレーション後に判定（SSRでは常に無効）
  useEffect(() => {
    setEnabled(isStandalone() && 'ontouchstart' in window)
  }, [])

  useEffect(() => {
    if (!enabled) return
    const el = document.createElement('div')
    el.setAttribute('data-ptr-host', '')
    document.documentElement.appendChild(el)
    setHost(el)
    return () => {
      el.remove()
      setHost(null)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    const reset = () => {
      startY.current = null
      locked.current = null
      if (pullRef.current) shiftPage(0, true)
      pullRef.current = 0
      setPull(0)
      setDragging(false)
    }

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || e.touches.length !== 1) return
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
      shiftPage(d, false)
      setPull(d)
      setDragging(true)
    }

    const onEnd = () => {
      if (startY.current === null) return
      if (pullRef.current >= THRESHOLD) {
        refreshingRef.current = true
        setRefreshing(true)
        setPull(THRESHOLD)
        setDragging(false)
        // 再読込までの間、ページは閾値の位置で止めてスピナーを見せる
        shiftPage(THRESHOLD, true)
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
      document.body.style.transition = ''
      document.body.style.transform = ''
      document.documentElement.style.backgroundColor = ''
    }
  }, [enabled])

  if (!enabled || !host || (pull === 0 && !refreshing)) return null

  const progress = Math.min(pull / THRESHOLD, 1)
  const ready = progress >= 1

  return createPortal(
    <div
      data-ptr-indicator
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center"
      style={{
        // ずらしてできた隙間（高さ = pull）の中央に置く。隙間がアイコンより狭い間は、下端を隙間の下端に
        // 合わせて上から滑り込ませる（ページに被せない）。ノッチ・ステータスバー分は避ける
        transform: `translateY(calc(env(safe-area-inset-top) + ${Math.min((pull - INDICATOR) / 2, pull - INDICATOR)}px))`,
        transition: dragging ? 'none' : `transform ${BACK_MS}ms ease-out`,
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
    </div>,
    host
  )
}
