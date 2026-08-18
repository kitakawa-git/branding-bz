// 用語wiki の詳細定義（wiki_terms.long_def）のパーサ。
//
// long_def は Cowork 側で生成された制約の強い Markdown で、実際に使われている記法は
// 「### 見出し」と素の段落だけ（230語を実測: 箇条書き・太字・リンク・表・コードは0件）。
// そのためライブラリを足さず自前で分解し、React 要素として描画する。
// 文字列を dangerouslySetInnerHTML に渡さない＝XSS の余地が構造的に無い。

export type LongDefSection = {
  /** 見出しのアンカー id。見出しが日本語なので連番で安定させる。
      ページ内目次は廃止したが、外から特定の節を直接指せるよう id は残す */
  id: string
  heading: string
  paragraphs: string[]
}

/**
 * long_def を「見出し + 段落群」に分解する。
 * 見出しが1つも無い旧データ（プレーンテキスト）は sections=[] で返し、
 * 呼び出し側は intro をそのまま段落として描画すればよい。
 */
export function parseLongDef(longDef: string): {
  /** 最初の見出しより前にある本文（見出し無しの旧データはここに全部入る） */
  intro: string[]
  sections: LongDefSection[]
} {
  const intro: string[] = []
  const sections: LongDefSection[] = []

  // 改行コードを正規化してから行単位で走査する
  const lines = longDef.replace(/\r\n?/g, '\n').split('\n')
  let current: LongDefSection | null = null
  let buffer: string[] = []

  const flush = () => {
    const text = buffer.join('\n').trim()
    buffer = []
    if (!text) return
    // 空行区切りで段落に割る
    for (const p of text.split(/\n{2,}/)) {
      const paragraph = p.trim()
      if (!paragraph) continue
      if (current) current.paragraphs.push(paragraph)
      else intro.push(paragraph)
    }
  }

  for (const line of lines) {
    const m = line.match(/^###\s+(.+?)\s*$/)
    if (m) {
      flush()
      current = { id: `sec-${sections.length + 1}`, heading: m[1], paragraphs: [] }
      sections.push(current)
      continue
    }
    buffer.push(line)
  }
  flush()

  return { intro, sections }
}
