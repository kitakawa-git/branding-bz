'use client'

// 初回セットアップ案内の状態取得。ポータルと管理画面の両方がこれを使う。
import { useCallback, useEffect, useState } from 'react'
import {
  buildOnboardingView,
  type OnboardingStatus,
  type OnboardingView,
} from '@/lib/onboarding/steps'
import { can } from '@/lib/billing/entitlements'
import { toast } from 'sonner'
import { getPageCache, setPageCache } from '@/lib/page-cache'

/** /api/onboarding のレスポンス。クライアント側のキャッシュにもこの形で入れる */
type OnboardingResponse = {
  applicable: boolean
  companyId?: string | null
  status?: OnboardingStatus | null
  dismissedAt?: string | null
}

/**
 * このセッションで最後に見た「全ステップ完了か」を、会社ごとに覚える。
 *
 * モジュール変数にしているのは、ページを移動してフックが作り直されても
 * 「さっきまで未完了だった」を覚えておくため（最後の1つを管理画面で終えて
 * ポータルに戻る、という順路が実際に一番多い）。
 * リロードで消えるのは意図どおり。完了の通知は一度出れば役目が終わるので、
 * DB にも localStorage にも残さない。
 *
 * 会社ごとに持つのは、同じタブで別企業を跨いで見たときに、
 * 未完了の会社Aの基準値を完了済みの会社Bが上書きして誤発火するのを防ぐため。
 */
const seenAllDoneByCompany = new Map<string, boolean>()

type CompanyLike = Parameters<typeof can>[0]

export type OnboardingState = {
  loading: boolean
  /** 管理者でない・全ステップ完了などで、そもそも出さないとき true */
  hidden: boolean
  /** ポータル側で「あとで」を押してあるか。管理画面はこれを無視する */
  dismissed: boolean
  view: OnboardingView | null
  dismiss: () => Promise<void>
}

export function useOnboarding(
  company: CompanyLike,
  /**
   * 完了した瞬間に「準備完了」を出すか。ポータルのカードだけ true にする。
   * 管理画面の鏡写しカードでも出すと、同じ完了で2回鳴ったり、
   * 「社員と同じ画面」という文言が管理画面で出て噛み合わなくなる。
   */
  {
    notifyOnComplete = false,
    userId,
  }: {
    notifyOnComplete?: boolean
    /**
     * 与えるとこのユーザー分の取得結果をページキャッシュに載せる。
     * ダッシュボードは案内を出すかどうか分かるまで描けないので、
     * 毎回 API を待つとクライアント遷移のたびにスケルトンが挟まる。
     * ユーザーIDをキーにするのは、別アカウントの結果を出さないため。
     */
    userId?: string | null
  } = {},
): OnboardingState {
  const cacheKey = userId ? `onboarding-${userId}` : null
  const cached = cacheKey ? getPageCache<OnboardingResponse>(cacheKey) : null

  // キャッシュがあれば loading を挟まずそのまま描き、裏で取り直す
  const [loading, setLoading] = useState(!cached)
  const [applicable, setApplicable] = useState(!!cached?.applicable)
  const [dismissed, setDismissed] = useState(!!cached?.dismissedAt)
  const [status, setStatus] = useState<OnboardingStatus | null>(cached?.status ?? null)
  const [companyId, setCompanyId] = useState<string | null>(cached?.companyId ?? null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/onboarding')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: OnboardingResponse | null) => {
        if (cancelled || !d) return
        setApplicable(!!d.applicable)
        setCompanyId(d.companyId ?? null)
        setDismissed(!!d.dismissedAt)
        setStatus(d.status ?? null)
        if (cacheKey) setPageCache(cacheKey, d)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cacheKey])

  const dismiss = useCallback(async () => {
    // 押した瞬間に消す。失敗しても次回の取得で戻るだけなので待たせない
    setDismissed(true)
    // キャッシュも同時に更新する。ここを忘れると、次のクライアント遷移で
    // 「閉じる前」の結果が復元され、閉じたはずの案内が一瞬戻る
    if (cacheKey) {
      const prev = getPageCache<OnboardingResponse>(cacheKey)
      if (prev) setPageCache(cacheKey, { ...prev, dismissedAt: new Date().toISOString() })
    }
    await fetch('/api/onboarding/dismiss', { method: 'POST' }).catch(() => {})
  }, [cacheKey])

  const view = status ? buildOnboardingView(company, status) : null
  const allDone = view?.allDone ?? null

  // 未完了 → 完了に変わった瞬間だけ一度出す。
  // 読み込んだ時点で既に完了している場合（過去に済ませた人）は出さない
  useEffect(() => {
    if (!notifyOnComplete || allDone === null || !companyId) return
    const prev = seenAllDoneByCompany.get(companyId)
    seenAllDoneByCompany.set(companyId, allDone)
    if (prev === false && allDone) {
      toast.success('準備完了です。ここからは社員と同じ画面が表示されます')
    }
  }, [notifyOnComplete, allDone, companyId])

  return {
    loading,
    hidden: !applicable || !view || view.allDone,
    dismissed,
    view,
    dismiss,
  }
}
