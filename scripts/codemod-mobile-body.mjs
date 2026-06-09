// C案コードモッド: ポータルの「本文段落」だけ スマホ16px/PC14px に。
// 対象行の条件: text-sm（単独class）かつ 読ませる指標(leading-[1.8/1.9] / leading-relaxed /
// whitespace-pre-line / whitespace-pre-wrap) を含む行。＝説明文・ストーリー等の段落本文。
// 見出し/ラベル/リンク/ボタン/バッジ（読ませる指標を持たない text-sm）は対象外。
// 変換: 行の最初の単独 text-sm → "text-base sm:text-sm"（既に sm:text-sm を含む行はスキップ＝冪等）。
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.argv[2] || 'app/portal'
const READING = /leading-\[1\.[89]\]|leading-relaxed|whitespace-pre-line|whitespace-pre-wrap/
// 先頭の単独 text-sm のみ（sm:text-sm / md:text-sm 等は前が ':' なので除外）
const FIRST_TEXT_SM = /(?<![:\w-])text-sm\b/

function walk(dir) {
  const out = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (p.endsWith('.tsx')) out.push(p)
  }
  return out
}

let files = 0, lines = 0
for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8')
  const newLines = src.split('\n').map(line => {
    if (!READING.test(line)) return line
    if (line.includes('sm:text-sm')) return line // 冪等ガード
    if (!FIRST_TEXT_SM.test(line)) return line
    lines++
    return line.replace(FIRST_TEXT_SM, 'text-base sm:text-sm')
  })
  const out = newLines.join('\n')
  if (out !== src) { writeFileSync(file, out); files++; console.log('  ✓', file) }
}
console.log(`done: ${files} files, ${lines} lines`)
