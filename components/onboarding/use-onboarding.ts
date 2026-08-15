'use client'

// 初回セットアップ案内の状態取得。ポータルと管理画面の両方がこれを使う。
import { useCallback, useEffect, useState } from 'react'
import {
  buildOnboardingView,
  type OnboardingStatus,
  type OnboardingView,
} from '@/lib/onboarding/steps'
import { can } from '@/lib/billing/entitlements'

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

export function useOnboarding(company: CompanyLike): OnboardingState {
  const [loading, setLoading] = useState(true)
  const [applicable, setApplicable] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [status, setStatus] = useState<OnboardingStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/onboarding')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return
        setApplicable(!!d.applicable)
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

  return {
    loading,
    hidden: !applicable || !view || view.allDone,
    dismissed,
    view,
    dismiss,
  }
}
