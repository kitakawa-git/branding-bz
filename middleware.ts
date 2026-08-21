// ルートmiddleware
// Supabase セッション cookie の維持と自動リフレッシュだけを行う。
// リダイレクト制御は各 Provider に任せる（今回はセッション維持のみが目的）。
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * ⚠️ ログインが要る経路だけに絞る。
     *
     * 以前は「静的アセット以外の全パス」にマッチさせていた。updateSession() は
     * Supabase Auth への HTTP 往復を含みうるため、外部が一度ハングすると
     * middleware ごと詰まり、公開ページまで巻き込んで Vercel の 25 秒上限を超える。
     * 2026-08-21 15:09 JST にサイト全体が 504（MIDDLEWARE_INVOCATION_TIMEOUT）に
     * なったのがこれ。公開ページはセッションを見ないので、通す必要がそもそも無い。
     */
    '/admin/:path*',
    '/superadmin/:path*',
    '/portal/:path*',
    '/mypage/:path*',

    /*
     * API は cookie セッションを読むものがあるので通す。ただし次は除く。
     * いずれも「cookie を持たない呼び出し」で、middleware を通す意味が無いため:
     * - cron       Vercel Cron からの呼び出し
     * - card-view  公開名刺ページからの記録。閲覧者はログインしていない
     * - analytics  同上（滞在時間・印象タグの記録）
     *
     * ※ @supabase/ssr の getUser() はセッション cookie が無ければ
     *   AuthSessionMissingError を即返し、ネットワーク往復をしない。
     *   つまり未ログインの訪問者は元々 Auth を叩いていないので、
     *   この除外は負荷対策ではなく「無駄な処理を挟まない」だけの意味。
     *   除外してもリクエストの cookie は載ったままなので、各ルート側で
     *   セッションを読む処理は従来どおり動く（更新されないだけ）。
     */
    '/api/((?!cron|card-view|analytics).*)',
  ],
}
