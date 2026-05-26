import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// in-memory mutex：トークンリフレッシュ等の直列化用
// Navigator LockManager (デフォルト) は稀に "lock timed out" を起こすため使わない。
// ただし完全無効化 (即実行) すると複数の auth refresh が並列で走り競合するため、
// シンプルな Promise キューで「同時に1つだけ」実行する。
let __authLock: Promise<unknown> = Promise.resolve()

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
      // 直前のロック取得処理が終わるのを待ってから自分の処理を実行する
      const previous = __authLock
      let release: () => void = () => {}
      __authLock = new Promise<void>((resolve) => { release = resolve })
      try {
        await previous.catch(() => {})
        return await fn()
      } finally {
        release()
      }
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'branding-bz-auth',
    flowType: 'implicit',
  },
})