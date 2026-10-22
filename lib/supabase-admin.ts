// サーバーサイド専用: サービスロールキーでSupabaseクライアントを作成
// ※ API Route内でのみ使用（クライアントサイドでは絶対に使わない）
// server-only: 'use client' 側から import されたらビルドで止める。
//   tsx で scripts/ から使うときは `npx tsx --conditions=react-server scripts/xxx.ts` で実行する
import 'server-only'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// 遅延初期化（ビルド時にSUPABASE_SERVICE_ROLE_KEYが未設定でもエラーにならない）
let _supabaseAdmin: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY が設定されていません。.env.local に追加してください。'
      )
    }

    _supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return _supabaseAdmin
}
