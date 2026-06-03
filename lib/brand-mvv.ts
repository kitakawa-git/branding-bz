// Mission / Vision のテキストを「コピー（先頭段落）」と「説明文（残り）」に分割するユーティリティ。
//
// brand_guidelines.mission / .vision は、先頭にキャッチコピー、1行空けて説明文、という
// 構造で保存されている（コピーと説明文は空行 \n\n で区切られる）。
// 表示側でこの空行を境にコピーと説明文を別スタイルで描画するために使う。
//
// 空行が無い旧データ・短いテキストは全文をコピー扱いにフォールバック（従来表示と同じ）。

export type BrandCopy = {
  copy: string // 先頭段落（キャッチコピー）
  body: string // 残り（説明文）。内部の単一改行は whitespace-pre-line で保持する想定
}

export function splitBrandCopy(text: string | null | undefined): BrandCopy {
  const raw = (text ?? '').trim()
  if (!raw) return { copy: '', body: '' }

  // 最初の空行（連続改行）で2分割する
  const m = raw.match(/\n\s*\n/)
  if (!m || m.index === undefined) return { copy: raw, body: '' }

  return {
    copy: raw.slice(0, m.index).trim(),
    body: raw.slice(m.index + m[0].length).trim(),
  }
}

// 編集フォームで分けて入力された「コピー」と「説明文」を、保存用の1テキストに結合する。
// 両方あれば空行（\n\n）で連結。片方だけならそのまま。両方空なら空文字。
// splitBrandCopy の逆操作（copy に空行が無い限りラウンドトリップが安定する）。
export function combineBrandCopy(copy: string | null | undefined, body: string | null | undefined): string {
  const c = (copy ?? '').trim()
  const b = (body ?? '').trim()
  if (c && b) return `${c}\n\n${b}`
  return c || b
}
