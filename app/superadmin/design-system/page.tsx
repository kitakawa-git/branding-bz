'use client'

// デザインシステム（スーパー管理画面。権限ゲートは SuperAdminShell が一括で行う）
// - カラーパレット: Supabase design_tokens（--ds-*）の編集・履歴・ロールバック
// - タイポグラフィ / スペーシング / レイアウト: 公開LPを不可視 iframe で読み込み
//   実DOMの computedStyle から「実測」する（ハードコードの転記表は持たない）
// - レスポンシブ: コンパイル済みCSSの @media ルールを CSSOM から列挙
// - コンポーネント: 実コンポーネントをそのまま描画（カタログの選定のみ手動）
import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Monitor, Smartphone, Plus, RefreshCw, Copy, Download, Check, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import DesignTokenEditor, { type DesignScope, SCOPE_CATEGORIES, CATEGORY_LABELS } from './DesignTokenEditor'
import ComponentPreview from '@/components/superadmin/design-system/ComponentPreview'
import { useDesignAudit } from './useDesignAudit'
import {
  buildDsTokenMap,
  extractFonts,
  extractMediaStats,
  toHex,
  type FontStat,
  type MediaStat,
} from './audit'
// 実コンポーネント（ビューアで実体そのものをレンダリングし、修正が即反映されるようにする）
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FabButton } from '@/components/ui/fab'
import { StepProgressBar } from '@/components/shared/StepProgressBar'

// ============================================================
// 実測の設定
// ============================================================

// 上位タブ（ウェブサイト/サービス画面）の定義
const SCOPE_TABS: { key: DesignScope; label: string; sub: string }[] = [
  { key: 'website', label: 'ウェブサイト', sub: '公開サイト（LP）' },
  { key: 'service', label: 'サービス画面', sub: 'ログイン後のアプリ' },
]

// 実測対象ページ（スコープ別）。service はログイン後の画面（プレビューの認証cookieで読める）。
const AUDIT_PAGES_BY_SCOPE: Record<DesignScope, { value: string; label: string }[]> = {
  website: [
    { value: '/', label: 'トップ（/）' },
    { value: '/plan', label: '料金プラン（/plan）' },
    { value: '/faq', label: 'FAQ（/faq）' },
    { value: '/news', label: 'ニュース（/news）' },
    { value: '/contact', label: 'お問い合わせ（/contact）' },
  ],
  service: [
    { value: '/admin/dashboard', label: '管理ダッシュボード' },
    { value: '/admin/brand-score', label: 'ブランドスコア' },
    { value: '/portal', label: 'ポータル' },
    { value: '/signup', label: 'サインアップ' },
  ],
}

const VIEWPORTS = [
  { width: 1280, label: 'PC', icon: Monitor },
  { width: 375, label: 'SP', icon: Smartphone },
] as const

// 色の逆引きに使う --ds-* トークン名（design_tokens と同期）
const DS_TOKEN_NAMES = [
  '--ds-text-strong',
  '--ds-text-body',
  '--ds-text-muted',
  '--ds-text-meta',
  '--ds-text-inverse',
  '--ds-bg-base',
  '--ds-bg-section',
  '--ds-bg-media',
  '--ds-accent-primary',
  '--ds-app-accent',
  '--ds-app-accent-hover',
  '--ds-app-accent-soft',
] as const

// ============================================================
// 実測コントロール（対象ページ・ビューポート切替）
// ============================================================

type AuditControlsProps = {
  page: string
  setPage: (v: string) => void
  pages: { value: string; label: string }[]
  viewport: number
  setViewport: (v: number) => void
  remeasure: () => void
  loading: boolean
}

function AuditControls({ page, setPage, pages, viewport, setViewport, remeasure, loading }: AuditControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
      <span className="text-[11px] font-semibold text-muted-foreground shrink-0">実測対象:</span>
      <Select value={page} onValueChange={setPage}>
        <SelectTrigger className="h-8 w-52 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {pages.map((p) => (
            <SelectItem key={p.value} value={p.value} className="text-xs">
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex rounded-md border border-border overflow-hidden">
        {VIEWPORTS.map((v) => {
          const Icon = v.icon
          return (
            <button
              key={v.width}
              type="button"
              onClick={() => setViewport(v.width)}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                viewport === v.width
                  ? 'bg-foreground text-background'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              <Icon size={12} />
              {v.label} {v.width}px
            </button>
          )
        })}
      </div>
      <Button size="sm" variant="ghost" className="h-8 text-[11px]" onClick={remeasure} disabled={loading}>
        <RefreshCw size={12} className={`mr-1 ${loading ? 'animate-spin' : ''}`} />
        再計測
      </Button>
      <span className="text-[10px] text-muted-foreground">
        ※対象ページを不可視フレームで読み込み、実DOMから計測
      </span>
    </div>
  )
}

function AuditStatus({ loading, error }: { loading: boolean; error: string | null }) {
  if (loading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">対象ページを計測中...</div>
  }
  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
        計測エラー: {error}
      </div>
    )
  }
  return null
}

type AuditState = ReturnType<typeof useDesignAudit>

// ============================================================
// タイポグラフィ（実測）
// ============================================================

function ColorChip({ color, tokenMap }: { color: string; tokenMap: Map<string, string> }) {
  const hex = toHex(color)
  const token = hex ? tokenMap.get(hex) : null
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
      <span
        className="inline-block size-3 shrink-0 rounded-[2px] border border-border"
        style={{ backgroundColor: color }}
      />
      {token ?? hex ?? color}
    </span>
  )
}

function TypographyTab({ audit }: { audit: AuditState }) {
  const { result, loading, error } = audit
  const [fonts, setFonts] = useState<FontStat[]>([])
  const [tokenMap, setTokenMap] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    setFonts(extractFonts(document))
    setTokenMap(buildDsTokenMap(document, DS_TOKEN_NAMES))
  }, [result])

  return (
    <div className="space-y-8 pt-4">
      <AuditStatus loading={loading} error={error} />

      {result && (
        <>
          <section>
            <h2 className="mb-3 text-base font-bold">文字スタイル一覧（実測）</h2>
            <Card className="py-0">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left font-medium text-muted-foreground px-4 py-2.5 border-b border-border">タグ</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-2.5 border-b border-border">サイズ / 太さ / 行間</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-2.5 border-b border-border">色</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-2.5 border-b border-border">件数</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-2.5 border-b border-border">プレビュー（実例テキスト）</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.typography.map((t, i) => (
                        <tr key={i} className="border-b border-border last:border-b-0">
                          <td className="px-4 py-3 align-top">
                            <code className="text-xs font-mono text-foreground">{t.tag}</code>
                            {t.sampleClass && (
                              <p className="text-[9px] font-mono text-muted-foreground mt-0.5 max-w-[180px] break-all">
                                {t.sampleClass}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 align-top text-xs text-muted-foreground whitespace-nowrap">
                            {t.fontSize} / {t.fontWeight} / {t.lineHeight}
                          </td>
                          <td className="px-4 py-3 align-top whitespace-nowrap">
                            <ColorChip color={t.color} tokenMap={tokenMap} />
                          </td>
                          <td className="px-4 py-3 align-top text-xs text-muted-foreground">{t.count}</td>
                          <td className="px-4 py-3 align-top">
                            <span
                              style={{
                                fontSize: `min(${t.fontSize}, 28px)`,
                                fontWeight: Number(t.fontWeight) || 400,
                                color: t.color,
                                lineHeight: 1.3,
                                display: 'inline-block',
                              }}
                            >
                              {t.example}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
            <p className="mt-2 text-[11px] text-muted-foreground">
              ※28px超のプレビューは縮小表示（数値が実測値）。同タグ・同スタイルはまとめて件数表示。
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-bold">ロード済みフォント</h2>
            <Card className="py-0">
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left font-medium text-muted-foreground px-4 py-2.5 border-b border-border">フォント</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-2.5 border-b border-border">ウェイト</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-2.5 border-b border-border">プレビュー</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fonts.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-xs text-muted-foreground">
                          Webフォントは検出されませんでした（システムフォントのみ）
                        </td>
                      </tr>
                    ) : (
                      fonts.map((f) => (
                        <tr key={f.family} className="border-b border-border last:border-b-0">
                          <td className="px-4 py-3 text-xs font-medium whitespace-nowrap">{f.family}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{f.weights}</td>
                          <td className="px-4 py-3 text-lg" style={{ fontFamily: `'${f.family}'` }}>
                            あいうえお ABCDEF 12345
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            <p className="mt-2 text-[11px] text-muted-foreground">
              body 実測フォント: <code className="font-mono">{result.bodyFont}</code>
            </p>
          </section>
        </>
      )}
    </div>
  )
}

// ============================================================
// スペーシング（実測）
// ============================================================

function SpacingTab({ audit }: { audit: AuditState }) {
  const { result, loading, error } = audit
  const yPads = result?.paddings.filter((p) => p.axis === 'y') ?? []
  const xPads = result?.paddings.filter((p) => p.axis === 'x') ?? []
  const maxPx = Math.max(1, ...yPads.map((p) => p.px), ...xPads.map((p) => p.px))

  return (
    <div className="space-y-8 pt-4">
      <AuditStatus loading={loading} error={error} />

      {result && (
        <>
          <section>
            <h2 className="mb-3 text-base font-bold">セクション余白（実測）</h2>
            <Card className="py-0">
              <CardContent className="p-4 space-y-5">
                {(
                  [
                    ['上下（padding-top / bottom）', yPads],
                    ['左右（padding-left / right）', xPads],
                  ] as const
                ).map(([label, pads]) => (
                  <div key={label}>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">{label}</p>
                    {pads.length === 0 ? (
                      <p className="text-xs text-muted-foreground">検出なし</p>
                    ) : (
                      <ul className="space-y-2">
                        {pads.map((p) => (
                          <li key={`${p.axis}-${p.px}`} className="flex items-center gap-3">
                            <code className="text-xs font-mono text-foreground w-16 shrink-0">{p.px}px</code>
                            <div
                              className="h-3.5 bg-foreground rounded-sm shrink-0"
                              style={{ width: `${(p.px / maxPx) * 220}px`, minWidth: '3px' }}
                            />
                            <span className="text-[11px] text-muted-foreground w-10 shrink-0">×{p.count}</span>
                            <span className="text-[10px] font-mono text-muted-foreground flex-1 truncate">
                              {p.sample}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          <section>
            <h2 className="mb-3 text-base font-bold">コンテナ幅（実測）</h2>
            <Card className="py-0">
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left font-medium text-muted-foreground px-4 py-2.5 border-b border-border">max-width</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-2.5 border-b border-border">件数</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-2.5 border-b border-border">クラス例</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.containers.length === 0 ? (
                      <tr><td colSpan={3} className="px-4 py-3 text-xs text-muted-foreground">検出なし</td></tr>
                    ) : (
                      result.containers.map((c) => (
                        <tr key={c.maxWidth} className="border-b border-border last:border-b-0">
                          <td className="px-4 py-2.5 text-xs font-mono text-foreground">{c.maxWidth}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">×{c.count}</td>
                          <td className="px-4 py-2.5 text-[10px] font-mono text-muted-foreground break-all">{c.sampleClass}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  )
}

// ============================================================
// レイアウト（実測）
// ============================================================

function LayoutTab({ audit }: { audit: AuditState }) {
  const { result, loading, error } = audit

  return (
    <div className="space-y-8 pt-4">
      <AuditStatus loading={loading} error={error} />

      {result && (
        <>
          <section>
            <h2 className="mb-1 text-base font-bold">ページ構造（実測）</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              header / main 配下の section / footer を実DOMから抽出。幅はビューポート比、背景色は実測値。
            </p>
            <Card className="py-0">
              <CardContent className="p-4">
                <div className="space-y-1.5">
                  {result.structure.length === 0 ? (
                    <p className="text-xs text-muted-foreground">セクション構造が検出できませんでした</p>
                  ) : (
                    result.structure.map((node, i) => (
                      <div
                        key={i}
                        className="rounded border border-dashed border-muted-foreground/40 px-2 py-2 mx-auto"
                        style={{
                          width: `${node.widthPct}%`,
                          backgroundColor: node.bg ?? undefined,
                        }}
                      >
                        <div className="flex flex-col items-center justify-center text-[11px] text-muted-foreground gap-0.5">
                          <span className="font-mono text-foreground/80">{node.label}</span>
                          <span className="text-[9px]">
                            幅 {node.widthPct}% / {node.note}
                            {node.bg && ` / bg ${node.bg}`}
                          </span>
                        </div>
                        {node.children.map((child, ci) => (
                          <div
                            key={ci}
                            className="mt-1.5 rounded border border-dashed border-muted-foreground/30 bg-background/60 px-2 py-1 mx-auto text-center"
                            style={{ width: `${Math.min(100, (child.widthPct / Math.max(node.widthPct, 1)) * 100)}%` }}
                          >
                            <span className="text-[9px] font-mono text-muted-foreground">{child.label}</span>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          <section>
            <h2 className="mb-3 text-base font-bold">グリッド・フレックス構成（実測）</h2>
            <Card className="py-0">
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left font-medium text-muted-foreground px-4 py-2.5 border-b border-border">構成</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-2.5 border-b border-border">gap</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-2.5 border-b border-border">件数</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-2.5 border-b border-border">クラス例</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.gaps.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-3 text-xs text-muted-foreground">検出なし</td></tr>
                    ) : (
                      result.gaps.map((g, i) => (
                        <tr key={i} className="border-b border-border last:border-b-0">
                          <td className="px-4 py-2.5 text-xs font-mono text-foreground whitespace-nowrap">{g.template}</td>
                          <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">{g.gap}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">×{g.count}</td>
                          <td className="px-4 py-2.5 text-[10px] font-mono text-muted-foreground break-all">{g.sampleClass}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  )
}

// ============================================================
// レスポンシブ（コンパイル済みCSSから実測）
// ============================================================

function ResponsiveTab() {
  const [stats, setStats] = useState<MediaStat[] | null>(null)

  useEffect(() => {
    setStats(extractMediaStats(document))
  }, [])

  return (
    <div className="space-y-6 pt-4">
      <Card className="py-0">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5 border-b border-border">@media 条件（実CSS）</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5 border-b border-border">Tailwind</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5 border-b border-border">ルール数</th>
              </tr>
            </thead>
            <tbody>
              {!stats ? (
                <tr><td colSpan={3} className="px-4 py-3 text-xs text-muted-foreground">解析中...</td></tr>
              ) : stats.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-3 text-xs text-muted-foreground">@media ルールが見つかりませんでした</td></tr>
              ) : (
                stats.map((s) => (
                  <tr key={s.condition} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3">
                      <code className="text-xs font-mono text-foreground">{s.condition}</code>
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground whitespace-nowrap">
                      {s.bpName ? <Badge variant="outline" className="text-[10px]">{s.bpName}:</Badge> : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.ruleCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <p className="text-[11px] text-muted-foreground">
        ※コンパイル済みCSS（document.styleSheets）の @media ルールをそのまま列挙。ルール数は実際にそのブレークポイントで定義されているスタイル数。
      </p>
    </div>
  )
}

// ============================================================
// コンポーネントカタログ（実コンポーネント描画）
// ============================================================

function SwitchDemo() {
  const [on, setOn] = useState(true)
  return (
    <div className="flex items-center gap-3">
      <Switch checked={on} onCheckedChange={setOn} id="ds-switch-demo" />
      <Label htmlFor="ds-switch-demo" className="text-sm">{on ? 'ON' : 'OFF'}</Label>
    </div>
  )
}

function SelectDemo() {
  return (
    <Select defaultValue="build">
      <SelectTrigger className="w-56">
        <SelectValue placeholder="選択してください" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="build">構築</SelectItem>
        <SelectItem value="spread">浸透</SelectItem>
        <SelectItem value="send">発信</SelectItem>
      </SelectContent>
    </Select>
  )
}

// LP グラス系プレビューの共通背景（半透明が見えるようにグラデーションを敷く）
const GLASS_FRAME_STYLE: React.CSSProperties = {
  background: 'linear-gradient(135deg, #dbeafe 0%, #fce7f3 45%, #d1fae5 100%)',
}

type ComponentSample = {
  key: string
  name: string
  description: string
  classNames: string[]
  minHeight?: number
  /** 横長コンポーネント。メイソンリーで段組みせずフル幅（1カラム）で表示する。 */
  fullWidth?: boolean
  frameStyle?: React.CSSProperties
  render: () => ReactElement
}

const COMPONENT_SAMPLES: ComponentSample[] = [
  // ---- LP パターン（--ds-* トークンの適用先） ----
  {
    key: 'lp-badge',
    name: 'LP 青グラスバッジ',
    description: 'Hero / CTA の告知バッジ。背景・文字色は --ds-* トークン。',
    classNames: ['text-ds-accent', 'var(--ds-bg-badge)', 'rounded-full px-6 py-1.5'],
    minHeight: 80,
    frameStyle: GLASS_FRAME_STYLE,
    render: () => (
      <div
        className="inline-flex items-center gap-2 rounded-full px-6 py-1.5 text-sm text-ds-accent"
        style={{
          background: 'var(--ds-bg-badge)',
          backdropFilter: 'blur(12px) saturate(120%)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        AIガイドで約5〜10分
      </div>
    ),
  },
  {
    key: 'lp-cta-buttons',
    name: 'LP CTAピルボタン（主要 / 副次）',
    description: '「無料で始める」「料金を見る」のグラスピル。背景は --ds-bg-cta-*。',
    classNames: ['text-ds-inverse', 'text-ds-strong', 'var(--ds-bg-cta-primary)', 'var(--ds-bg-cta-secondary)'],
    minHeight: 100,
    frameStyle: GLASS_FRAME_STYLE,
    render: () => (
      <div className="flex flex-wrap gap-4">
        <button
          className="relative h-12 w-48 rounded-full text-base font-bold text-ds-inverse overflow-hidden"
          style={{
            background: 'var(--ds-bg-cta-primary)',
            backdropFilter: 'blur(12px) saturate(120%)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
          }}
        >
          無料で始める
        </button>
        <button
          className="relative h-12 w-48 rounded-full text-base font-bold text-ds-strong overflow-hidden"
          style={{
            background: 'var(--ds-bg-cta-secondary)',
            backdropFilter: 'blur(12px) saturate(120%)',
            border: '1px solid var(--ds-border-glass-strong)',
          }}
        >
          料金を見る
        </button>
      </div>
    ),
  },
  {
    key: 'lp-glass-card',
    name: 'LP グラスカード',
    description: '3レイヤー・機能紹介のカード。背景 --ds-bg-glass、枠線 --ds-border-glass、影 --ds-shadow-glass。',
    classNames: ['text-ds-strong', 'text-ds-muted', 'var(--ds-bg-glass)', 'var(--ds-shadow-glass)'],
    minHeight: 220,
    frameStyle: GLASS_FRAME_STYLE,
    render: () => (
      <div
        className="relative rounded-2xl overflow-hidden max-w-sm"
        style={{
          background: 'var(--ds-bg-glass)',
          backdropFilter: 'blur(12px) saturate(120%)',
          border: '1px solid var(--ds-border-glass)',
          boxShadow: 'var(--ds-shadow-glass), inset 0px 0px 4px 2px rgba(255, 255, 255, 0.15)',
        }}
      >
        <div className="relative z-10 p-8">
          <span className="text-sm font-semibold tracking-wide text-ds-body">構築</span>
          <h3 className="text-lg font-bold text-ds-strong mt-4 mb-3">
            ブランドの言語化を対話型AIがサポート
          </h3>
          <p className="text-sm text-ds-muted leading-relaxed">
            AIが壁打ち相手として伴走。理念・カラー・ターゲット戦略を対話しながら形にします。
          </p>
        </div>
      </div>
    ),
  },
  // ---- shadcn/ui（アプリUI） ----
  {
    key: 'button',
    name: 'Button',
    description: 'shadcn/ui ボタン。管理画面・ポータルの標準アクション。',
    classNames: ['<Button variant="default|outline|ghost|destructive">'],
    minHeight: 80,
    render: () => (
      <div className="flex flex-wrap items-center gap-3">
        <Button>保存</Button>
        <Button variant="outline">キャンセル</Button>
        <Button variant="ghost">ゴースト</Button>
        <Button variant="destructive">削除</Button>
      </div>
    ),
  },
  {
    key: 'badge',
    name: 'Badge',
    description: 'ステータス・タグ表示。',
    classNames: ['<Badge variant="default|secondary|outline|destructive">'],
    minHeight: 60,
    render: () => (
      <div className="flex flex-wrap items-center gap-2">
        <Badge>公開中</Badge>
        <Badge variant="secondary">下書き</Badge>
        <Badge variant="outline">タグ</Badge>
        <Badge variant="destructive">エラー</Badge>
      </div>
    ),
  },
  {
    key: 'input',
    name: 'Input + Label',
    description: 'フォーム入力の標準形。',
    classNames: ['<Label>', '<Input>'],
    minHeight: 100,
    render: () => (
      <div className="max-w-sm space-y-2">
        <Label htmlFor="ds-input-demo">会社名</Label>
        <Input id="ds-input-demo" placeholder="例: ID株式会社" />
      </div>
    ),
  },
  {
    key: 'select',
    name: 'Select',
    description: 'ドロップダウン選択。',
    classNames: ['<Select>', '<SelectTrigger>', '<SelectItem>'],
    minHeight: 80,
    render: () => <SelectDemo />,
  },
  {
    key: 'switch',
    name: 'Switch',
    description: '設定ページの機能オン/オフトグル。',
    classNames: ['<Switch checked onCheckedChange>'],
    minHeight: 60,
    render: () => <SwitchDemo />,
  },
  {
    key: 'progress',
    name: 'Progress / Skeleton',
    description: '進捗バーとローディングプレースホルダ。',
    classNames: ['<Progress value>', '<Skeleton>'],
    minHeight: 100,
    render: () => (
      <div className="max-w-sm space-y-4">
        <Progress value={62} />
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    ),
  },
  {
    key: 'accordion',
    name: 'Accordion',
    description: 'FAQ等の開閉リスト。',
    classNames: ['<Accordion type="single" collapsible>'],
    minHeight: 140,
    render: () => (
      <Accordion type="single" collapsible className="max-w-md" defaultValue="q1">
        <AccordionItem value="q1">
          <AccordionTrigger className="text-sm">ブランディングとは何ですか？</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground">
            ブランドの価値を社会に伝え、組織に浸透させる一連の活動です。
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="q2">
          <AccordionTrigger className="text-sm">費用はいくらかかりますか？</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground">
            プランページをご覧ください。
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    ),
  },
  {
    key: 'card',
    name: 'Card（設定カード型）',
    description: '管理画面の標準カード。設定ページの bg-[hsl(0_0%_97%)] パターン。',
    classNames: ['<Card className="bg-[hsl(0_0%_97%)] border shadow-none">'],
    minHeight: 140,
    render: () => (
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none max-w-md">
        <CardContent className="p-5">
          <h3 className="text-base font-bold text-foreground mb-1 mt-0">機能の表示設定</h3>
          <p className="text-sm text-muted-foreground m-0">
            ポータルに表示する機能のオン/オフを切り替えます。
          </p>
        </CardContent>
      </Card>
    ),
  },
  {
    key: 'fab',
    name: 'FabButton（右下固定アクション）',
    description: '保存/キャンセル等の画面右下FAB。実際は <Fab> で fixed 配置（プレビューでは静止表示）。',
    classNames: ['<Fab>', '<FabButton variant="primary|secondary" icon>'],
    minHeight: 90,
    render: () => (
      <div className="flex items-center gap-3">
        <FabButton variant="secondary">キャンセル</FabButton>
        <FabButton icon={<Plus size={16} />}>新規作成</FabButton>
      </div>
    ),
  },
  {
    key: 'step-progress',
    name: 'StepProgressBar',
    description: 'ウィザード等のステップ進捗（components/shared）。',
    classNames: ['<StepProgressBar steps currentStep>'],
    minHeight: 110,
    fullWidth: true,
    render: () => (
      <StepProgressBar
        steps={[{ label: '基本情報' }, { label: 'ブランド' }, { label: '確認' }, { label: '完了' }]}
        currentStep={2}
      />
    ),
  },
]

function ComponentsTab({ scope }: { scope: DesignScope }) {
  // ウェブサイト = LP系（lp-* キー）／ サービス画面 = shadcn系（それ以外）
  const samples = COMPONENT_SAMPLES.filter((c) =>
    scope === 'website' ? c.key.startsWith('lp-') : !c.key.startsWith('lp-')
  )
  return (
    <div className="space-y-6 pt-4">
      {/* メイソンリー: CSS columns で各カードの高さに応じて段詰めする。 */}
      <div className="columns-1 lg:columns-2 gap-4 [column-fill:_balance]">
        {samples.map((comp) => (
          <div
            key={comp.key}
            className={`mb-4 break-inside-avoid${comp.fullWidth ? ' [column-span:all]' : ''}`}
          >
            <ComponentPreview
              name={comp.name}
              description={comp.description}
              badgeKey={comp.key}
              usageClasses={comp.classNames}
              minHeight={comp.minHeight}
              frameStyle={comp.frameStyle}
            >
              {comp.render()}
            </ComponentPreview>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        ※実コンポーネントをそのまま描画しているため、本体を修正すればここにも即反映される（カタログの選定のみ手動）。使用カラーは実DOMから抽出し --ds-* トークンへ逆引き。
      </p>
    </div>
  )
}

// ============================================================
// Document Tab（design.md：自動サマリー＋手書きメモ）
// ============================================================

type DocToken = { token_name: string; value: string; label: string | null; category: string }

// トークン・実測値・コンポーネント・ブレークポイントを Markdown サマリーに集約
function buildAutoMarkdown(
  scope: DesignScope,
  tokens: DocToken[],
  audit: ReturnType<typeof useDesignAudit>,
  mediaStats: MediaStat[]
): string {
  const scopeLabel = scope === 'website' ? 'ウェブサイト（公開LP）' : 'サービス画面（ログイン後アプリ）'
  const lines: string[] = []
  lines.push(`# デザインシステム — ${scopeLabel}`, '')
  lines.push('> デザインシステム画面から自動生成。トークン値・実測値は出力時点のスナップショット。', '')

  // カラーパレット（DB最新）
  lines.push('## カラーパレット', '')
  for (const cat of SCOPE_CATEGORIES[scope]) {
    const items = tokens.filter((t) => t.category === cat)
    if (!items.length) continue
    lines.push(`### ${CATEGORY_LABELS[cat] ?? cat}`, '')
    for (const t of items) {
      lines.push(`- \`${t.token_name}\`: \`${t.value}\`${t.label ? ` — ${t.label}` : ''}`)
    }
    lines.push('')
  }

  // タイポグラフィ（実測）
  if (audit.result?.typography?.length) {
    lines.push('## タイポグラフィ（実測）', '')
    lines.push('| タグ | サイズ / 太さ / 行間 | 件数 |', '|---|---|---|')
    for (const t of audit.result.typography) {
      lines.push(`| ${t.tag} | ${t.fontSize} / ${t.fontWeight} / ${t.lineHeight} | ${t.count} |`)
    }
    lines.push('')
  }

  // スペーシング（実測）
  if (audit.result) {
    const yPads = audit.result.paddings.filter((p) => p.axis === 'y').map((p) => `${p.px}px`)
    const xPads = audit.result.paddings.filter((p) => p.axis === 'x').map((p) => `${p.px}px`)
    if (yPads.length || xPads.length || audit.result.containers.length) {
      lines.push('## スペーシング（実測）', '')
      if (yPads.length) lines.push(`- 上下余白: ${yPads.join(', ')}`)
      if (xPads.length) lines.push(`- 左右余白: ${xPads.join(', ')}`)
      if (audit.result.containers.length)
        lines.push(`- コンテナ幅: ${audit.result.containers.map((c) => c.maxWidth).join(', ')}`)
      lines.push('')
    }
  }

  // コンポーネント（scope別カタログ）
  const samples = COMPONENT_SAMPLES.filter((c) =>
    scope === 'website' ? c.key.startsWith('lp-') : !c.key.startsWith('lp-')
  )
  if (samples.length) {
    lines.push('## コンポーネント', '')
    for (const c of samples) lines.push(`- **${c.name}** — ${c.description}`)
    lines.push('')
  }

  // レスポンシブ（@media）
  if (mediaStats.length) {
    lines.push('## レスポンシブ（@media）', '')
    for (const m of mediaStats) {
      lines.push(`- \`${m.condition}\`${m.bpName ? ` (${m.bpName})` : ''}: ${m.ruleCount}ルール`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function DocumentTab({ scope, audit }: { scope: DesignScope; audit: ReturnType<typeof useDesignAudit> }) {
  const [tokens, setTokens] = useState<DocToken[]>([])
  const [body, setBody] = useState('')
  const [savedBody, setSavedBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [mediaStats, setMediaStats] = useState<MediaStat[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const [tokRes, docRes] = await Promise.all([
      supabase.from('design_tokens').select('token_name, value, label, category'),
      supabase.from('design_docs').select('body').eq('scope', scope).maybeSingle(),
    ])
    if (tokRes.data) setTokens(tokRes.data as DocToken[])
    const b = (docRes.data?.body as string) ?? ''
    setBody(b)
    setSavedBody(b)
    setMediaStats(extractMediaStats(document))
    setLoading(false)
  }, [scope])

  useEffect(() => {
    load()
  }, [load])

  const autoMd = buildAutoMarkdown(scope, tokens, audit, mediaStats)
  const fullMd = body.trim() ? `${autoMd}\n---\n\n## 補足メモ（手書き）\n\n${body.trim()}\n` : autoMd
  const dirty = body !== savedBody

  const save = async () => {
    setSaving(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('design_docs')
      .update({ body, updated_at: new Date().toISOString(), updated_by: user?.id ?? null })
      .eq('scope', scope)
    if (!error) setSavedBody(body)
    setSaving(false)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullMd)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  const download = () => {
    const blob = new Blob([fullMd], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `design-${scope}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">読み込み中...</div>
  }

  return (
    <div className="space-y-6 pt-4">
      {/* 手書きメモ */}
      <section>
        <h2 className="mb-1 text-base font-bold">方針メモ（手書き）</h2>
        <p className="mb-2 text-xs text-muted-foreground">
          design.md の自由記述部分。Markdownで書けます（命名規則・注意書き・意図など）。下の自動サマリーと結合して出力されます。
        </p>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          placeholder={'# 方針\n- 新規UIの青は text-ds-app-accent を使う\n- ...'}
          className="w-full rounded-md border border-border bg-background p-3 text-sm font-mono leading-relaxed"
        />
        <div className="mt-2">
          <Button size="sm" disabled={!dirty || saving} onClick={save} className="h-8 text-xs">
            <Save size={12} className="mr-1" />
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </section>

      {/* 生成される design.md */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-bold">
            生成される design.md（{scope === 'website' ? 'ウェブサイト' : 'サービス画面'}）
          </h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={copy} className="h-8 text-xs">
              {copied ? <Check size={12} className="mr-1 text-green-600" /> : <Copy size={12} className="mr-1" />}
              コピー
            </Button>
            <Button size="sm" variant="outline" onClick={download} className="h-8 text-xs">
              <Download size={12} className="mr-1" />
              .md
            </Button>
          </div>
        </div>
        <Card className="py-0">
          <CardContent className="p-0">
            <pre className="max-h-[480px] overflow-auto p-4 text-[11px] leading-relaxed font-mono whitespace-pre-wrap">
              {fullMd}
            </pre>
          </CardContent>
        </Card>
        <p className="mt-2 text-[11px] text-muted-foreground">
          ※トークンはDB最新、タイポ/スペーシングは「実測対象」で選んだページの計測値（実測タブで対象を切り替えてから戻ると反映）。
        </p>
      </section>
    </div>
  )
}

// ============================================================
// Main Page
// ============================================================

// 実測（iframe）が必要なタブ（document も実測値を取り込むため含める）
const AUDIT_TABS = ['typography', 'spacing', 'layout', 'document']

export default function DesignSystemPage() {
  const [scope, setScope] = useState<DesignScope>('website')
  const [tab, setTab] = useState('colors')
  const [auditPage, setAuditPage] = useState(AUDIT_PAGES_BY_SCOPE.website[0].value)
  const [viewport, setViewport] = useState<number>(1280)
  const [measureKey, setMeasureKey] = useState(0)

  const auditPages = AUDIT_PAGES_BY_SCOPE[scope]
  // スコープ切替時、実測対象ページをそのスコープの先頭に合わせる
  useEffect(() => {
    setAuditPage(AUDIT_PAGES_BY_SCOPE[scope][0].value)
  }, [scope])

  const auditEnabled = AUDIT_TABS.includes(tab)
  // 再計測は URL のダミークエリを変えて effect を再発火させる
  const audit = useDesignAudit(
    auditEnabled,
    measureKey ? `${auditPage}?_m=${measureKey}` : auditPage,
    viewport
  )

  return (
    <div>
      {/* 上位タブ: ウェブサイト / サービス画面（下線型） */}
      <div className="flex gap-8 border-b border-border">
        {SCOPE_TABS.map((s) => {
          const active = s.key === scope
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setScope(s.key)}
              className={`relative -mb-px border-b-2 px-1 pb-3 pt-1 text-left transition-colors ${
                active ? 'border-foreground' : 'border-transparent hover:border-border'
              }`}
            >
              <span className={`block text-base font-bold ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                {s.label}
              </span>
              <span className="block text-[11px] text-muted-foreground">{s.sub}</span>
            </button>
          )
        })}
      </div>

      {/* 下位タブ: カラーパレット 〜 レスポンシブ（上位スコープに連動） */}
      <Tabs value={tab} onValueChange={setTab} className="mt-5">
        <TabsList className="h-auto flex-wrap gap-2">
          <TabsTrigger value="colors">カラーパレット</TabsTrigger>
          <TabsTrigger value="typography">タイポグラフィ</TabsTrigger>
          <TabsTrigger value="spacing">スペーシング</TabsTrigger>
          <TabsTrigger value="components">コンポーネント</TabsTrigger>
          <TabsTrigger value="layout">レイアウト</TabsTrigger>
          <TabsTrigger value="responsive">レスポンシブ</TabsTrigger>
          <TabsTrigger value="document">ドキュメント</TabsTrigger>
        </TabsList>

        {auditEnabled && (
          <div className="mt-4">
            <AuditControls
              page={auditPage}
              setPage={setAuditPage}
              pages={auditPages}
              viewport={viewport}
              setViewport={setViewport}
              remeasure={() => setMeasureKey((k) => k + 1)}
              loading={audit.loading}
            />
          </div>
        )}

        <TabsContent value="colors"><DesignTokenEditor scope={scope} /></TabsContent>
        <TabsContent value="typography"><TypographyTab audit={audit} /></TabsContent>
        <TabsContent value="spacing"><SpacingTab audit={audit} /></TabsContent>
        <TabsContent value="components"><ComponentsTab scope={scope} /></TabsContent>
        <TabsContent value="layout"><LayoutTab audit={audit} /></TabsContent>
        <TabsContent value="responsive"><ResponsiveTab /></TabsContent>
        <TabsContent value="document"><DocumentTab scope={scope} audit={audit} /></TabsContent>
      </Tabs>
    </div>
  )
}
