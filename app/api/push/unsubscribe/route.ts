// Web Push 購読解除（本人の購読のみ削除）
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let payload: { endpoint?: string }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  }
  if (!payload.endpoint) return NextResponse.json({ error: 'no_endpoint' }, { status: 400 })

  const admin = getSupabaseAdmin()
  await admin
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', payload.endpoint)
    .eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
