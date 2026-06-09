// アイコンサイズをモバイル基準に底上げするコードモッド（ポータル）。
// ・装飾インライン（いいね/コメント数・チェック・マーカー・リンク矢印など）≤13px → 14px
// ・操作系（編集Pencil・閉じるX）→ 16px
// ヘッダー24/ナビ18/空状態48 等の既に基準内のサイズは変更しない。
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.argv[2] || 'app/portal'

// 適用順に注意（Pencilを先に16へ。残りの11/12/13を14へ）
const RULES = [
  // 操作系（編集・削除・閉じる）は 16px に統一（先に処理）
  [/<Pencil size=\{1[234]\}/g, '<Pencil size={16}'],
  [/<Trash2 size=\{1[234]\}/g, '<Trash2 size={16}'],
  [/<X className="size-3"/g, '<X className="size-4"'], // 閉じる(12px) → 16px
  // 装飾インライン（数値横・チェック・マーカー等）は 14px に底上げ
  [/size=\{11\}/g, 'size={14}'],
  [/size=\{12\}/g, 'size={14}'],
  [/size=\{13\}/g, 'size={14}'],
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
  for (const [re, rep] of RULES) {
    out = out.replace(re, (m) => { hits++; return rep })
  }
  if (out !== src) { writeFileSync(file, out); files++; console.log('  ✓', file) }
}
console.log(`done: ${files} files, ${hits} replacements`)
