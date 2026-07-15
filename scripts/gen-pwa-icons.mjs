// ファビコン / PWAアイコン生成スクリプト（sharp使用）
// 実行: node scripts/gen-pwa-icons.mjs
//
// 素材（正本）: public/logo-mark.png
//   北川さん提供の bz マーク画像（1024x1024・濃グレー背景 #222222 ＋白マーク・全面塗り）。
//   以前はこのスクリプト内でベクターパスから描画していたが、提供画像を正本にする方針に変更した。
//   マークの形や色を変えるときは public/logo-mark.png を差し替えて本スクリプトを再実行する。
//
// 出力:
//   public/icons/icon-192.png          (manifest purpose:any)
//   public/icons/icon-512.png          (manifest purpose:any)
//   public/icons/icon-maskable-512.png (manifest purpose:maskable ＝OSがマスクするので全面塗り)
//   app/apple-icon.png                 (180・iOS。iOS側が角丸マスクするので全面塗り)
//   app/icon.png                       (ファビコン。Next.js の app/icon.* 規約)
//   app/favicon.ico                    (64・PNG-in-ICO。/favicon.ico を直接叩く古い経路向け)
//
// 注: 素材が全面塗り（角丸なし）のため、purpose:any も角丸なしの正方形になる。
//     iOS/Android はホーム画面で自動的にマスクするため実害はない。
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'

const SRC = 'public/logo-mark.png'

async function png(size, outPath) {
  await sharp(SRC).resize(size, size, { fit: 'cover' }).png().toFile(outPath)
  console.log('  ✓', outPath, `(${size}x${size})`)
}

// PNG を ICO コンテナに包む（PNG-in-ICO。モダンブラウザは全て対応）
async function ico(size, outPath) {
  const body = await sharp(SRC).resize(size, size, { fit: 'cover' }).png().toBuffer()
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: 1=icon
  header.writeUInt16LE(1, 4) // image count
  const entry = Buffer.alloc(16)
  entry.writeUInt8(size >= 256 ? 0 : size, 0) // width (0=256)
  entry.writeUInt8(size >= 256 ? 0 : size, 1) // height
  entry.writeUInt8(0, 2) // palette colors
  entry.writeUInt8(0, 3) // reserved
  entry.writeUInt16LE(1, 4) // color planes
  entry.writeUInt16LE(32, 6) // bits per pixel
  entry.writeUInt32LE(body.length, 8) // image size
  entry.writeUInt32LE(header.length + entry.length, 12) // offset
  await writeFile(outPath, Buffer.concat([header, entry, body]))
  console.log('  ✓', outPath, `(${size}x${size} PNG-in-ICO)`)
}

await mkdir('public/icons', { recursive: true })

await png(192, 'public/icons/icon-192.png')
await png(512, 'public/icons/icon-512.png')
await png(512, 'public/icons/icon-maskable-512.png')
await png(180, 'app/apple-icon.png')
await png(512, 'app/icon.png')
await ico(64, 'app/favicon.ico')

console.log('done')
