// 実行: npx tsx lib/brand-score/brand-data.test.ts
//
// fetchBrandData の出力は JSON.stringify されて、そのまま Claude への入力になる
// （サーベイ／クイズの generate-questions）。キーの並び・値の入り方が変わると
// 生成される設問が変わるので、出力の JSON 文字列をテストで固定する。
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchBrandData, hasSufficientData } from './brand-data'

type Result = { data: unknown; error: { message: string } | null }

/** テーブル名 → 返す結果。.single() は1行、それ以外は配列をそのまま返す偽クライアント */
function fakeSupabase(tables: Record<string, Result>): SupabaseClient {
  const builder = (table: string) => {
    const result = tables[table] ?? { data: null, error: { message: `no table ${table}` } }
    const b = {
      select: () => b,
      eq: () => b,
      order: () => b,
      single: async () => result,
      then: (resolve: (r: Result) => unknown) => resolve(result),
    }
    return b
  }
  return { from: builder } as unknown as SupabaseClient
}

async function main() {
  const supabase = fakeSupabase({
    companies: { data: { name: 'テスト株式会社' }, error: null },
    brand_guidelines: { data: { slogan: '育てる', traits: ['誠実'], brand_story: '物語' }, error: null },
    brand_personas: { data: [{ name: 'A', target: '中小企業', description: 'd', segmentation_data: null, positioning_map_data: null }], error: null },
    // 未登録（.single() が行なしでエラー）は結果に含めない
    brand_personalities: { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } },
    brand_visuals: { data: { color_palette: { primary: '#000' } }, error: null },
    brand_terms: { data: [], error: null },
    philosophy_elements: {
      data: [
        { element_type: 'mission', title: null, body: '使命', sort_order: 1 },
        { element_type: 'value', title: '誠実', body: '嘘をつかない', sort_order: 2 },
        { element_type: 'service', title: '支援', body: '伴走', sort_order: 3 },
      ],
      error: null,
    },
  })

  const data = await fetchBrandData(supabase, 'company-1')

  // Claude に渡る文字列そのもの（キー順を含めて固定）
  assert.equal(
    JSON.stringify(data),
    JSON.stringify({
      company: { name: 'テスト株式会社', slogan: '育てる' },
      guidelines: {
        slogan: '育てる',
        traits: ['誠実'],
        brand_story: '物語',
        mission: '使命',
        vision: undefined,
        values: [{ name: '誠実', description: '嘘をつかない', added_index: 2 }],
        business_content: [{ title: '支援', description: '伴走', added_index: 3 }],
      },
      personas: [{ name: 'A', target: '中小企業', description: 'd', segmentation_data: null, positioning_map_data: null }],
      visuals: { color_palette: { primary: '#000' } },
      terms: [],
    }),
  )
  assert.equal(hasSufficientData(data), true)

  // 何も登録が無い会社: philosophy 由来の guidelines だけが入り、十分性は false
  const empty = await fetchBrandData(fakeSupabase({ philosophy_elements: { data: [], error: null } }), 'company-2')
  assert.equal(
    JSON.stringify(empty),
    JSON.stringify({ guidelines: { mission: undefined, vision: undefined, values: [], business_content: [] } }),
  )
  assert.equal(hasSufficientData(empty), false)

  console.log('brand-data: all tests passed')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
