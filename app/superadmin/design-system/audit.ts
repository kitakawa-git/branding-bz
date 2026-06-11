// デザインシステム画面の「実測」ロジック（クライアント専用）
// 公開LPを不可視 iframe で読み込み、実DOMの computedStyle からタイポグラフィ・
// スペーシング・レイアウト構造を抽出する。ハードコードの転記表は使わない
// （コードを変えればこの画面も自動で追従する）。

export type TypoGroup = {
  tag: string
  fontSize: string
  fontWeight: string
  lineHeight: string
  fontFamily: string
  color: string
  count: number
  example: string
  sampleClass: string
}

export type PaddingStat = {
  px: number
  axis: 'y' | 'x'
  count: number
  sample: string
}

export type GapStat = {
  display: string
  gap: string
  template: string
  count: number
  sampleClass: string
}

export type ContainerStat = {
  maxWidth: string
  count: number
  sampleClass: string
}

export type StructureNode = {
  label: string
  widthPct: number
  bg: string | null
  note: string
  children: StructureNode[]
}

export type FontStat = {
  family: string
  weights: string
  status: string
}

export type MediaStat = {
  condition: string
  bpName: string | null
  ruleCount: number
}

export type AuditResult = {
  typography: TypoGroup[]
  paddings: PaddingStat[]
  gaps: GapStat[]
  containers: ContainerStat[]
  structure: StructureNode[]
  bodyFont: string
}

// ------------------------------------------------------------
// 色ユーティリティ（--ds-* トークンへの逆引き用）
// ------------------------------------------------------------

export function toHex(input: string): string | null {
  const v = input.trim().toLowerCase()
  if (!v || v === 'transparent' || v === 'rgba(0, 0, 0, 0)' || v === 'none') return null
  if (v.startsWith('#')) {
    if (/^#[0-9a-f]{6}$/.test(v)) return v
    if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
    return null
  }
  const m = v.match(/^rgba?\(([^)]+)\)$/)
  if (!m) return null
  const parts = m[1].split(',').map((s) => s.trim())
  const a = parts[3] !== undefined ? parseFloat(parts[3]) : 1
  if (a === 0) return null
  const [r, g, b] = parts.slice(0, 3).map((s) => parseInt(s, 10))
  if ([r, g, b].some((n) => Number.isNaN(n))) return null
  return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')
}

/** :root から --ds-* トークンの hex→トークン名マップを作る（不透明色のみ） */
export function buildDsTokenMap(rootDoc: Document, tokenNames: readonly string[]): Map<string, string> {
  const rootStyle = rootDoc.defaultView!.getComputedStyle(rootDoc.documentElement)
  const map = new Map<string, string>()
  for (const name of tokenNames) {
    const raw = rootStyle.getPropertyValue(name)
    // 半透明（alpha < 1）は hex 化すると別色と衝突するため除外
    const a = raw.trim().toLowerCase().match(/^rgba\(([^)]+)\)$/)
    if (a) {
      const parts = a[1].split(',')
      if (parts[3] !== undefined && parseFloat(parts[3]) < 1) continue
    }
    const hex = toHex(raw)
    if (hex && !map.has(hex)) map.set(hex, name)
  }
  return map
}

// ------------------------------------------------------------
// LP 実測（iframe の document を受け取って抽出）
// ------------------------------------------------------------

function shortClass(el: Element, max = 64): string {
  const cls = typeof el.className === 'string' ? el.className : ''
  return cls.length > max ? cls.slice(0, max) + '…' : cls
}

function visible(el: Element): boolean {
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

export function extractAudit(doc: Document, viewportWidth: number): AuditResult {
  const win = doc.defaultView!

  // --- タイポグラフィ: h1〜h4 / p を (タグ×サイズ×太さ×行間×色) でグルーピング ---
  const typoMap = new Map<string, TypoGroup>()
  for (const tag of ['h1', 'h2', 'h3', 'h4', 'p']) {
    for (const el of Array.from(doc.querySelectorAll(tag))) {
      const text = el.textContent?.trim() ?? ''
      if (!text || !visible(el)) continue
      const cs = win.getComputedStyle(el)
      const family = cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim()
      const key = [tag, cs.fontSize, cs.fontWeight, cs.lineHeight, cs.color].join('|')
      const cur = typoMap.get(key)
      if (cur) {
        cur.count += 1
      } else {
        typoMap.set(key, {
          tag,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          lineHeight: cs.lineHeight,
          fontFamily: family,
          color: cs.color,
          count: 1,
          example: text.slice(0, 28),
          sampleClass: shortClass(el),
        })
      }
    }
  }
  const tagOrder = ['h1', 'h2', 'h3', 'h4', 'p']
  const typography = Array.from(typoMap.values()).sort(
    (a, b) =>
      tagOrder.indexOf(a.tag) - tagOrder.indexOf(b.tag) ||
      parseFloat(b.fontSize) - parseFloat(a.fontSize)
  )

  // --- スペーシング: section/header/footer の上下・左右パディング頻度 ---
  const padMap = new Map<string, PaddingStat>()
  const addPad = (px: number, axis: 'y' | 'x', sample: string) => {
    if (!px) return
    const key = `${axis}:${px}`
    const cur = padMap.get(key)
    if (cur) cur.count += 1
    else padMap.set(key, { px, axis, count: 1, sample })
  }
  for (const el of Array.from(doc.querySelectorAll('section, header, footer'))) {
    if (!visible(el)) continue
    const cs = win.getComputedStyle(el)
    const sample = `${el.tagName.toLowerCase()} ${shortClass(el, 40)}`
    addPad(Math.round(parseFloat(cs.paddingTop)), 'y', sample)
    addPad(Math.round(parseFloat(cs.paddingBottom)), 'y', sample)
    addPad(Math.round(parseFloat(cs.paddingLeft)), 'x', sample)
    addPad(Math.round(parseFloat(cs.paddingRight)), 'x', sample)
  }
  const paddings = Array.from(padMap.values()).sort((a, b) => a.px - b.px)

  // --- グリッド・フレックス: gap 付きレイアウトの実構成 ---
  const gapMap = new Map<string, GapStat>()
  for (const el of Array.from(doc.querySelectorAll<HTMLElement>('div, ul, ol, section'))) {
    if (!visible(el)) continue
    const cs = win.getComputedStyle(el)
    if (!/(grid|flex)/.test(cs.display)) continue
    const gap = cs.gap
    if (!gap || gap === '0px' || gap === 'normal') continue
    const template = cs.display.includes('grid') ? cs.gridTemplateColumns : ''
    // grid はカラム数が分かるよう実測幅でなくトラック数に正規化
    const templateLabel = template
      ? `${template.split(' ').length}列 grid`
      : `flex (${cs.flexDirection})`
    const key = `${templateLabel}|${gap}`
    const cur = gapMap.get(key)
    if (cur) cur.count += 1
    else
      gapMap.set(key, {
        display: cs.display,
        gap,
        template: templateLabel,
        count: 1,
        sampleClass: shortClass(el, 56),
      })
  }
  const gaps = Array.from(gapMap.values()).sort((a, b) => b.count - a.count).slice(0, 12)

  // --- コンテナ: max-width が効いている要素 ---
  const containerMap = new Map<string, ContainerStat>()
  for (const el of Array.from(doc.querySelectorAll<HTMLElement>('div, main, section'))) {
    if (!visible(el)) continue
    const cs = win.getComputedStyle(el)
    if (cs.maxWidth === 'none') continue
    const cur = containerMap.get(cs.maxWidth)
    if (cur) cur.count += 1
    else containerMap.set(cs.maxWidth, { maxWidth: cs.maxWidth, count: 1, sampleClass: shortClass(el, 56) })
  }
  const containers = Array.from(containerMap.values())
    .sort((a, b) => parseFloat(b.maxWidth) - parseFloat(a.maxWidth))
    .slice(0, 8)

  // --- レイアウト構造: header / main 配下の section / footer の実構造 ---
  const structure: StructureNode[] = []
  const pctOf = (el: Element) =>
    Math.min(100, Math.round((el.getBoundingClientRect().width / viewportWidth) * 1000) / 10)
  const bgOf = (cs: CSSStyleDeclaration) => {
    const hex = toHex(cs.backgroundColor)
    return hex && hex !== '#ffffff' ? hex : null
  }
  const nodeFor = (el: Element, label: string): StructureNode => {
    const cs = win.getComputedStyle(el)
    const headingText = el.querySelector('h1, h2, h3')?.textContent?.trim().slice(0, 24)
    const padY = `${Math.round(parseFloat(cs.paddingTop))}/${Math.round(parseFloat(cs.paddingBottom))}px`
    const children: StructureNode[] = []
    // 内側コンテナ（max-width 持ち）があれば1階層だけ表示
    for (const child of Array.from(el.children)) {
      const ccs = win.getComputedStyle(child)
      if (ccs.maxWidth !== 'none' && visible(child)) {
        children.push({
          label: `max-width ${ccs.maxWidth}`,
          widthPct: pctOf(child),
          bg: null,
          note: shortClass(child, 40),
          children: [],
        })
        break
      }
    }
    return {
      label: headingText ? `${label}「${headingText}」` : label,
      widthPct: pctOf(el),
      bg: bgOf(cs),
      note: `padding-y ${padY}`,
      children,
    }
  }
  const header = doc.querySelector('body header')
  if (header && visible(header)) structure.push(nodeFor(header, 'header'))
  const main = doc.querySelector('main')
  if (main) {
    for (const sec of Array.from(main.querySelectorAll('section'))) {
      if (!visible(sec)) continue
      structure.push(nodeFor(sec, 'section'))
    }
  }
  const footer = doc.querySelector('body footer')
  if (footer && visible(footer)) structure.push(nodeFor(footer, 'footer'))

  return {
    typography,
    paddings,
    gaps,
    containers,
    structure,
    bodyFont: win.getComputedStyle(doc.body).fontFamily,
  }
}

// ------------------------------------------------------------
// ロード済みフォント（document.fonts は実際に読み込まれたものだけを持つ）
// ------------------------------------------------------------

export function extractFonts(doc: Document): FontStat[] {
  const byFamily = new Map<string, { weights: Set<string>; status: string }>()
  doc.fonts.forEach((f) => {
    const family = f.family.replace(/['"]/g, '')
    const cur = byFamily.get(family)
    if (cur) {
      cur.weights.add(f.weight)
    } else {
      byFamily.set(family, { weights: new Set([f.weight]), status: f.status })
    }
  })
  return Array.from(byFamily.entries()).map(([family, v]) => ({
    family,
    weights: Array.from(v.weights).sort().join(', '),
    status: v.status,
  }))
}

// ------------------------------------------------------------
// ブレークポイント: コンパイル済みCSSの @media ルールを CSSOM から列挙
// ------------------------------------------------------------

const BP_NAMES: Record<number, string> = {
  640: 'sm',
  768: 'md',
  1024: 'lg',
  1280: 'xl',
  1536: '2xl',
}

export function extractMediaStats(doc: Document): MediaStat[] {
  const map = new Map<string, number>()
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue // クロスオリジンのシートはスキップ
    }
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSMediaRule) {
        const cond = rule.conditionText || rule.media.mediaText
        map.set(cond, (map.get(cond) ?? 0) + rule.cssRules.length)
      }
    }
  }
  return Array.from(map.entries())
    .map(([condition, ruleCount]) => {
      const min = condition.match(/min-width:\s*(\d+(?:\.\d+)?)px/)
      const bpName = min ? (BP_NAMES[Math.round(parseFloat(min[1]))] ?? null) : null
      return { condition, bpName, ruleCount }
    })
    .sort((a, b) => {
      const aw = parseFloat(a.condition.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '99999')
      const bw = parseFloat(b.condition.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '99999')
      return aw - bw
    })
}
