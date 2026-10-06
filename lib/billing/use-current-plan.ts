'use client'

// 現在ログイン中ユーザーの実効プランを取得する軽量フック。
// /api/me/plan を1回フェッチして返す。未ログイン / 会社なしは null。
// サーバ側ガードはこのフックに依存しない（別途 guardCompanyFeature がやる）。
// あくまで UI で事前バッジ（例: 「Standard から」）を出すためのヒント用途。
import { useEffect, useState } from 'react'
import type { Plan } from './entitlements'

export function useCurrentPlan(): Plan | null {
  const [plan, setPlan] = useState<Plan | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/me/plan', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { plan?: Plan | null } | null) => {
        if (cancelled || !d) return
        setPlan(d.plan ?? null)
      })
      .catch(() => { /* 取得失敗はバッジを出さないだけ。既存機能に影響させない */ })
    return () => { cancelled = true }
  }, [])
  return plan
}
