'use client'

/* 資料請求の常駐バナー（公開サイト＋ツールLP用）。表紙サムネイル付き・左下。
   - 置き場所は app/(site)/layout.tsx と、4つのツールLP（app/tools/[tool]/page.tsx）の <Footer /> 直前。
     ⚠️ app/tools/layout.tsx には置かない（ツール本体 /tools/[tool]/app/... まで包むので作業画面に出てしまう）。
   - 1160〜1319px はヘッダーに資料請求ボタンが出ない幅なので、この導線がその幅の受け皿になる。
   - 縦に 400px スクロールしたら表示。×で閉じたら 7日間は出さない（localStorage）。
   - localStorage は useEffect 内で読む。初期状態は非表示にして SSR と食い違わないようにする。
   - トップページは window ではなく別の要素がスクロールすることがあるため、scroll を capture で拾う。
   - 次のときは隠す（ページ本体の CTA やリンクを覆わないため）:
       ・フッターが見えている
       ・バナーが占める領域の下に、ページのリンク／ボタンがある（elementsFromPoint で判定）
   - ページの地（#08080a）から浮かせるため白地。文字はすべて 14px 以上（globals.css が 13px 以下を 14px に底上げする）。
   - 表紙は営業資料 v12 の表紙（public/marketing/images/document-cover.jpg・240×170）。CLS を出さないよう width/height を入れる。
   - z-index は Nav（z-50）より下。 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

const STORAGE_KEY = 'bz_doc_cta_dismissed_at'
const SUPPRESS_DAYS = 7
const SHOW_AFTER_PX = 400
const HREF = '/document?from=floating'
const COVER_SRC = '/marketing/images/document-cover.jpg'
const COVER_ALT = 'branding.bz サービス資料の表紙'
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
      } inset-x-0 bottom-0 md:inset-x-auto md:bottom-6 md:left-6`}
    >
      {/* md 未満: 画面下端のフル幅バー（白地） */}
      <div
        className="flex items-center gap-2 border-t border-[#e5e7eb] bg-white px-3 pt-2.5 md:hidden"
        style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))' }}
        data-panel="mobile"
      >
        <img
          src={COVER_SRC}
          alt={COVER_ALT}
          width={44}
          height={31}
          className="h-[31px] w-[44px] flex-none rounded-[3px] object-cover"
        />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-bold text-[#12141a]">サービス資料・無料</p>
          <p className="truncate text-sm text-[#6b7280]">機能・料金・導入の流れ</p>
        </div>
        <Link
          href={HREF}
          tabIndex={visible ? 0 : -1}
          className="inline-flex h-8 flex-none items-center whitespace-nowrap rounded-full bg-[#12141a] px-3 text-sm font-bold text-white transition-opacity hover:opacity-85"
        >
          ダウンロード
        </Link>
        <button
          type="button"
          onClick={dismiss}
          tabIndex={visible ? 0 : -1}
          aria-label="資料請求のお知らせを閉じる"
          className="-my-2 -mr-3 inline-flex h-11 w-11 flex-none items-center justify-center text-black/40 transition-colors hover:text-black/70"
        >
          <X size={18} />
        </button>
      </div>

      {/* md 以上: 左下のカード（白地・表紙サムネイル付き） */}
      <div
        className="relative hidden w-[336px] items-center gap-4 rounded-xl bg-white p-4 md:flex"
        style={{ boxShadow: '0 12px 32px rgba(0,0,0,.45)' }}
        data-panel="desktop"
      >
        <img
          src={COVER_SRC}
          alt={COVER_ALT}
          width={92}
          height={65}
          className="h-[65px] w-[92px] flex-none rounded object-cover"
          style={{ boxShadow: '0 3px 8px rgba(0,0,0,.28)' }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-[#5d6472]">サービス資料・PDF</p>
          <p className="mt-0.5 text-[17px] font-bold leading-snug text-[#12141a]">機能・料金・導入の流れ</p>
          <Link
            href={HREF}
            tabIndex={visible ? 0 : -1}
            className="mt-3.5 inline-flex h-9 items-center whitespace-nowrap rounded-full bg-[#12141a] px-[18px] text-sm font-bold text-white transition-opacity hover:opacity-85"
          >
            無料でダウンロード
          </Link>
        </div>
        <button
          type="button"
          onClick={dismiss}
          tabIndex={visible ? 0 : -1}
          aria-label="資料請求のお知らせを閉じる"
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-black/40 transition-colors hover:bg-black/5 hover:text-black/70"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
