'use client'

// プランの期限が近いことを知らせる控えめな表示（Phase 4）。
// Early Access は plan='premium' ＋ plan_expires_at=登録+90日 で運用するので、
// これがそのまま EA の終了予告を兼ねる。専用の分岐は作らない。
//
// 出す場所は管理画面ヘッダーの1箇所だけ。大袈裟なバナーにしない。
import Link from 'next/link'
import { Clock } from 'lucide-react'
import { resolvePlanDisplay } from '@/lib/billing/plan-display'

type CompanyLike = { plan?: string | null; plan_expires_at?: string | null } | null | undefined

export function PlanExpiryNotice({ company }: { company: CompanyLike }) {
  if (!company) return null

  const p = resolvePlanDisplay(company)
  // note が出るのは「残りN日（7日以内）」か「◯◯ 期限切れ」のときだけ。
  // 無期限・余裕があるときは何も出さない
  if (!p.note) return null

  return (
    <Link
      href="/plan"
      className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground no-underline hover:text-foreground"
      title={`現在のプラン: ${p.label}`}
    >
      <Clock size={13} aria-hidden="true" />
      {p.note}
    </Link>
  )
}
