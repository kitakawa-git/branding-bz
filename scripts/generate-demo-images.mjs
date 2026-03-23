// デモ用のアバター画像（イニシャル入り）とロゴ画像（SVGベース）を生成
// 実行: node scripts/generate-demo-images.mjs

import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const avatarDir = path.join(__dirname, 'demo-images', 'avatars')
const logoDir = path.join(__dirname, 'demo-images', 'logos')

fs.mkdirSync(avatarDir, { recursive: true })
fs.mkdirSync(logoDir, { recursive: true })

// ── アバター定義 ──
const avatars = [
  // 企業1: テックブリッジ
  { slug: 'yamada-taro', initials: '山田', color: '#2563EB' },
  { slug: 'suzuki-hanako', initials: '鈴木', color: '#0EA5E9' },
  { slug: 'tanaka-ichiro', initials: '田中', color: '#3B82F6' },
  { slug: 'sato-misaki', initials: '佐藤', color: '#6366F1' },
  { slug: 'takahashi-kenta', initials: '高橋', color: '#1D4ED8' },
  { slug: 'ito-yuko', initials: '伊藤', color: '#7C3AED' },
  // 企業2: ナチュラルキッチン
  { slug: 'nakamura-kazuya', initials: '中村', color: '#16A34A' },
  { slug: 'watanabe-sakura', initials: '渡辺', color: '#22C55E' },
  { slug: 'kobayashi-daisuke', initials: '小林', color: '#15803D' },
  // 企業3: アーバンクラフト
  { slug: 'kimura-takuya', initials: '木村', color: '#6366F1' },
  { slug: 'matsumoto-akari', initials: '松本', color: '#8B5CF6' },
]

// ── ロゴ定義 ──
const logos = [
  {
    filename: 'techbridge.png',
    name: 'TechBridge',
    color: '#2563EB',
    icon: `<path d="M60 25 L80 45 L100 25" stroke="white" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
           <path d="M60 35 L80 55 L100 35" stroke="white" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>`,
  },
  {
    filename: 'natural-kitchen.png',
    name: 'Natural Kitchen',
    color: '#16A34A',
    icon: `<path d="M80 20 C80 20 60 35 60 50 C60 61 69 70 80 70 C91 70 100 61 100 50 C100 35 80 20 80 20Z" fill="white" opacity="0.9"/>
           <path d="M80 30 L80 60" stroke="#16A34A" stroke-width="2"/>
           <path d="M80 40 L72 34" stroke="#16A34A" stroke-width="2" stroke-linecap="round"/>
           <path d="M80 46 L88 40" stroke="#16A34A" stroke-width="2" stroke-linecap="round"/>`,
  },
  {
    filename: 'urbancraft.png',
    name: 'UrbanCraft',
    color: '#6366F1',
    icon: `<rect x="65" y="30" width="12" height="30" rx="2" fill="white" opacity="0.9"/>
           <rect x="83" y="20" width="12" height="40" rx="2" fill="white" opacity="0.7"/>
           <rect x="74" y="40" width="12" height="20" rx="2" fill="white" opacity="0.5"/>`,
  },
]

// ── アバター生成 ──
async function generateAvatar(slug, initials, color) {
  const size = 400
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${adjustColor(color, -30)};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#bg)"/>
      <text x="${size / 2}" y="${size / 2 + 10}"
            font-family="'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif"
            font-size="140" font-weight="700"
            fill="white" text-anchor="middle" dominant-baseline="central"
            opacity="0.95">${initials}</text>
    </svg>`
  const outputPath = path.join(avatarDir, `${slug}.jpg`)
  await sharp(Buffer.from(svg)).resize(400, 400).jpeg({ quality: 90 }).toFile(outputPath)
  console.log(`  avatar: ${slug}.jpg`)
}

// ── ロゴ生成 ──
async function generateLogo(logo) {
  const width = 320
  const height = 160
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logobg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${logo.color};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${adjustColor(logo.color, -25)};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" rx="16" fill="url(#logobg)"/>
      <g transform="translate(0, -10)">
        ${logo.icon}
      </g>
      <text x="${width / 2}" y="${height - 28}"
            font-family="'Inter', 'Helvetica Neue', sans-serif"
            font-size="22" font-weight="700" letter-spacing="1"
            fill="white" text-anchor="middle" opacity="0.95">${logo.name}</text>
    </svg>`
  const outputPath = path.join(logoDir, logo.filename)
  await sharp(Buffer.from(svg)).png().toFile(outputPath)
  console.log(`  logo: ${logo.filename}`)
}

// ── ヘルパー: 色を暗くする ──
function adjustColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, Math.min(255, (num >> 16) + amount))
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount))
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount))
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`
}

// ── メイン ──
async function main() {
  console.log('=== デモ画像生成 ===')
  console.log('アバター画像 (11枚):')
  for (const a of avatars) {
    await generateAvatar(a.slug, a.initials, a.color)
  }
  console.log('\nロゴ画像 (3枚):')
  for (const l of logos) {
    await generateLogo(l)
  }
  console.log('\n完了!')
}

main().catch(console.error)
