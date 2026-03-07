import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Navigator LockManager を無効化（lock timed out エラー回避）
    lock: async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => await fn(),
    storageKey: 'branding-bz-auth',
    flowType: 'implicit',
  },
})