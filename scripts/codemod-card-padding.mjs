// ポータルのコンテンツ/セクションカードのパディングをスマホ16pxに（p-5 → p-4 sm:p-5）。
// 対象: <CardContent className="p-5"> と <CardContent className="p-5 space-y-*">。
// 除外: p-5 pb-3 / p-5 pb-0（下余白の独自指定があり sm: との順序で挙動が変わるため据え置き）。
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.argv[2] || 'app/portal'
// 直後が '"' か ' space-y' のときだけ p-5 → p-4 sm:p-5（pb-3/pb-0 は除外）
const RE = /<CardContent className="p-5(?=("| space-y))/g

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
  const out = src.replace(RE, (m) => { hits++; return '<CardContent className="p-4 sm:p-5' })
  if (out !== src) { writeFileSync(file, out); files++; console.log('  ✓', file) }
}
console.log(`done: ${files} files, ${hits} replacements`)
