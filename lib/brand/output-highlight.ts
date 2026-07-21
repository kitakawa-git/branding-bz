// 出力テストの「オントロジー由来の語句」ハイライト（決定論・AI不使用）。
// 会社の要素テキスト（理念・提供価値・実績・スローガン等）からキーフレーズを集め、
// 生成結果との単純文字列一致で印を付ける。純関数のみ（DB・DOM・AIに依存しない）。

// 日本語の区切り記号・記号類。ここでタイトルを分割して「内包する固有語」を取り出す。
const DELIMITERS = /[\s、。，．・：:；;／/｜|（）()「」『』［］\[\]｛｝{}〈〉《》【】＜＞<>"'"'`~＝=＋+\-–—…!！?？*※#＃@＠^&]+/

const MIN_LEN = 4 // これ未満は一般語と衝突しやすいので拾わない
const MAX_PHRASES = 400 // 病的な入力での総当たり爆発を防ぐ上限

/**
 * 要素テキスト群から照合用キーフレーズを作る。
 * - タイトル等の全文（4文字以上）
 * - 区切りで分割した内包語（4文字以上）
 * 長い順に並べて返す（長いものを優先して非重複マッチするため）。
 */
export function collectKeyPhrases(sources: (string | null | undefined)[]): string[] {
  const set = new Set<string>()
  for (const raw of sources) {
    const s = (raw || '').replace(/\s+/g, ' ').trim()
    if (!s) continue
    if (s.length >= MIN_LEN) set.add(s)
    for (const part of s.split(DELIMITERS)) {
      const p = part.trim()
      if (p.length >= MIN_LEN) set.add(p)
    }
  }
  return Array.from(set)
    .sort((a, b) => b.length - a.length || a.localeCompare(b, 'ja'))
    .slice(0, MAX_PHRASES)
}

export type Segment = { text: string; hit: boolean }

/**
 * text を「一致した部分（hit=true）」と「それ以外」に分割する。
 * 左から走査し、その位置から始まる最長のフレーズを採用＝重複しない。
 * 一致が0件でも [{text, hit:false}] を返す（呼び出し側はそのまま描画できる）。
 */
export function highlightSegments(text: string, phrases: string[]): Segment[] {
  const src = text || ''
  if (!src) return []
  if (phrases.length === 0) return [{ text: src, hit: false }]

  const out: Segment[] = []
  let buf = ''
  let i = 0
  while (i < src.length) {
    let matched: string | null = null
    for (const p of phrases) {
      // phrases は長い順。最初に当たったものが最長一致。
      if (p.length <= src.length - i && src.startsWith(p, i)) {
        matched = p
        break
      }
    }
    if (matched) {
      if (buf) {
        out.push({ text: buf, hit: false })
        buf = ''
      }
      out.push({ text: matched, hit: true })
      i += matched.length
    } else {
      buf += src[i]
      i++
    }
  }
  if (buf) out.push({ text: buf, hit: false })
  return out
}
