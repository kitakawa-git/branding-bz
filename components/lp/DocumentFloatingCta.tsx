'use client'

/* 資料請求の常駐バナー（公開サイト＋ツールLP用）。
   - 置き場所は app/(site)/layout.tsx と、4つのツールLP（app/tools/[tool]/page.tsx）の <Footer /> 直前。
     ⚠️ app/tools/layout.tsx には置かない（ツール本体 /tools/[tool]/app/... まで包むので作業画面に出てしまう）。
   - 1160〜1319px はヘッダーに資料請求ボタンが出ない幅なので、この導線がその幅の受け皿になる。
   - 縦に 400px スクロールしたら表示。×で閉じたら 7日間は出さない（localStorage）。
   - localStorage は useEffect 内で読む。初期状態は非表示にして SSR と食い違わないようにする。
   - トップページは window ではなく別の要素がスクロールすることがあるため、scroll を capture で拾う。
   - 次のときは隠す（ページ本体の CTA やリンクを覆わないため）:
       ・フッターが見えている
       ・バナーが占める領域の下に、ページのリンク／ボタンがある（elementsFromPoint で判定）
   - 文字は globals.css の底上げで 14px になる前提で組む。z-index は Nav（z-50）より下。 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

const STORAGE_KEY = 'bz_doc_cta_dismissed_at'
const SUPPRESS_DAYS = 7
const SHOW_AFTER_PX = 400
const HREF = '/document?from=floating'
const INTERACTIVE = 'a, button, input, select, textarea, [role="button"]'

function isDismissedRecently(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const at = new Date(raw).getTime()
    if (Number.isNaN(at)) return false
    return Date.now() - at < SUPPRESS_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

export default function DocumentFloatingCta() {
  const pathname = usePathname()
  const wrapRef = useRef<HTMLDivElement>(null)
  // 初期は「閉じた扱い＋未スクロール」＝非表示。effect で実際の状態に更新する
  const [dismissed, setDismissed] = useState(true)
  const [scrolled, setScrolled] = useState(false)
  const [footerInView, setFooterInView] = useState(false)
  const [coversInteractive, setCoversInteractive] = useState(false)

  const hiddenPath = pathname?.startsWith('/document') || pathname?.startsWith('/contact')

  useEffect(() => {
    if (hiddenPath) return
    setDismissed(isDismissedRecently())

    // バナーが占める領域（表示中の方の中身）に、ページ側のリンク／ボタンが重なっているか
    const checkCovers = () => {
      const wrap = wrapRef.current
      if (!wrap) return
      const panel = [...wrap.children].find((c) => getComputedStyle(c).display !== 'none')
      if (!panel) return
      const r = panel.getBoundingClientRect()
      let hit = false
      for (const fx of [0.08, 0.3, 0.5, 0.7, 0.92]) {
        for (const fy of [0.25, 0.75]) {
          const x = r.left + r.width * fx
          const y = r.top + r.height * fy
          const under = document.elementsFromPoint(x, y).find((el) => !wrap.contains(el))
          if (under?.closest(INTERACTIVE) && !under.closest('header')) {
            hit = true
            break
          }
        }
        if (hit) break
      }
      setCoversInteractive(hit)
    }

    let raf = 0
    const onScroll = (e: Event) => {
      const target = e.target
      const elementTop = target instanceof Element ? target.scrollTop : 0
      const y = Math.max(window.scrollY, document.documentElement.scrollTop, elementTop)
      setScrolled(y > SHOW_AFTER_PX)
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(checkCovers)
    }
    const onResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(checkCovers)
    }
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    window.addEventListener('resize', onResize)

    let observer: IntersectionObserver | null = null
    const footer = document.querySelector('footer')
    if (footer) {
      observer = new IntersectionObserver(([entry]) => setFooterInView(entry.isIntersecting))
      observer.observe(footer)
    }
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(raf)
      observer?.disconnect()
    }
  }, [hiddenPath, pathname])

  if (hiddenPath) return null

  const visible = scrolled && !dismissed && !footerInView && !coversInteractive

  const dismiss = () => {
    setDismissed(true)
    try {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    } catch {
      // 保存できなくてもこのページでは閉じたままにする
    }
  }

  return (
    <div
      ref={wrapRef}
      aria-hidden={!visible}
      className={`fixed z-40 transition-all duration-300 ${
        visible ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
      } inset-x-0 bottom-0 md:inset-x-auto md:bottom-6 md:right-6`}
    >
      {/* md 未満: 画面下端のフル幅バー */}
      <div
        className="flex items-center gap-3 border-t border-white/10 bg-[#0d0d11]/95 px-4 pt-2 backdrop-blur md:hidden"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        {/* 375px ではボタンと×で残り約120px。「（無料）」まで入れると省略記号で切れるので短くする */}
        <p className="min-w-0 flex-1 truncate text-sm text-white/70">サービス資料</p>
        <Link
          href={HREF}
          tabIndex={visible ? 0 : -1}
          className="inline-flex h-9 shrink-0 items-center rounded-full border border-white/25 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10"
        >
          資料をダウンロード
        </Link>
        <button
          type="button"
          onClick={dismiss}
          tabIndex={visible ? 0 : -1}
          aria-label="資料請求のお知らせを閉じる"
          className="-mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      {/* md 以上: 右下の小さめカード */}
      <div className="relative hidden w-[280px] rounded-2xl border border-white/10 bg-[#0d0d11]/90 p-4 pr-10 shadow-2xl backdrop-blur md:block">
        <p className="text-sm text-white/70">サービス資料（無料・全16ページ）</p>
        <Link
          href={HREF}
          tabIndex={visible ? 0 : -1}
          className="mt-3 inline-flex h-9 items-center rounded-full border border-white/25 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10"
        >
          資料をダウンロード
        </Link>
        <button
          type="button"
          onClick={dismiss}
          tabIndex={visible ? 0 : -1}
          aria-label="資料請求のお知らせを閉じる"
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
