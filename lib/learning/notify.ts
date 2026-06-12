// 学習動画が「公開」された時の通知（サーバ専用）
// ① お知らせ(announcements)を1件作成 → ポータルのお知らせ一覧に表示される
// ② 企業メンバーの端末へプッシュ送信
// いずれも失敗しても呼び出し元の作成/更新は成功扱い（通知は副作用）
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sendPushToCompany } from '@/lib/push'

export async function notifyLearningVideoPublished(
  companyId: string,
  authorId: string,
  video: { id: string; title: string },
): Promise<void> {
  const admin = getSupabaseAdmin()

  // ① お知らせ作成（is_published=true で一覧に出す。category は既存の「更新」を流用）
  const { error: annErr } = await admin.from('announcements').insert({
    company_id: companyId,
    author_id: authorId,
    title: `新しい学習動画：${video.title}`,
    content: `「${video.title}」が公開されました。\nポータルの「ラーニング」からご視聴いただけます。`,
    category: '更新',
    is_published: true,
  })
  if (annErr) console.error('[learning notify] お知らせ作成エラー:', annErr.message)

  // ② プッシュ通知（タップで該当動画へ）
  try {
    await sendPushToCompany(companyId, {
      title: '新しい学習動画',
      body: video.title,
      url: `/portal/learning/${video.id}`,
    })
  } catch (e) {
    console.error('[learning notify] push送信エラー:', e)
  }
}
