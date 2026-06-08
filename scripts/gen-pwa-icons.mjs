// PWAアイコン生成スクリプト（sharp使用）
// 素材: public/logo.svg 左側のブランドマーク（2三角形・ベクターパス＝フォント非依存）
// 出力:
//   public/icons/icon-192.png         (purpose any・角丸)
//   public/icons/icon-512.png         (purpose any・角丸)
//   public/icons/icon-maskable-512.png(purpose maskable・全面塗り＝OSがマスク)
//   app/apple-icon.png                (180・iOS用・全面塗り)
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

// 白黒反転版：白背景＋濃いマーク
const BG = '#ffffff'
const FG = '#1a1a1a'

// ブランドマーク（logo.svg のマーク部分。元bbox x:0-112 / y:25.791-95）
const MARK = `
  <path d="M69.2093 95L112 95L112 52.2093L69.2093 95Z"/>
  <path d="M69.2093 25.791L0 25.791L-1.21009e-05 95.0003L69.2093 25.791Z"/>
`
const MARK_W = 112
const MARK_H = 69.209 // 95 - 25.791
const MARK_Y0 = 25.791

// 正方形キャンバスにマークを中央配置するSVGを生成
// fill=マーク占有率（キャンバス幅に対する比）、rounded=角丸有無
function buildSvg(size, fill, rounded) {
  const markW = size * fill
  const scale = markW / MARK_W
  const markH = MARK_H * scale
  const tx = (size - markW) / 2
  const ty = (size - markH) / 2 - MARK_Y0 * scale
  const rx = rounded ? Math.round(size * 0.1875) : 0 // 角丸=18.75%（iOS風）
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="${BG}"/>
  <g transform="translate(${tx} ${ty}) scale(${scale})" fill="${FG}">${MARK}</g>
</svg>`
}

async function render(svg, size, outPath) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outPath)
  console.log('  ✓', outPath)
}

await mkdir('public/icons', { recursive: true })

// purpose any（角丸・マーク55%）
await render(buildSvg(512, 0.55, true), 192, 'public/icons/icon-192.png')
await render(buildSvg(512, 0.55, true), 512, 'public/icons/icon-512.png')
// purpose maskable（全面塗り・マーク42%＝セーフゾーン内）
await render(buildSvg(512, 0.42, false), 512, 'public/icons/icon-maskable-512.png')
// apple-touch（全面塗り・マーク50%。iOSが角丸処理）
await render(buildSvg(512, 0.5, false), 180, 'app/apple-icon.png')

console.log('done')
