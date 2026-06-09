// Web Push 購読登録（本人のcookieセッションで認証→service_roleで保存）
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let payload: {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    userAgent?: string
  }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  }
  const sub = payload.subscription
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: 'invalid_subscription' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  // 会社IDは members(auth_id) から解決
  const { data: member } = await admin
    .from('members')
    .select('company_id')
    .eq('auth_id', user.id)
    .maybeSingle()

  const { error } = await admin.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      company_id: member?.company_id ?? null,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: payload.userAgent ?? null,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
