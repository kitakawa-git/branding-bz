// middleware 用ヘルパー
// getUser() を呼ぶことで Supabase が cookie 内のトークンを検証＆必要なら自動リフレッシュする。
// これが「放置後の遷移フリーズ」を根本解決する仕組み。
//
// ⚠️ ここは matcher に載った全リクエストの前段で動く。getUser() は Supabase Auth への
//    HTTP 往復を含むので、素で await すると外部が詰まったときに middleware ごと詰まり、
//    Vercel の 25 秒上限を超えてサイト全体が 504（MIDDLEWARE_INVOCATION_TIMEOUT）になる。
//    2026-08-21 15:09 JST に実際に発生した（hnd1::knrsh-1787292599032）。
//
//    このとき Supabase Auth 自体は正常だった。edge_logs の実測では障害時刻の
//    /auth/v1/user が avg 122ms / max 160ms、24時間集計でも n=2723・p50 0ms・
//    p99 71ms・max 161ms。リクエストが Supabase に到達した形跡がログに無いため、
//    Vercel edge → Supabase 間の一時的なハングと見ている。
//    原因側はこちらで制御できない。塞ぐべきは「1回の外部通信のハングが
//    サイト全域の 504 に増幅される構造」のほうなので、短いタイムアウトを付けて
//    失敗しても素通りさせる。
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * getUser() に許す時間。これを超えたらセッション更新を諦めてページを返す。
 *
 * 4秒は実測に対する余裕から決めた。/auth/v1/user は p99 71ms・max 161ms
 * （24時間・n=2723）なので約25倍の余裕がある。延ばしても正常時の待ち時間は
 * 変わらず、ハング時の失敗検知が遅くなるだけなので短めに置く。
 */
const AUTH_TIMEOUT_MS = 4000

/**
 * 時間切れで接続を中断するシグナル。
 * AbortSignal.timeout が無い実行環境では undefined を返し、呼び出し側で
 * 元の signal に委ねる（下の Promise.race が最後の砦になる）
 */
function timeoutSignal(): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
    ? AbortSignal.timeout(AUTH_TIMEOUT_MS)
    : undefined
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // 接続そのものを打ち切る。Promise を放置するだけだと通信は生き続け、
      // Edge の実行時間を食い続けてしまう。
      // タイムアウトを作れない環境では supabase-js 側の signal を潰さないよう素通しする
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, signal: timeoutSignal() ?? init?.signal }),
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 必ず getUser() を呼ぶ（getSession ではない）。
  // getUser はサーバーに問い合わせるので期限切れトークンが自動リフレッシュされる。
  //
  // 上の AbortSignal に加えて Promise.race も掛ける。abort が効かない経路
  // （DNS で止まる等）でも、ここで必ず待つのをやめられるようにするため。
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      supabase.auth.getUser(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('auth timeout')),
          AUTH_TIMEOUT_MS + 500
        )
      }),
    ])
  } catch (e) {
    // 更新できなくても公開ページは落とさない。
    // 期限切れのままのトークンは、この後のページ／API 側の getUser() が扱う
    console.error(
      '[middleware] セッション更新をスキップ:',
      e instanceof Error ? e.message : e
    )
  } finally {
    // race に勝っても敗者のタイマーは残る。放置すると Edge の実行時間を食う
    // （このファイルの冒頭に書いた「放置しても死なない」と同じ話）
    if (timer) clearTimeout(timer)
  }

  return supabaseResponse
}
