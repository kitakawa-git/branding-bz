// アナリティクス計測ヘルパー
// 名刺ページ・ブランドページから呼び出すクライアント側トラッキング関数

const VISITOR_ID_KEY = 'branding_bz_visitor_id'

// セッション内フォールバック用（localStorage使用不可時）
let sessionVisitorId = ''

/**
 * 訪問者IDを取得（永続化 or セッション一時ID）
 * SSR時は空文字を返す
 */
export function getVisitorId(): string {
  if (typeof window === 'undefined') return ''

  try {
    const stored = localStorage.getItem(VISITOR_ID_KEY)
    if (stored) return stored

    const newId = crypto.randomUUID()
    localStorage.setItem(VISITOR_ID_KEY, newId)
    return newId
  } catch {
    // localStorage使用不可（プライベートブラウジング等）
    if (!sessionVisitorId) {
      sessionVisitorId = crypto.randomUUID()
    }
    return sessionVisitorId
  }
}

/**
 * 名刺ページ上のアクションイベントを記録
 */
export async function trackCardEvent(params: {
  profileId: string
  companyId: string
  eventType: 'vcard_download' | 'brand_page_click' | 'sns_click' | 'website_click' | 'phone_click' | 'email_click'
  eventData?: Record<string, unknown>
}): Promise<void> {
  try {
    await fetch('/api/analytics/card-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileId: params.profileId,
        companyId: params.companyId,
        eventType: params.eventType,
        eventData: params.eventData || {},
        visitorId: getVisitorId(),
      }),
    })
  } catch (err) {
    console.warn('[track] cardEvent送信失敗:', err)
  }
}

/**
 * ブランドページの閲覧行動を記録
 */
export async function trackBrandPageView(params: {
  companyId: string
  sourceProfileId?: string
  pageType: 'guidelines' | 'strategy' | 'visuals' | 'verbal' | 'personality'
  sectionsViewed?: string[]
  scrollDepth?: number
  durationSeconds?: number
}): Promise<void> {
  try {
    await fetch('/api/analytics/brand-page-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: params.companyId,
        sourceProfileId: params.sourceProfileId || null,
        pageType: params.pageType,
        visitorId: getVisitorId(),
        sectionsViewed: params.sectionsViewed || [],
        scrollDepth: params.scrollDepth ?? 0,
        durationSeconds: params.durationSeconds ?? 0,
      }),
    })
  } catch (err) {
    console.warn('[track] brandPageView送信失敗:', err)
  }
}

/**
 * ページ離脱時にブランドページ閲覧行動を送信（sendBeacon優先）
 * visibilitychange / beforeunload から呼ぶ想定
 */
export function sendBrandPageViewBeacon(params: {
  companyId: string
  sourceProfileId?: string
  pageType: 'guidelines' | 'strategy' | 'visuals' | 'verbal' | 'personality'
  sectionsViewed?: string[]
  scrollDepth?: number
  durationSeconds?: number
}): void {
  const payload = JSON.stringify({
    companyId: params.companyId,
    sourceProfileId: params.sourceProfileId || null,
    pageType: params.pageType,
    visitorId: getVisitorId(),
    sectionsViewed: params.sectionsViewed || [],
    scrollDepth: params.scrollDepth ?? 0,
    durationSeconds: params.durationSeconds ?? 0,
  })

  const url = '/api/analytics/brand-page-view'

  // sendBeacon を優先（離脱時の送信を保証）
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' })
    const sent = navigator.sendBeacon(url, blob)
    if (sent) return
  }

  // フォールバック: fetch with keepalive
  try {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    })
  } catch {
    // 離脱時なのでエラーは無視
  }
}
