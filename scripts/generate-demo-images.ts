import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const outputDir = path.join(__dirname, 'demo-images')
fs.mkdirSync(path.join(outputDir, 'avatars'), { recursive: true })
fs.mkdirSync(path.join(outputDir, 'logos'), { recursive: true })
fs.mkdirSync(path.join(outputDir, 'brand-assets'), { recursive: true })
fs.mkdirSync(path.join(outputDir, 'concept-visuals'), { recursive: true })

// ── アバター生成 ──
const avatars = [
  // 企業1: テックブリッジ（ブルー系）
  { slug: 'yamada-taro',       initials: '山田', color: '#2563EB' },
  { slug: 'suzuki-hanako',     initials: '鈴木', color: '#3B82F6' },
  { slug: 'tanaka-ichiro',     initials: '田中', color: '#1D4ED8' },
  { slug: 'sato-misaki',       initials: '佐藤', color: '#60A5FA' },
  { slug: 'takahashi-kenta',   initials: '高橋', color: '#2563EB' },
  { slug: 'ito-yuko',          initials: '伊藤', color: '#3B82F6' },
  // 企業2: ナチュラルキッチン（グリーン系）
  { slug: 'nakamura-kazuya',   initials: '中村', color: '#16A34A' },
  { slug: 'watanabe-sakura',   initials: '渡辺', color: '#22C55E' },
  { slug: 'kobayashi-daisuke', initials: '小林', color: '#15803D' },
  // 企業3: アーバンクラフト（パープル系）
  { slug: 'kimura-takuya',     initials: '木村', color: '#6366F1' },
  { slug: 'matsumoto-akari',   initials: '松本', color: '#818CF8' },
]

async function generateAvatar(slug: string, initials: string, bgColor: string) {
  const svg = `
    <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="400" rx="200" fill="${bgColor}"/>
      <text x="200" y="210" font-family="sans-serif" font-size="140" font-weight="bold"
            fill="white" text-anchor="middle" dominant-baseline="central">${initials}</text>
    </svg>`
  const outputPath = path.join(outputDir, 'avatars', `${slug}.jpg`)
  await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toFile(outputPath)
  console.log(`Generated avatar: ${slug}`)
}

// ── ロゴ生成 ──
const logos = [
  { filename: 'techbridge.png',      text: 'TB',  color: '#2563EB', bgColor: '#EFF6FF' },
  { filename: 'natural-kitchen.png', text: 'NK',  color: '#16A34A', bgColor: '#F0FDF4' },
  { filename: 'urbancraft.png',      text: 'UC',  color: '#6366F1', bgColor: '#EEF2FF' },
]

async function generateLogo(filename: string, text: string, textColor: string, bgColor: string) {
  const svg = `
    <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="400" rx="40" fill="${bgColor}"/>
      <rect x="40" y="40" width="320" height="320" rx="20" fill="${textColor}" opacity="0.1"/>
      <text x="200" y="210" font-family="sans-serif" font-size="160" font-weight="bold"
            fill="${textColor}" text-anchor="middle" dominant-baseline="central">${text}</text>
    </svg>`
  const outputPath = path.join(outputDir, 'logos', filename)
  await sharp(Buffer.from(svg)).png().toFile(outputPath)
  console.log(`Generated logo: ${filename}`)
}

// ── ブランドアセット画像生成 ──

// メインロゴ（横長 800×400）
async function generateMainLogo(filename: string, brandName: string, subText: string, primaryColor: string, bgColor: string) {
  const svg = `
    <svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="400" fill="${bgColor}"/>
      <rect x="40" y="80" width="240" height="240" rx="30" fill="${primaryColor}" opacity="0.1"/>
      <text x="160" y="210" font-family="sans-serif" font-size="120" font-weight="bold"
            fill="${primaryColor}" text-anchor="middle" dominant-baseline="central">${subText}</text>
      <text x="340" y="180" font-family="sans-serif" font-size="48" font-weight="bold"
            fill="${primaryColor}" text-anchor="start" dominant-baseline="central">${brandName}</text>
      <text x="340" y="240" font-family="sans-serif" font-size="18"
            fill="${primaryColor}" opacity="0.6" text-anchor="start" dominant-baseline="central">Brand Identity</text>
    </svg>`
  const outputPath = path.join(outputDir, 'brand-assets', filename)
  await sharp(Buffer.from(svg)).png().toFile(outputPath)
  console.log(`Generated brand asset: ${filename}`)
}

// ロゴ白抜き版（横長 800×400、ダーク背景）
async function generateWhiteLogo(filename: string, brandName: string, subText: string, primaryColor: string) {
  const svg = `
    <svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="400" fill="${primaryColor}"/>
      <rect x="40" y="80" width="240" height="240" rx="30" fill="white" opacity="0.15"/>
      <text x="160" y="210" font-family="sans-serif" font-size="120" font-weight="bold"
            fill="white" text-anchor="middle" dominant-baseline="central">${subText}</text>
      <text x="340" y="180" font-family="sans-serif" font-size="48" font-weight="bold"
            fill="white" text-anchor="start" dominant-baseline="central">${brandName}</text>
      <text x="340" y="240" font-family="sans-serif" font-size="18"
            fill="white" opacity="0.6" text-anchor="start" dominant-baseline="central">Brand Identity</text>
    </svg>`
  const outputPath = path.join(outputDir, 'brand-assets', filename)
  await sharp(Buffer.from(svg)).png().toFile(outputPath)
  console.log(`Generated brand asset: ${filename}`)
}

// ロゴアイコン版（正方形 400×400）
async function generateIconLogo(filename: string, subText: string, primaryColor: string, bgColor: string) {
  const svg = `
    <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="400" rx="60" fill="${bgColor}"/>
      <rect x="30" y="30" width="340" height="340" rx="40" fill="${primaryColor}" opacity="0.08"/>
      <rect x="60" y="60" width="280" height="280" rx="30" fill="${primaryColor}" opacity="0.06"/>
      <text x="200" y="210" font-family="sans-serif" font-size="160" font-weight="bold"
            fill="${primaryColor}" text-anchor="middle" dominant-baseline="central">${subText}</text>
    </svg>`
  const outputPath = path.join(outputDir, 'brand-assets', filename)
  await sharp(Buffer.from(svg)).png().toFile(outputPath)
  console.log(`Generated brand asset: ${filename}`)
}

// ロゴ使用例 Good（800×500）
async function generateUsageGood(filename: string, subText: string, primaryColor: string) {
  const svg = `
    <svg width="800" height="500" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="500" fill="#F9FAFB"/>
      <text x="400" y="40" font-family="sans-serif" font-size="20" font-weight="bold"
            fill="#16A34A" text-anchor="middle">✓ 正しい使用例</text>
      <!-- 使用例1: 十分な余白 -->
      <rect x="40" y="70" width="220" height="170" rx="12" fill="white" stroke="#E5E7EB" stroke-width="1"/>
      <rect x="70" y="100" width="80" height="80" rx="12" fill="${primaryColor}" opacity="0.1"/>
      <text x="110" y="145" font-family="sans-serif" font-size="40" font-weight="bold"
            fill="${primaryColor}" text-anchor="middle" dominant-baseline="central">${subText}</text>
      <text x="130" y="210" font-family="sans-serif" font-size="11" fill="#6B7280" text-anchor="middle">十分な余白を確保</text>
      <!-- 使用例2: 指定カラー -->
      <rect x="290" y="70" width="220" height="170" rx="12" fill="white" stroke="#E5E7EB" stroke-width="1"/>
      <rect x="340" y="100" width="80" height="80" rx="12" fill="${primaryColor}"/>
      <text x="380" y="145" font-family="sans-serif" font-size="40" font-weight="bold"
            fill="white" text-anchor="middle" dominant-baseline="central">${subText}</text>
      <text x="400" y="210" font-family="sans-serif" font-size="11" fill="#6B7280" text-anchor="middle">指定カラーの使用</text>
      <!-- 使用例3: 白背景 -->
      <rect x="540" y="70" width="220" height="170" rx="12" fill="white" stroke="#E5E7EB" stroke-width="1"/>
      <rect x="590" y="100" width="80" height="80" rx="12" fill="#F3F4F6"/>
      <text x="630" y="145" font-family="sans-serif" font-size="40" font-weight="bold"
            fill="${primaryColor}" text-anchor="middle" dominant-baseline="central">${subText}</text>
      <text x="650" y="210" font-family="sans-serif" font-size="11" fill="#6B7280" text-anchor="middle">明るい背景での使用</text>
      <!-- 下段：追加例 -->
      <rect x="40" y="270" width="340" height="190" rx="12" fill="white" stroke="#E5E7EB" stroke-width="1"/>
      <rect x="80" y="300" width="120" height="120" rx="16" fill="${primaryColor}" opacity="0.08"/>
      <text x="140" y="365" font-family="sans-serif" font-size="56" font-weight="bold"
            fill="${primaryColor}" text-anchor="middle" dominant-baseline="central">${subText}</text>
      <text x="260" y="345" font-family="sans-serif" font-size="13" fill="#374151" text-anchor="start">最小サイズ: 24px以上</text>
      <text x="260" y="370" font-family="sans-serif" font-size="13" fill="#374151" text-anchor="start">アイソレーション: ロゴ幅の25%</text>
      <rect x="420" y="270" width="340" height="190" rx="12" fill="white" stroke="#E5E7EB" stroke-width="1"/>
      <text x="590" y="365" font-family="sans-serif" font-size="13" fill="#374151" text-anchor="middle">縦横比を維持して配置</text>
      <rect x="520" y="300" width="140" height="70" rx="10" fill="${primaryColor}" opacity="0.1"/>
      <text x="590" y="340" font-family="sans-serif" font-size="32" font-weight="bold"
            fill="${primaryColor}" text-anchor="middle" dominant-baseline="central">${subText}</text>
    </svg>`
  const outputPath = path.join(outputDir, 'brand-assets', filename)
  await sharp(Buffer.from(svg)).png().toFile(outputPath)
  console.log(`Generated brand asset: ${filename}`)
}

// ロゴ使用例 Bad（800×500）
async function generateUsageBad(filename: string, subText: string, primaryColor: string) {
  const svg = `
    <svg width="800" height="500" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="500" fill="#F9FAFB"/>
      <text x="400" y="40" font-family="sans-serif" font-size="20" font-weight="bold"
            fill="#DC2626" text-anchor="middle">✗ 禁止事項</text>
      <!-- 禁止1: 変形 -->
      <rect x="40" y="70" width="220" height="170" rx="12" fill="white" stroke="#FCA5A5" stroke-width="1.5"/>
      <line x1="40" y1="70" x2="260" y2="240" stroke="#EF4444" stroke-width="2" opacity="0.3"/>
      <g transform="translate(110,130) scale(1.3,0.7)">
        <rect x="-30" y="-25" width="60" height="50" rx="8" fill="${primaryColor}" opacity="0.1"/>
        <text x="0" y="5" font-family="sans-serif" font-size="28" font-weight="bold"
              fill="${primaryColor}" text-anchor="middle" dominant-baseline="central">${subText}</text>
      </g>
      <text x="130" y="215" font-family="sans-serif" font-size="11" fill="#DC2626" text-anchor="middle">縦横比の変更</text>
      <!-- 禁止2: 色の変更 -->
      <rect x="290" y="70" width="220" height="170" rx="12" fill="white" stroke="#FCA5A5" stroke-width="1.5"/>
      <line x1="290" y1="70" x2="510" y2="240" stroke="#EF4444" stroke-width="2" opacity="0.3"/>
      <rect x="360" y="100" width="80" height="80" rx="12" fill="#FF69B4" opacity="0.2"/>
      <text x="400" y="145" font-family="sans-serif" font-size="40" font-weight="bold"
            fill="#FF69B4" text-anchor="middle" dominant-baseline="central">${subText}</text>
      <text x="400" y="215" font-family="sans-serif" font-size="11" fill="#DC2626" text-anchor="middle">指定外カラーの使用</text>
      <!-- 禁止3: 背景かぶり -->
      <rect x="540" y="70" width="220" height="170" rx="12" fill="${primaryColor}" stroke="#FCA5A5" stroke-width="1.5"/>
      <line x1="540" y1="70" x2="760" y2="240" stroke="#EF4444" stroke-width="2" opacity="0.3"/>
      <text x="650" y="145" font-family="sans-serif" font-size="40" font-weight="bold"
            fill="${primaryColor}" opacity="0.5" text-anchor="middle" dominant-baseline="central">${subText}</text>
      <text x="650" y="215" font-family="sans-serif" font-size="11" fill="white" text-anchor="middle">視認性の低い背景</text>
      <!-- 禁止4: 要素追加 -->
      <rect x="40" y="270" width="220" height="190" rx="12" fill="white" stroke="#FCA5A5" stroke-width="1.5"/>
      <line x1="40" y1="270" x2="260" y2="460" stroke="#EF4444" stroke-width="2" opacity="0.3"/>
      <rect x="100" y="310" width="80" height="80" rx="12" fill="${primaryColor}" opacity="0.1"/>
      <text x="140" y="355" font-family="sans-serif" font-size="40" font-weight="bold"
            fill="${primaryColor}" text-anchor="middle" dominant-baseline="central">${subText}</text>
      <text x="180" y="345" font-family="sans-serif" font-size="16" fill="#F59E0B">★</text>
      <text x="100" y="350" font-family="sans-serif" font-size="10" fill="#F59E0B">NEW!</text>
      <text x="130" y="425" font-family="sans-serif" font-size="11" fill="#DC2626" text-anchor="middle">装飾の追加</text>
      <!-- 禁止5: 回転 -->
      <rect x="290" y="270" width="220" height="190" rx="12" fill="white" stroke="#FCA5A5" stroke-width="1.5"/>
      <line x1="290" y1="270" x2="510" y2="460" stroke="#EF4444" stroke-width="2" opacity="0.3"/>
      <g transform="translate(400,350) rotate(25)">
        <rect x="-40" y="-30" width="80" height="60" rx="10" fill="${primaryColor}" opacity="0.1"/>
        <text x="0" y="5" font-family="sans-serif" font-size="32" font-weight="bold"
              fill="${primaryColor}" text-anchor="middle" dominant-baseline="central">${subText}</text>
      </g>
      <text x="400" y="425" font-family="sans-serif" font-size="11" fill="#DC2626" text-anchor="middle">ロゴの回転</text>
      <!-- 禁止6: 影・エフェクト -->
      <rect x="540" y="270" width="220" height="190" rx="12" fill="white" stroke="#FCA5A5" stroke-width="1.5"/>
      <line x1="540" y1="270" x2="760" y2="460" stroke="#EF4444" stroke-width="2" opacity="0.3"/>
      <rect x="610" y="310" width="80" height="80" rx="12" fill="${primaryColor}" opacity="0.1" filter="url(#shadow)"/>
      <defs><filter id="shadow"><feDropShadow dx="4" dy="4" stdDeviation="4" flood-color="${primaryColor}" flood-opacity="0.5"/></filter></defs>
      <text x="650" y="355" font-family="sans-serif" font-size="40" font-weight="bold"
            fill="${primaryColor}" text-anchor="middle" dominant-baseline="central" filter="url(#shadow)">${subText}</text>
      <text x="650" y="425" font-family="sans-serif" font-size="11" fill="#DC2626" text-anchor="middle">影・エフェクトの追加</text>
    </svg>`
  const outputPath = path.join(outputDir, 'brand-assets', filename)
  await sharp(Buffer.from(svg)).png().toFile(outputPath)
  console.log(`Generated brand asset: ${filename}`)
}

// ブランドイメージ（OG画像風 1200×630）
async function generateBrandImage(filename: string, brandName: string, subText: string, tagline: string, primaryColor: string, bgColor: string) {
  const svg = `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${bgColor}"/>
          <stop offset="100%" stop-color="white"/>
        </linearGradient>
        <radialGradient id="glow" cx="0.3" cy="0.4" r="0.6">
          <stop offset="0%" stop-color="${primaryColor}" stop-opacity="0.08"/>
          <stop offset="100%" stop-color="${primaryColor}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#bg-grad)"/>
      <rect width="1200" height="630" fill="url(#glow)"/>
      <!-- ロゴマーク -->
      <rect x="80" y="180" width="200" height="200" rx="40" fill="${primaryColor}" opacity="0.1"/>
      <text x="180" y="290" font-family="sans-serif" font-size="120" font-weight="bold"
            fill="${primaryColor}" text-anchor="middle" dominant-baseline="central">${subText}</text>
      <!-- ブランド名 -->
      <text x="340" y="270" font-family="sans-serif" font-size="64" font-weight="bold"
            fill="${primaryColor}" text-anchor="start" dominant-baseline="central">${brandName}</text>
      <!-- タグライン -->
      <text x="340" y="340" font-family="sans-serif" font-size="24"
            fill="${primaryColor}" opacity="0.6" text-anchor="start">${tagline}</text>
      <!-- 装飾ライン -->
      <rect x="80" y="460" width="1040" height="2" fill="${primaryColor}" opacity="0.15"/>
      <rect x="80" y="490" width="200" height="4" rx="2" fill="${primaryColor}" opacity="0.3"/>
    </svg>`
  const outputPath = path.join(outputDir, 'brand-assets', filename)
  await sharp(Buffer.from(svg)).png().toFile(outputPath)
  console.log(`Generated brand asset: ${filename}`)
}

// コンセプトビジュアル（CIマニュアルカバー 1200×630）
async function generateConceptVisual(filename: string, brandName: string, subText: string, tagline: string, primaryColor: string) {
  const svg = `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cv-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${primaryColor}"/>
          <stop offset="50%" stop-color="${primaryColor}" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="${primaryColor}" stop-opacity="0.7"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#cv-bg)"/>
      <!-- 装飾円 -->
      <circle cx="900" cy="200" r="250" fill="white" opacity="0.05"/>
      <circle cx="950" cy="250" r="180" fill="white" opacity="0.03"/>
      <!-- ロゴマーク -->
      <rect x="80" y="160" width="200" height="200" rx="40" fill="white" opacity="0.15"/>
      <text x="180" y="270" font-family="sans-serif" font-size="120" font-weight="bold"
            fill="white" text-anchor="middle" dominant-baseline="central">${subText}</text>
      <!-- テキスト -->
      <text x="340" y="240" font-family="sans-serif" font-size="56" font-weight="bold"
            fill="white" text-anchor="start">${brandName}</text>
      <text x="340" y="300" font-family="sans-serif" font-size="22"
            fill="white" opacity="0.7" text-anchor="start">${tagline}</text>
      <!-- CI Manual ラベル -->
      <text x="80" y="520" font-family="sans-serif" font-size="16" letter-spacing="6"
            fill="white" opacity="0.5">BRAND IDENTITY GUIDELINES</text>
      <rect x="80" y="540" width="160" height="2" fill="white" opacity="0.3"/>
    </svg>`
  const outputPath = path.join(outputDir, 'concept-visuals', filename)
  await sharp(Buffer.from(svg)).png().toFile(outputPath)
  console.log(`Generated concept visual: ${filename}`)
}

async function main() {
  // アバター
  for (const a of avatars) {
    await generateAvatar(a.slug, a.initials, a.color)
  }
  // ロゴ
  for (const l of logos) {
    await generateLogo(l.filename, l.text, l.color, l.bgColor)
  }

  // ── ブランドアセット画像 ──
  console.log('\n--- Brand Assets ---')

  // 企業1: テックブリッジ（6枚 + コンセプトビジュアル）
  await generateMainLogo('techbridge-logo-main.png', 'TechBridge', 'TB', '#2563EB', '#EFF6FF')
  await generateWhiteLogo('techbridge-logo-white.png', 'TechBridge', 'TB', '#2563EB')
  await generateIconLogo('techbridge-logo-icon.png', 'TB', '#2563EB', '#EFF6FF')
  await generateUsageGood('techbridge-logo-usage-good.png', 'TB', '#2563EB')
  await generateUsageBad('techbridge-logo-usage-bad.png', 'TB', '#2563EB')
  await generateBrandImage('techbridge-brand-image.png', 'TechBridge', 'TB', '地方から、日本のDXを加速する。', '#2563EB', '#EFF6FF')
  await generateConceptVisual('techbridge-concept.png', 'TechBridge', 'TB', '地方から、日本のDXを加速する。', '#2563EB')

  // 企業2: ナチュラルキッチン（2枚 + コンセプトビジュアル）
  await generateMainLogo('natural-kitchen-logo-main.png', 'Natural Kitchen', 'NK', '#16A34A', '#F0FDF4')
  await generateBrandImage('natural-kitchen-brand-image.png', 'Natural Kitchen', 'NK', '自然の恵みを、毎日の食卓に。', '#16A34A', '#F0FDF4')
  await generateConceptVisual('natural-kitchen-concept.png', 'Natural Kitchen', 'NK', '自然の恵みを、毎日の食卓に。', '#16A34A')

  // 企業3: アーバンクラフト（1枚 + コンセプトビジュアル）
  await generateMainLogo('urbancraft-logo-main.png', 'Urban Craft', 'UC', '#6366F1', '#EEF2FF')
  await generateConceptVisual('urbancraft-concept.png', 'Urban Craft', 'UC', '都市に、手仕事の温もりを。', '#6366F1')

  console.log('\nAll images generated!')
}

main()
