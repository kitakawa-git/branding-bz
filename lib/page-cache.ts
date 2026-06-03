// ページデータキャッシュ: ページ遷移時のスケルトン表示を回避
// モジュールレベルで保持 → クライアントサイド遷移間で永続
const cache = new Map<string, unknown>()

export function getPageCache<T>(key: string): T | null {
  return (cache.get(key) as T) ?? null
}

export function setPageCache<T>(key: string, data: T): void {
  cache.set(key, data)
}
