// お知らせ公開時のプッシュ配信。呼び出し元がそのお知らせの企業の管理者であることを検証してから送信。
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sendPushToCompany } from '@/lib/push'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let payload: { announcementId?: string }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  }
  if (!payload.announcementId) return NextResponse.json({ error: 'no_id' }, { status: 400 })

  const admin = getSupabaseAdmin()
  const { data: ann } = await admin
    .from('announcements')
    .select('id, title, company_id, is_published')
    .eq('id', payload.announcementId)
    .maybeSingle()
  if (!ann) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!ann.is_published) return NextResponse.json({ ok: true, sent: 0, skipped: 'not_published' })

  // 呼び出し元がそのお知らせの企業の管理者か検証（他社・非管理者からの送信を防ぐ）
  const { data: adminRow } = await admin
    .from('admin_users')
    .select('id')
    .eq('auth_id', user.id)
    .eq('company_id', ann.company_id)
    .maybeSingle()
  if (!adminRow) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const result = await sendPushToCompany(ann.company_id as string, {
    title: '新しいお知らせ',
    body: ann.title as string,
    url: `/portal/announcements/${ann.id}`,
  })
  return NextResponse.json({ ok: true, ...result })
}
