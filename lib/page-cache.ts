// ページデータキャッシュ: ページ遷移時のスケルトン表示を回避
// モジュールレベルで保持 → クライアントサイド遷移間で永続
//
// persist: true を付けたキーは sessionStorage にも保存し、再読込（PWA の引っ張り更新を含む）の後も
// 前回の内容をすぐ表示できるようにする。
//
// キャッシュは2種類ある:
// - fresh: このページ読み込み（JS の起動）以降に取得して setPageCache したもの。
//   各ページの「キャッシュがあれば取り直さない」判定（getPageCache(key) が値を返したら fetch しない）はこれだけを見る
// - stale: 再読込より前に sessionStorage に保存されていたもの。getPageCache(key, { persist: true }) のときだけ返す。
//   表示用の初期値には使うが、上の判定では「無い」扱いになるので、再読込後は必ず最新を取り直す
//   （引っ張り更新しても古い内容のまま、にならない）
//
// - sessionStorage はタブ（PWA ならアプリ）単位で、閉じると消える。ログアウト時は clearAllPageCache で全消去
// - 保存できるのは JSON にできる値だけ（Date・Map・Set・関数は不可）。persist を付けるときは型を確認すること
// - 保存に失敗しても（容量超過・プライベートモード等）メモリのキャッシュは効く
const cache = new Map<string, unknown>()
const stale = new Map<string, unknown>()
const STORAGE_BASE = 'bz-page-cache:'
// デプロイごとに保存先を分ける。キャッシュの形が変わった新しいコードが、古い形の保存分を読んで壊れないように
const STORAGE_PREFIX = `${STORAGE_BASE}${process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev'}:`

// 前のデプロイの保存分を片付ける（初回に1度だけ）
let sweptOldVersions = false
function sweepOldVersions() {
  if (sweptOldVersions || typeof window === 'undefined') return
  sweptOldVersions = true
  try {
    const ss = window.sessionStorage
    for (let i = ss.length - 1; i >= 0; i--) {
      const k = ss.key(i)
      if (k?.startsWith(STORAGE_BASE) && !k.startsWith(STORAGE_PREFIX)) ss.removeItem(k)
    }
  } catch {
    // noop
  }
}

type Options = { persist?: boolean }

export function getPageCache<T>(key: string, options?: Options): T | null {
  if (cache.has(key)) return (cache.get(key) as T) ?? null
  if (!options?.persist) return null
  if (stale.has(key)) return (stale.get(key) as T) ?? null
  if (typeof window === 'undefined') return null
  sweepOldVersions()
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + key)
    if (raw) {
      const data = JSON.parse(raw) as T
      // 描画のたびに JSON.parse しないよう覚えておく（fresh とは別に持つ）
      stale.set(key, data)
      return data
    }
  } catch {
    // 読めなければキャッシュ無し扱い
  }
  return null
}

export function setPageCache<T>(key: string, data: T, options?: Options): void {
  cache.set(key, data)
  stale.delete(key)
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
  stale.delete(key)
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
  stale.clear()
  if (typeof window !== 'undefined') {
    try {
      const ss = window.sessionStorage
      for (let i = ss.length - 1; i >= 0; i--) {
        const k = ss.key(i)
        if (k?.startsWith(STORAGE_BASE)) ss.removeItem(k)
      }
    } catch {
      // noop
    }
  }
}
