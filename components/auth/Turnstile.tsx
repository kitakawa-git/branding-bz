'use client'

// Cloudflare Turnstile（CAPTCHA）。Supabase Auth の「CAPTCHA 保護」を有効にしたとき、
// パスワードログイン・パスワード再設定メールの送信に captchaToken が必要になる。
//
// NEXT_PUBLIC_TURNSTILE_SITE_KEY が未設定なら何も表示せず、token は undefined のまま（＝今までどおり）。
// 有効化の順番: ① Vercel にサイトキーを設定して再デプロイ → ② Supabase で CAPTCHA を有効化しシークレットを入力。
// 逆順にすると、その間ログインできなくなる。
//
// 使い方:
//   const captcha = useTurnstile()
//   if (!captcha.ready) { setError(CAPTCHA_WAIT_MESSAGE); return }
//   await supabase.auth.signInWithPassword({ email, password, options: { captchaToken: captcha.token } })
//   captcha.reset()   // トークンは1回限り。成功・失敗にかかわらず送ったら作り直す
//   ...
//   {captcha.widget}  // フォームの送信ボタンの上に置く
import { useCallback, useEffect, useRef, useState } from 'react'

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

export const CAPTCHA_WAIT_MESSAGE = 'ロボットでないことの確認が終わるまでお待ちください'

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let scriptPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = SCRIPT_SRC
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => {
        scriptPromise = null
        reject(new Error('Turnstile の読み込みに失敗しました'))
      }
      document.head.appendChild(s)
    })
  }
  return scriptPromise
}

type Theme = 'dark' | 'light' | 'auto'

function TurnstileWidget({ siteKey, theme, onToken, resetSignal }: {
  siteKey: string
  theme: Theme
  onToken: (token: string | undefined) => void
  resetSignal: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          language: 'ja',
          callback: (token: string) => onToken(token),
          'expired-callback': () => onToken(undefined),
          'error-callback': () => onToken(undefined),
        })
      })
      .catch((err) => console.error('[Turnstile]', err))
    return () => {
      cancelled = true
      if (widgetIdRef.current) window.turnstile?.remove(widgetIdRef.current)
      widgetIdRef.current = null
    }
  }, [siteKey, theme, onToken])

  useEffect(() => {
    if (resetSignal > 0 && widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current)
  }, [resetSignal])

  return <div ref={containerRef} className="mb-4 flex min-h-[65px] justify-center" />
}

/** theme: ログイン画面は暗いカードなので既定は dark。白い画面では 'light' か 'auto' */
export function useTurnstile(theme: Theme = 'dark') {
  const [token, setToken] = useState<string | undefined>(undefined)
  const [resetSignal, setResetSignal] = useState(0)

  const reset = useCallback(() => {
    setToken(undefined)
    setResetSignal((n) => n + 1)
  }, [])

  return {
    /** サイトキー未設定なら false（CAPTCHA なしで今までどおり動く） */
    enabled: !!SITE_KEY,
    token,
    /** 送信してよいか。無効なら常に true */
    ready: !SITE_KEY || !!token,
    reset,
    widget: SITE_KEY ? <TurnstileWidget siteKey={SITE_KEY} theme={theme} onToken={setToken} resetSignal={resetSignal} /> : null,
  }
}
