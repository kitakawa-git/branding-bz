// 互換性のための既存エントリポイント
// 既存コードの `import { supabase } from '@/lib/supabase'` をそのまま動かすため、
// @supabase/ssr の createBrowserClient を内部で使う新クライアントを再エクスポート。
// createBrowserClient は multi-instance を内部で防いでいるので毎回呼んでも実質シングルトン。
import { createClient } from './supabase/client'

export const supabase = createClient()
