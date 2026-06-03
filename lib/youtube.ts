// YouTube URL ユーティリティ（YouTube Data API キー不要）
// - extractVideoId: 各種 URL 形式から 11 桁の動画 ID を抽出
// - getThumbnailUrl: 動画 ID からサムネイル URL を生成

// YouTube の動画 ID は 11 文字（英数・ハイフン・アンダースコア）
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/

/**
 * YouTube URL から動画 ID（11桁）を抽出する。
 * 対応形式:
 *   - https://www.youtube.com/watch?v=VIDEOID
 *   - https://youtu.be/VIDEOID
 *   - https://www.youtube.com/embed/VIDEOID
 *   - https://www.youtube.com/shorts/VIDEOID
 * 末尾のクエリ・タイムスタンプ等が付いていても抽出可能。
 * ID そのものが渡された場合もそのまま返す。
 * 抽出できない場合は null。
 */
export function extractVideoId(url: string): string | null {
  if (!url) return null
  const input = url.trim()

  // すでに ID 形式ならそのまま返す
  if (VIDEO_ID_RE.test(input)) return input

  // URL としてパースを試みる（スキーム無しにも対応）
  let u: URL | null = null
  try {
    u = new URL(input.includes('://') ? input : `https://${input}`)
  } catch {
    u = null
  }

  if (u) {
    const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '')
    const path = u.pathname

    // youtu.be/VIDEOID
    if (host === 'youtu.be') {
      const id = path.split('/').filter(Boolean)[0]
      if (id && VIDEO_ID_RE.test(id)) return id
    }

    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      // watch?v=VIDEOID
      const v = u.searchParams.get('v')
      if (v && VIDEO_ID_RE.test(v)) return v

      // /embed/VIDEOID, /shorts/VIDEOID, /v/VIDEOID, /live/VIDEOID
      const segments = path.split('/').filter(Boolean)
      if (segments.length >= 2 && ['embed', 'shorts', 'v', 'live'].includes(segments[0])) {
        const id = segments[1]
        if (id && VIDEO_ID_RE.test(id)) return id
      }
    }
  }

  // 最終フォールバック: よくあるパターンを正規表現で拾う
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /\/embed\/([A-Za-z0-9_-]{11})/,
    /\/shorts\/([A-Za-z0-9_-]{11})/,
  ]
  for (const re of patterns) {
    const m = input.match(re)
    if (m && m[1]) return m[1]
  }

  return null
}

/**
 * 動画 ID からサムネイル URL を生成（YouTube Data API キー不要）。
 */
export function getThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}
