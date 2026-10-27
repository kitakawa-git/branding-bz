// 会社・チーム目標とチームを書き込む API（app/api/goals・app/api/teams）を画面から呼ぶ。
// 認証は cookie セッション（同一オリジンの fetch は cookie を送る）。失敗時は API の文言で Error を投げる
export async function goalsApi<T = unknown>(path: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: string }).error || `HTTP ${res.status}`)
  return json as T
}
