// 管理画面のブランド編集ページ（guidelines / personality / verbal / visuals）が使う、
// Supabase REST API を直接叩く PATCH / INSERT（10秒タイムアウト付き）。
// 4ページに同じ関数が複製されていたものを1つにまとめた。
// ※ app/admin/company/page.tsx の同名関数はトークンの取り方・応答の形が違うため別のまま。
// クライアントから呼ぶ（token はログイン中ユーザーの access_token。RLS で権限を判定する）。

// Supabase REST API直接fetch (PATCH)
export async function supabasePatch(table: string, id: string, data: Record<string, unknown>, token: string): Promise<{ ok: boolean; error?: string }> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        'Authorization': `Bearer ${token}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!res.ok) {
      const body = await res.text()
      return { ok: false, error: `HTTP ${res.status}: ${body}` }
    }
    return { ok: true }
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, error: 'タイムアウト（10秒）' }
    }
    return { ok: false, error: err instanceof Error ? err.message : '不明なエラー' }
  }
}

// Supabase REST API直接fetch (INSERT)。作成した行を返す（Prefer: return=representation）
export async function supabaseInsert(table: string, data: Record<string, unknown>, token: string): Promise<{ ok: boolean; error?: string; data?: Record<string, unknown> }> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        'Authorization': `Bearer ${token}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!res.ok) {
      const body = await res.text()
      return { ok: false, error: `HTTP ${res.status}: ${body}` }
    }
    const result = await res.json()
    return { ok: true, data: result[0] }
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, error: 'タイムアウト（10秒）' }
    }
    return { ok: false, error: err instanceof Error ? err.message : '不明なエラー' }
  }
}
