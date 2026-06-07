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
     * 以下を除く全パスにマッチ:
     * - _next/static (静的ファイル)
     * - _next/image (画像最適化)
     * - favicon.ico
     * - sw.js / manifest.webmanifest / offline (PWA配信物・SWは認証不要)
     * - 拡張子付きの静的アセット (svg, png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|offline|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
