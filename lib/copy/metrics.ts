// コピーAI 決定論メトリクス（Q2: 事実は機械が測る。LLMに推定させない）。
// クリシェ密度・継承重複（コピペ検出）・数字の捏造を、依存ゼロのコードで計算する。
import { extractNumberValues, findUngroundedNumbers } from '@/lib/brand/profiling'

const compact = (s: string) => (s || '').replace(/\s/g, '')
// 先頭の '〜'（クリシェ辞書の '〜の最適化' 等）を外して部分一致できるようにする
const normTerm = (s: string) => (s || '').replace(/^[〜～]/, '').trim()

/**
 * クリシェ密度: bannedTerms（governance禁止語＋SHARED_CLICHE）を本文へ部分一致走査。
 * density = ヒットしたユニーク語数 / 文数（0-1にclamp）。ヒット語も返す（赤旗・surgical用）。
 */
export function computeClicheDensity(text: string, bannedTerms: string[]): { density: number; hits: string[] } {
  const body = text || ''
  const terms = Array.from(new Set(bannedTerms.map(normTerm).filter((t) => t.length >= 2)))
  const hits: string[] = []
  for (const t of terms) {
    if (body.includes(t)) hits.push(t)
  }
  const sentenceCount = Math.max(1, body.split(/[。．！!？?\n]+/).map((s) => s.trim()).filter(Boolean).length)
  const density = Math.min(1, hits.length / sentenceCount)
  return { density, hits: Array.from(new Set(hits)) }
}

const trigrams = (s: string): Set<string> => {
  const c = compact(s)
  const out = new Set<string>()
  if (c.length < 3) {
    if (c) out.add(c)
    return out
  }
  for (let i = 0; i <= c.length - 3; i++) out.add(c.slice(i, i + 3))
  return out
}

/**
 * 継承重複（コピペ検出）: Q2 マスク後 n-gram。
 *   1) quotablePhrases（communicatedAs承認語・スローガン）のうち6文字以上を text から物理消去（マスク）
 *   2) 残りテキストの文字tri-gram のうち INTENT文字列群に含まれる割合（overlap係数＝containment）を計算（0-1）
 *   3) マスク後の残テキストが実質空（< 8文字）なら overlap=1.0・blankAfterMask=true（白紙＝手抜き）
 * 注: 対称 Jaccard は「短いコピペ文 vs 大きいINTENTコーパス」をコーパスサイズで希釈し逐語コピペを検出できない
 *     （0に潰れる）ため、目的（draftがINTENTをどれだけ写したか）に合う overlap係数 |A∩B|/|A| を採用する。
 */
export function computeInheritanceOverlap(
  text: string,
  intentStrings: string[],
  quotablePhrases: string[],
): { overlap: number; blankAfterMask: boolean } {
  let masked = text || ''
  for (const p of quotablePhrases) {
    if (p && p.length >= 6) masked = masked.split(p).join('')
  }
  if (compact(masked).length < 8) return { overlap: 1.0, blankAfterMask: true }

  const intentCorpus = (intentStrings || []).join(' ')
  const A = trigrams(masked)
  const B = trigrams(intentCorpus)
  if (A.size === 0 || B.size === 0) return { overlap: 0, blankAfterMask: false }
  let inter = 0
  for (const g of A) if (B.has(g)) inter++
  const overlap = inter / A.size // draftのtri-gramのうちINTENT由来の割合（逐語コピペ→1.0に近づく）
  return { overlap, blankAfterMask: false }
}

/**
 * 数字の捏造: 本文中の「統計的な主張に見える数値（%・割・倍・ポイント単位）」を抽出し、
 * FACT（proof_points コーパス）に実在するか照合。FACTに無い値＝捏造として原文表記で返す。
 * 全角・桁区切りカンマ・万千は extractNumberValues / findUngroundedNumbers（profiling）で正規化照合。
 * ※ 付帯的な小数値（「1か月」「30名」等の非統計数）での誤検知を避けるため、強い統計単位に限定する。
 */
export function detectFabricatedNumbers(text: string, factText: string): string[] {
  const body = text || ''
  // 統計主張シェイプ: 数値（半角/全角・カンマ・小数）＋ 強い単位
  const re = /([0-9０-９][0-9０-９,，.．]*)\s*(%|％|割|倍|ポイント|pt)/g
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    const matched = m[0]
    const ung = findUngroundedNumbers([m[1]], factText) // m[1]の数値がfactに無ければ捏造
    if (ung.length > 0 && !out.includes(matched)) out.push(matched)
  }
  return out
}

// 参考: factText 側の数値集合（デバッグ・テスト補助）
export const factNumberSet = (factText: string): Set<string> => extractNumberValues(factText)
