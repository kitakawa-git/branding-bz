import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getAdminContext } from '@/lib/learning/auth'
import { DESIGN_TOKENS_CACHE_TAG } from '@/lib/design-tokens'

/**
 * POST /api/revalidate
 * design-tokens タグのキャッシュを無効化する（管理者認証必須）。
 * /admin/design-system でトークンを保存した直後に呼ばれ、
 * 公開LPの <style id="design-tokens"> を次のリクエストから更新させる。
 *
 * トークンの書き込み自体は RLS（superadmin のみ）で守られているため、
 * ここは admin_users 登録者なら誰でも叩ける（キャッシュ無効化は無害）。
 */
export async function POST() {
  const ctx = await getAdminContext()
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    revalidateTag(DESIGN_TOKENS_CACHE_TAG, 'default')
    return NextResponse.json({ revalidated: true, tag: DESIGN_TOKENS_CACHE_TAG })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'revalidate failed' },
      { status: 500 }
    )
  }
}
