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
  { notifyOnComplete = false }: { notifyOnComplete?: boolean } = {},
): OnboardingState {
  const [loading, setLoading] = useState(true)
  const [applicable, setApplicable] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/onboarding')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return
        setApplicable(!!d.applicable)
        setCompanyId(d.companyId ?? null)
        setDismissed(!!d.dismissedAt)
        setStatus(d.status ?? null)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const dismiss = useCallback(async () => {
    // 押した瞬間に消す。失敗しても次回の取得で戻るだけなので待たせない
    setDismissed(true)
    await fetch('/api/onboarding/dismiss', { method: 'POST' }).catch(() => {})
  }, [])

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
