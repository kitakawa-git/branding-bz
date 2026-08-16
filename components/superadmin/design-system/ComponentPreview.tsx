'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, Copy } from 'lucide-react'

/**
 * カラーパレットのトークン名（design_tokens / globals.css の --ds-*）。
 * 実 DOM から抽出した色を「どのパレット色か」に逆引きするために使う。
 * 値は実行時に getComputedStyle で root から解決するので、DB でパレットを変えても自動追従する。
 */
const COLOR_TOKEN_NAMES = [
  '--ds-text-strong',
  '--ds-text-body',
  '--ds-text-muted',
  '--ds-text-meta',
  '--ds-text-inverse',
  '--ds-bg-base',
  '--ds-bg-section',
  '--ds-bg-media',
  '--ds-bg-glass',
  '--ds-bg-cta-primary',
  '--ds-bg-cta-secondary',
  '--ds-bg-badge',
  '--ds-border-glass',
  '--ds-border-glass-strong',
] as const

type UsedColor = { hex: string; token: string | null }

/** "rgb(a)" / "#hex" を 6 桁小文字 hex に正規化。透明・無効は null。 */
function toHex(input: string): string | null {
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
  if (a === 0) return null // 完全透明は色として扱わない
  const [r, g, b] = parts.slice(0, 3).map((s) => parseInt(s, 10))
  if ([r, g, b].some((n) => Number.isNaN(n))) return null
  return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')
}

/** 半透明トークン（rgba の alpha < 1）か。逆引きマップから除外する（hex 化すると別色と衝突するため）。 */
function isTranslucent(value: string): boolean {
  const m = value.trim().toLowerCase().match(/^rgba\(([^)]+)\)$/)
  if (!m) return false
  const parts = m[1].split(',').map((s) => s.trim())
  const a = parts[3] !== undefined ? parseFloat(parts[3]) : 1
  return a < 1
}

/**
 * /admin/design-system のコンポーネントタブで使う汎用プレビュー枠。
 *
 * - 実コンポーネントを `children` として受け取りレンダリングする
 *   （実体をそのまま描画するので、コンポーネント本体の修正が即座にビューアにも反映される）
 * - ヘッダー: 名前 / 説明 / キー（`badgeKey`）
 * - フッター: 使用色の自動抽出（--ds-* へ逆引き）＋ 使用クラス一覧（クリックでコピー）
 */
export interface ComponentPreviewProps {
  /** 表示名 */
  name: string
  /** 補助説明（省略可） */
  description?: string
  /** バッジに出す短いキー（例: "button"） */
  badgeKey?: string
  /** 使用クラス一覧（コピー可能なバッジとして描画） */
  usageClasses?: string[]
  /** プレビュー領域の最小高さ */
  minHeight?: number
  /** プレビュー枠の背景（グラス系コンポーネント用に画像背景等を指定可能） */
  frameStyle?: React.CSSProperties
  /** 実コンポーネント */
  children: ReactNode
}

export default function ComponentPreview({
  name,
  description,
  badgeKey,
  usageClasses,
  minHeight,
  frameStyle,
  children,
}: ComponentPreviewProps) {
  const [copiedCls, setCopiedCls] = useState<string | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [usedColors, setUsedColors] = useState<UsedColor[]>([])

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCls(text)
      setTimeout(() => setCopiedCls(null), 1500)
    } catch {
      // ignore
    }
  }, [])

  // プレビュー DOM から実際に使われている色を抽出し、カラーパレットのトークンに逆引きする。
  // children のレンダリング完了後に走らせる。タイマーは rAF ではなく setTimeout を使う
  // （バックグラウンドタブ・ヘッドレス環境では rAF が発火しないため）。
  // 描画直後で色が取れないことがあるため、取れるまで数回リトライする。
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    let timer: ReturnType<typeof setTimeout>
    let tries = 0
    const attempt = () => {
      // root から各カラートークンの実値 (hex) を解決し hex→token のマップを作る
      const rootStyle = getComputedStyle(document.documentElement)
      const hexToToken = new Map<string, string>()
      for (const name of COLOR_TOKEN_NAMES) {
        const raw = rootStyle.getPropertyValue(name)
        if (isTranslucent(raw)) continue
        const hex = toHex(raw)
        if (hex && !hexToToken.has(hex)) hexToToken.set(hex, name)
      }

      // frame 配下の全要素の color / background-color / border-color を収集
      const seen = new Set<string>()
      const colors: UsedColor[] = []
      const els = [frame, ...Array.from(frame.querySelectorAll<HTMLElement>('*'))]
      for (const el of els) {
        const cs = getComputedStyle(el)
        for (const prop of ['color', 'backgroundColor', 'borderTopColor'] as const) {
          const hex = toHex(cs[prop])
          if (!hex || seen.has(hex)) continue
          // フレーム自身の白背景はノイズなので除外
          if (el === frame && prop === 'backgroundColor' && hex === '#ffffff') continue
          seen.add(hex)
          colors.push({ hex, token: hexToToken.get(hex) ?? null })
        }
      }
      // 描画前で色が取れなかった場合はリトライ（最大30回 ≒ 0.5秒）
      if (colors.length === 0 && tries < 30) {
        tries += 1
        timer = setTimeout(attempt, 16)
        return
      }
      // パレットに載っている色を優先して並べる（token あり → なし）
      colors.sort((a, b) => (a.token ? 0 : 1) - (b.token ? 0 : 1))
      setUsedColors(colors)
    }
    timer = setTimeout(attempt, 0)
    return () => clearTimeout(timer)
  }, [children])

  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="p-0">
        <div className="flex items-start justify-between px-4 pt-4 pb-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground m-0">{name}</h3>
            {description && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
            )}
          </div>
          {badgeKey && (
            <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
              {badgeKey}
            </Badge>
          )}
        </div>

        <div
          ref={frameRef}
          className="w-full border-t border-border bg-white p-6"
          style={{ minHeight, ...frameStyle }}
        >
          {children}
        </div>

        {usedColors.length > 0 && (
          <div className="px-4 py-3 border-t border-border">
            <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">
              使用カラー（パレット）
            </p>
            <div className="flex flex-wrap gap-1.5">
              {usedColors.map((c) => (
                <span
                  key={c.hex}
                  className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-foreground"
                  title={c.token ? `${c.token} (${c.hex})` : `${c.hex}（パレット外）`}
                >
                  <span
                    className="size-3 shrink-0 rounded-[2px] border border-border"
                    style={{ backgroundColor: c.hex }}
                  />
                  {c.token ?? c.hex}
                </span>
              ))}
            </div>
          </div>
        )}

        {usageClasses && usageClasses.length > 0 && (
          <div className="px-4 py-3 border-t border-border bg-muted/30">
            <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">使用クラス</p>
            <div className="flex flex-wrap gap-1.5">
              {usageClasses.map((cls) => {
                const isCopied = copiedCls === cls
                return (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => copy(cls)}
                    className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-foreground hover:bg-muted transition-colors"
                    title="クリックでコピー"
                  >
                    {cls}
                    {isCopied ? (
                      <Check size={10} className="text-green-600" />
                    ) : (
                      <Copy size={10} className="text-muted-foreground" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
