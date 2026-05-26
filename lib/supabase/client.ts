// Client Component 用 Supabase クライアント
// @supabase/ssr の createBrowserClient は内部で cookie ベースのストレージを使う。
// Navigator LockManager 問題が原理的に発生しないため自前 lock 不要。
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
