// middleware 用ヘルパー
// getUser() を呼ぶことで Supabase が cookie 内のトークンを検証＆必要なら自動リフレッシュする。
// これが「放置後の遷移フリーズ」を根本解決する仕組み。
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
  await supabase.auth.getUser()

  return supabaseResponse
}
