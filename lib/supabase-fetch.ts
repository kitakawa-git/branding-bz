// Supabase クエリをタイムアウト＋リトライ付きで実行するユーティリティ

const TIMEOUT_MS = 6000   // 6秒（旧15秒 → 短縮）
const MAX_RETRIES = 1     // 1回まで（旧2回 → 短縮、最悪 6+0.5+6=12.5秒）

type SupabaseResult<T> = {
  data: T | null
  error: { message: string } | null
}

export async function fetchWithRetry<T>(
  queryFn: () => PromiseLike<SupabaseResult<T>>,
  retryCount = 0
): Promise<{ data: T | null; error: string | null }> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  try {
    const result = await Promise.race([
      queryFn(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)
      }),
    ])

    // クエリが先に解決したらタイムアウトをクリア（setTimeout リーク防止）
    if (timeoutId) clearTimeout(timeoutId)

    if (result.error) {
      throw new Error(result.error.message)
    }

    return { data: result.data, error: null }
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId)

    const attempt = retryCount + 1
    const msg = err instanceof Error ? err.message : 'unknown'
    console.error(`[fetchWithRetry] エラー (試行${attempt}/${MAX_RETRIES + 1}): ${msg}`)

    if (retryCount < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 500 * attempt))  // 0.5秒バックオフ
      return fetchWithRetry(queryFn, retryCount + 1)
    }

    const errorMsg = msg === 'timeout'
      ? 'データの取得がタイムアウトしました。再読み込みをお試しください。'
      : 'データの取得に失敗しました'

    return { data: null, error: errorMsg }
  }
}
