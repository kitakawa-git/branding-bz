// ページデータキャッシュ: ページ遷移時のスケルトン表示を回避
// モジュールレベルで保持 → クライアントサイド遷移間で永続
//
// persist: true を付けたキーは sessionStorage にも保存し、再読込（PWA の引っ張り更新を含む）の後も
// 前回の内容をすぐ表示できるようにする（表示した後に各ページが最新を取り直して差し替える）。
// - sessionStorage はタブ（PWA ならアプリ）単位で、閉じると消える。ログアウト時は clearAllPageCache で全消去
// - 保存できるのは JSON にできる値だけ（Date・Map・Set・関数は不可）。persist を付けるときは型を確認すること
// - 保存に失敗しても（容量超過・プライベートモード等）メモリのキャッシュは効く
const cache = new Map<string, unknown>()
const STORAGE_PREFIX = 'bz-page-cache:'

type Options = { persist?: boolean }

export function getPageCache<T>(key: string, options?: Options): T | null {
  if (cache.has(key)) return (cache.get(key) as T) ?? null
  if (options?.persist && typeof window !== 'undefined') {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_PREFIX + key)
      if (raw) {
        const data = JSON.parse(raw) as T
        cache.set(key, data)
        return data
      }
    } catch {
      // 読めなければキャッシュ無し扱い
    }
  }
  return null
}

export function setPageCache<T>(key: string, data: T, options?: Options): void {
  cache.set(key, data)
  if (options?.persist && typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data))
    } catch {
      // 保存できなくてもメモリのキャッシュは効く
    }
  }
}

// 指定キーのキャッシュを無効化（別画面の同データキャッシュを保存直後に消したい時に使用）
export function clearPageCache(key: string): void {
  cache.delete(key)
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(STORAGE_PREFIX + key)
    } catch {
      // noop
    }
  }
}

// すべてのキャッシュを消す（ログアウト時。別のユーザーに前のユーザーのデータが見えないように）
export function clearAllPageCache(): void {
  cache.clear()
  if (typeof window !== 'undefined') {
    try {
      const ss = window.sessionStorage
      for (let i = ss.length - 1; i >= 0; i--) {
        const k = ss.key(i)
        if (k?.startsWith(STORAGE_PREFIX)) ss.removeItem(k)
      }
    } catch {
      // noop
    }
  }
}
