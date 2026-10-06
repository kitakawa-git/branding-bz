// 現在ログイン中のユーザーが属する会社の実効プランを返す。
// 構築ツール等の UI で「このユーザーは Free か？」を事前判定し、
// 事前バッジ（例: PDF出力ボタン横の「Standard から」）を出すために使う。
// サーバ側のガードは別途 guardCompanyFeature がやるので、ここは
// あくまで UI 表示のためのヒント。
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchCompanyIdForAuth, fetchCompanyPlan } from '@/lib/billing/guard'
import { getEffectivePlan } from '@/lib/billing/entitlements'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ plan: null, authenticated: false })
  const companyId = await fetchCompanyIdForAuth(user.id)
  if (!companyId) return NextResponse.json({ plan: null, authenticated: true, companyId: null })
  const company = await fetchCompanyPlan(companyId)
  return NextResponse.json({ plan: getEffectivePlan(company), authenticated: true, companyId })
}
