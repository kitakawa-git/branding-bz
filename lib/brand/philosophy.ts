// 理念中核要素（mission/vision/value/action_guideline）の取得ヘルパ。
// Step 1a で brand_guidelines の mission/vision(text)・values/action_guidelines(jsonb) を
// philosophy_elements（行）へ正規化した。読み取りは本ヘルパ経由に一本化し、repoint漏れと重複を防ぐ。
//
// dual-run中: brand_guidelines側の旧列/jsonbは残置（Step 6でDROP）。書き込み(編集UI)はStep 4まで旧jsonb。
// 返り値は旧データ形（values={name,description,added_index} / action_guidelines={title,description,added_index}）に
// 揃えてあるため、既存consumerは mission/vision/values/action_guidelines をそのまま差し替えられる。
//
// RLS: philosophy_elements は公開SELECT（card等の未認証表示用。brand_guidelines をミラー）。
//   呼び出し側の supabase クライアント（anon/authenticated/service_role いずれでも可）をそのまま渡す。
import type { SupabaseClient } from '@supabase/supabase-js'

export type PhilosophyValue = { name: string; description: string; added_index: number }
export type PhilosophyActionGuideline = { title: string; description: string; added_index: number }
export type Philosophy = {
  mission: string | null
  vision: string | null
  values: PhilosophyValue[]
  action_guidelines: PhilosophyActionGuideline[]
}

const EMPTY: Philosophy = { mission: null, vision: null, values: [], action_guidelines: [] }

type Row = { element_type: string; title: string | null; body: string | null; sort_order: number }

export async function fetchPhilosophy(supabase: SupabaseClient, companyId: string): Promise<Philosophy> {
  if (!companyId) return EMPTY
  const { data, error } = await supabase
    .from('philosophy_elements')
    .select('element_type, title, body, sort_order')
    .eq('company_id', companyId)
    .order('sort_order', { ascending: true })
  if (error) {
    console.error('[philosophy] 取得エラー:', error)
    return EMPTY
  }
  return rowsToPhilosophy((data as Row[]) || [])
}

// 既に取得済みの philosophy_elements 行配列から整形（複数社分の一括取得などで使う）。
export function rowsToPhilosophy(rows: Row[]): Philosophy {
  const sorted = [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  return {
    mission: sorted.find((r) => r.element_type === 'mission')?.body ?? null,
    vision: sorted.find((r) => r.element_type === 'vision')?.body ?? null,
    values: sorted
      .filter((r) => r.element_type === 'value')
      .map((r) => ({ name: r.title ?? '', description: r.body ?? '', added_index: r.sort_order ?? 0 })),
    action_guidelines: sorted
      .filter((r) => r.element_type === 'action_guideline')
      .map((r) => ({ title: r.title ?? '', description: r.body ?? '', added_index: r.sort_order ?? 0 })),
  }
}
