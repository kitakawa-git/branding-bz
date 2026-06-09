// ポータルのページコンテナ下余白を pb-10(40px) に統一するコードモッド。
// コンテナパターン "px-5 pt-4 pb-{6,8}" → "px-5 pt-4 pb-10"。
// （px-5 py-10 の特殊2ページ、既に pb-10 のページは不変。カード p- は意図的なので対象外。）
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.argv[2] || 'app/portal'
const RULES = [
  [/px-5 pt-4 pb-6\b/g, 'px-5 pt-4 pb-10'],
  [/px-5 pt-4 pb-8\b/g, 'px-5 pt-4 pb-10'],
]

function walk(dir) {
  const out = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (p.endsWith('.tsx')) out.push(p)
  }
  return out
}

let files = 0, hits = 0
for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8')
  let out = src
  for (const [re, rep] of RULES) out = out.replace(re, (m) => { hits++; return rep })
  if (out !== src) { writeFileSync(file, out); files++; console.log('  ✓', file) }
}
console.log(`done: ${files} files, ${hits} replacements`)
