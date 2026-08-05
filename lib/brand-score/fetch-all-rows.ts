// PostgREST の行数上限を越えて全行を取得するヘルパー
// ============================================================
// Supabase(PostgREST) は 1 リクエストあたりの返却行数に上限がある（既定 1000）。
// 上限を意識せず .select() すると、超過分が黙って切り捨てられ、
// 集計が「先頭 1000 行だけの値」になる。件数もエラーも返らないため気づけない。
//
// 実例: Googleフォーム取り込み（243名 × 30問 = 7,290行）で
//       インナースコアが先頭1000行だけで算出され、実際と約1.1pt ずれた。
//
// 使い方はクエリを毎回生成するサンク（関数）を渡す。ビルダは使い回すと
// range が上書きされて壊れるため、意図的にサンクを要求している。
// ============================================================

/** 1 ページあたりの取得件数（PostgREST 既定の上限と同じ） */
const PAGE_SIZE = 1000

/** range() を持つ最小限のクエリ型（Supabase のビルダを想定） */
type RangeableQuery<T> = {
  range: (from: number, to: number) => PromiseLike<{
    data: T[] | null
    error: { message: string } | null
  }>
}

/**
 * ページングしながら全行を取得する。
 *
 * @param makeQuery ページごとに新しいクエリビルダを返す関数
 * @example
 *   const { data, error } = await fetchAllRows(() =>
 *     supabase.from('brand_survey_responses').select('question_id, score').eq('survey_id', id)
 *   )
 */
export async function fetchAllRows<T>(
  makeQuery: () => RangeableQuery<T>
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const all: T[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await makeQuery().range(from, from + PAGE_SIZE - 1)

    if (error) return { data: null, error }

    const rows = data ?? []
    all.push(...rows)

    // 1ページ分に満たなければ最終ページ
    if (rows.length < PAGE_SIZE) break
  }

  return { data: all, error: null }
}
