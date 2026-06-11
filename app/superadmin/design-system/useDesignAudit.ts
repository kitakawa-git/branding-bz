'use client'

// 公開LPを不可視 iframe で読み込み、実DOMから計測する hook。
// enabled が true の間だけ iframe を生成し、計測完了後に破棄する。
import { useEffect, useState } from 'react'
import { extractAudit, type AuditResult } from './audit'

export function useDesignAudit(
  enabled: boolean,
  page: string,
  viewportWidth: number
) {
  const [result, setResult] = useState<AuditResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    setLoading(true)
    setResult(null)
    setError(null)

    const iframe = document.createElement('iframe')
    iframe.src = page
    // visibility:hidden（display:none だとレイアウト計算されず computedStyle が取れない）
    iframe.style.cssText = `position:fixed;left:-${viewportWidth + 100}px;top:0;width:${viewportWidth}px;height:2400px;visibility:hidden;pointer-events:none;border:0;`
    iframe.setAttribute('aria-hidden', 'true')
    iframe.tabIndex = -1

    const finish = () => {
      iframe.remove()
    }

    iframe.onload = () => {
      // SSR済みHTMLでスタイルは確定しているが、フォント読込分を少し待つ
      timer = setTimeout(() => {
        if (cancelled) return
        try {
          const doc = iframe.contentDocument
          if (!doc?.body) throw new Error('iframe document unavailable')
          setResult(extractAudit(doc, viewportWidth))
        } catch (e) {
          setError(e instanceof Error ? e.message : '計測に失敗しました')
        } finally {
          setLoading(false)
          finish()
        }
      }, 900)
    }
    iframe.onerror = () => {
      if (!cancelled) {
        setError('ページの読み込みに失敗しました')
        setLoading(false)
      }
      finish()
    }
    document.body.appendChild(iframe)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      finish()
    }
  }, [enabled, page, viewportWidth])

  return { result, loading, error }
}
