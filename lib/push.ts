// Web Push 送信ヘルパー（サーバ専用）。VAPID秘密鍵を使うため API Route からのみ呼ぶ。
import webpush from 'web-push'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

let configured: boolean | null = null
function ensureConfigured(): boolean {
  if (configured !== null) return configured
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:info@branding.bz'
  if (!pub || !priv) {
    configured = false
    return false
  }
  webpush.setVapidDetails(subject, pub, priv)
  configured = true
  return true
}

export type PushPayload = { title: string; body?: string; url?: string }

type SubRow = { id: string; endpoint: string; p256dh: string; auth: string }

// 指定企業の全購読端末へプッシュ送信。無効購読(404/410)は自動削除。
export async function sendPushToCompany(
  companyId: string,
  payload: PushPayload,
): Promise<{ sent: number; removed: number; skipped?: string }> {
  if (!ensureConfigured()) return { sent: 0, removed: 0, skipped: 'vapid_not_configured' }
  const admin = getSupabaseAdmin()
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('company_id', companyId)
  const list = (subs as SubRow[] | null) || []
  if (list.length === 0) return { sent: 0, removed: 0 }

  const body = JSON.stringify(payload)
  const deadIds: string[] = []
  let sent = 0
  await Promise.all(
    list.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        )
        sent++
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode
        if (code === 404 || code === 410) deadIds.push(s.id) // 期限切れ/解除済み購読を掃除
      }
    }),
  )
  if (deadIds.length) await admin.from('push_subscriptions').delete().in('id', deadIds)
  return { sent, removed: deadIds.length }
}
