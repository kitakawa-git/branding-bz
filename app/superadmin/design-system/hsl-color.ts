// デザイントークン編集UI用の色フォーマット判定・変換ユーティリティ。
// design_tokens には hex / rgba / HSL成分("0 0% 9%") / shadow / length(0.5rem) が混在する。
// shadcn 基盤変数は HSL成分形式で、tailwind の hsl(var(--x)) が解決する。

export type TokenFormat = 'hex' | 'rgba' | 'hsl-triplet' | 'shadow' | 'length' | 'raw'

// "H S% L%"（例 "0 0% 9%" / "217.2 91.2% 59.8%"）。小数も許容。
const HSL_TRIPLET_RE = /^-?\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/

export function detectFormat(value: string): TokenFormat {
  const v = value.trim()
  if (/^#[0-9A-Fa-f]{3,8}$/.test(v)) return 'hex'
  if (/^rgba?\(/i.test(v)) return 'rgba'
  if (HSL_TRIPLET_RE.test(v)) return 'hsl-triplet'
  if (/\d(px|rem|em)\b/.test(v) && /(inset|rgba?\(|\d+px\s+\d+px)/.test(v)) return 'shadow'
  if (/^[\d.]+(px|rem|em)$/.test(v)) return 'length'
  return 'raw'
}

// カラーピッカー（input type=color）を出せる形式か
export function canUseColorPicker(value: string): boolean {
  const f = detectFormat(value)
  return f === 'hex' || f === 'hsl-triplet'
}

// CSS が解釈できるプレビュー値を返す（HSL成分は hsl() でラップ）
export function toPreviewColor(value: string): string {
  const f = detectFormat(value)
  if (f === 'hsl-triplet') return `hsl(${value.trim()})`
  if (f === 'hex' || f === 'rgba') return value.trim()
  return 'transparent'
}

// short hex → 6桁 hex に正規化
export function normalizeHex(value: string): string {
  const v = value.trim()
  if (!/^#[0-9A-Fa-f]{3,8}$/.test(v)) return '#000000'
  if (v.length === 4) {
    return '#' + v.slice(1).split('').map((c) => c + c).join('')
  }
  return v.slice(0, 7)
}

// 編集中の値を、カラーピッカーに渡す 6桁 hex に変換
export function toPickerHex(value: string): string {
  const f = detectFormat(value)
  if (f === 'hsl-triplet') return hslTripletToHex(value)
  if (f === 'hex') return normalizeHex(value)
  return '#000000'
}

// ピッカーが返した hex を、トークンの元フォーマットに戻す
// （HSL成分トークンは "H S% L%" に戻す。テキスト直接編集と違いピッカー操作時のみ呼ぶ）
export function fromPicker(hexFromInput: string, originalFormat: TokenFormat): string {
  if (originalFormat === 'hsl-triplet') return hexToHslTriplet(hexFromInput)
  return hexFromInput
}

// ---- hex ⇄ HSL成分 変換 ----

// "H S% L%" → "#rrggbb"
export function hslTripletToHex(triplet: string): string {
  const m = triplet.trim().match(/^(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/)
  if (!m) return '#000000'
  const h = ((parseFloat(m[1]) % 360) + 360) % 360
  const s = parseFloat(m[2]) / 100
  const l = parseFloat(m[3]) / 100

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const mm = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]

  const toHex = (n: number) =>
    Math.round((n + mm) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// "#rrggbb" → "H S% L%"（shadcn 慣習に合わせ整数に丸める）
export function hexToHslTriplet(hex: string): string {
  const v = normalizeHex(hex)
  const r = parseInt(v.slice(1, 3), 16) / 255
  const g = parseInt(v.slice(3, 5), 16) / 255
  const b = parseInt(v.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      default:
        h = (r - g) / d + 4
    }
    h /= 6
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}
