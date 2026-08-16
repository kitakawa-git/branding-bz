'use client'

// スーパー管理: 企業「閲覧ビュー」（表示専用・読み取り専用）
// service_role 経由の読み取り専用API（/api/superadmin/company-view/[id]）から取得して表示するだけ。
// 入力欄・保存・削除など、当該企業データへ書き込むUIは一切置かない。
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Eye } from 'lucide-react'

type Row = Record<string, unknown> & { id: string }

type ViewData = {
  company: Record<string, unknown>
  basics: {
    profiles: { id: string; name: string; position: string | null; department: string | null; email: string | null; slug: string }[]
    members: { id: string; role: string | null; display_name: string | null }[]
    admins: { id: string; role: string; is_superadmin: boolean; auth_email: string | null; created_at: string }[]
    inviteLinkCount: number
  }
  brand: {
    guidelines: Row[]
    valuePropositions: Row[]
    personas: Row[]
    personalities: Row[]
    visuals: Row[]
    terms: Row[]
  }
  metrics: {
    scoreSnapshots: { snapshot_date?: string; total_score?: number }[]
    goalPeriods: { id: string; name?: string | null }[]
    goalKpis: { id: string }[]
    personalGoalCount: number
    surveys: { id: string; title?: string | null }[]
    surveyResponseCount: number
    microFeedbackCount: number
    timeline: { count: number; recent: { id: string; created_at?: string }[] }
    announcements: { count: number; recent: { id: string; title?: string | null; created_at?: string }[] }
    cardViews: { total: number; month: number; week: number }
  }
}

/* 既知の企業カラム以外を key/value で出すための除外リスト（プラン・機能トグルは自動表示される） */
const COMPANY_KNOWN_KEYS = new Set([
  'id', 'name', 'logo_url', 'website_url',
  'brand_color_primary', 'brand_color_secondary', 'created_at', 'updated_at',
])

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      {children}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="p-0">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

function KeyVal({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-sm break-words">{value ?? '—'}</span>
    </div>
  )
}

function s(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'ON' : 'OFF'
  return String(v)
}

/* 文字列フィールドを取り出す（空なら null） */
function field(row: Row, key: string): string | null {
  const v = row[key]
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  return null
}

/* jsonb 配列を文字列配列として取り出す（文字列要素 or {label/name/title/hex} を拾う） */
function strArr(row: Row, key: string): string[] {
  const v = row[key]
  if (!Array.isArray(v)) return []
  return v
    .map((x) => {
      if (typeof x === 'string') return x
      if (x && typeof x === 'object') {
        const o = x as Record<string, unknown>
        const cand = o.label ?? o.name ?? o.title ?? o.text ?? o.hex ?? o.value
        return typeof cand === 'string' ? cand : null
      }
      return null
    })
    .filter((x): x is string => !!x)
}

/* ラベル＋本文（本文が無ければ何も描画しない） */
function Line({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="py-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{value}</p>
    </div>
  )
}

/* チップ群（空なら何も描画しない） */
function Chips({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="py-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {items.map((it, i) => (
          <span key={i} className="rounded-full bg-muted px-2.5 py-0.5 text-xs">{it}</span>
        ))}
      </div>
    </div>
  )
}

/* 1件分の枠 */
function ItemCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-border p-3">{children}</div>
}

export default function CompanyViewPage() {
  const params = useParams()
  const companyId = params.id as string
  const [data, setData] = useState<ViewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token || ''
        const res = await fetch(`/api/superadmin/company-view/${companyId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        if (!res.ok) {
          setError(json?.error || '取得に失敗しました')
        } else {
          setData(json as ViewData)
        }
      } catch {
        setError('通信エラーが発生しました')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [companyId])

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">読み込み中...</div>
  }
  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href={`/superadmin/companies/${companyId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> ブランド詳細に戻る
        </Link>
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error || 'データがありません'}
        </div>
      </div>
    )
  }

  const c = data.company
  const cv = data.metrics.cardViews
  const maxScore = Math.max(1, ...data.metrics.scoreSnapshots.map((x) => x.total_score ?? 0))
  const extraCompanyKeys = Object.keys(c)
    .filter((k) => !COMPANY_KNOWN_KEYS.has(k))
    .filter((k) => {
      const v = c[k]
      return v === null || ['string', 'number', 'boolean'].includes(typeof v)
    })

  return (
    <div className="space-y-8 pb-16">
      {/* ヘッダ */}
      <div className="space-y-3">
        <Link href={`/superadmin/companies/${companyId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> ブランド詳細に戻る
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{s(c.name)}</h1>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
            <Eye size={12} /> 読み取り専用ビュー
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          この画面は表示専用です。ここからこのブランドのデータを編集・保存・削除することはできません。
        </p>
      </div>

      {/* ① 企業・メンバー基本情報 */}
      <Section title="① ブランド・メンバー基本情報">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="社員" value={data.basics.profiles.length} />
          <Stat label="管理者" value={data.basics.admins.length} />
          <Stat label="メンバー" value={data.basics.members.length} />
          <Stat label="招待リンク" value={data.basics.inviteLinkCount} />
        </div>

        <Card className="py-0">
          <CardContent className="grid grid-cols-1 gap-x-6 gap-y-1 p-4 sm:grid-cols-2 md:grid-cols-3">
            <KeyVal label="ブランド名" value={s(c.name)} />
            <KeyVal label="Webサイト" value={s(c.website_url)} />
            <KeyVal
              label="ブランドカラー"
              value={
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-4 w-4 rounded border border-border" style={{ background: s(c.brand_color_primary) !== '—' ? String(c.brand_color_primary) : 'transparent' }} />
                  {s(c.brand_color_primary)}
                  <span className="inline-block h-4 w-4 rounded border border-border" style={{ background: s(c.brand_color_secondary) !== '—' ? String(c.brand_color_secondary) : 'transparent' }} />
                  {s(c.brand_color_secondary)}
                </span>
              }
            />
            <KeyVal label="作成日" value={c.created_at ? new Date(String(c.created_at)).toLocaleDateString('ja-JP') : '—'} />
            {extraCompanyKeys.map((k) => (
              <KeyVal key={k} label={k} value={s(c[k])} />
            ))}
          </CardContent>
        </Card>

        {/* 管理者一覧 */}
        <Card className="py-0">
          <CardContent className="p-0">
            <div className="px-4 py-2.5 text-sm font-semibold border-b border-border">管理者</div>
            {data.basics.admins.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground">管理者なし</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr><th className="px-4 py-2">メール</th><th className="px-4 py-2">権限</th><th className="px-4 py-2">登録日</th></tr>
                </thead>
                <tbody>
                  {data.basics.admins.map((a) => (
                    <tr key={a.id} className="border-t border-border">
                      <td className="px-4 py-2">{s(a.auth_email)}</td>
                      <td className="px-4 py-2">{a.is_superadmin ? 'スーパー管理者' : s(a.role)}</td>
                      <td className="px-4 py-2 text-muted-foreground">{a.created_at ? new Date(a.created_at).toLocaleDateString('ja-JP') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* 社員一覧 */}
        <Card className="py-0">
          <CardContent className="p-0">
            <div className="px-4 py-2.5 text-sm font-semibold border-b border-border">社員（{data.basics.profiles.length}名）</div>
            {data.basics.profiles.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground">社員なし</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr><th className="px-4 py-2">氏名</th><th className="px-4 py-2">部署</th><th className="px-4 py-2">役職</th><th className="px-4 py-2">メール</th></tr>
                </thead>
                <tbody>
                  {data.basics.profiles.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-4 py-2">{s(p.name)}</td>
                      <td className="px-4 py-2 text-muted-foreground">{s(p.department)}</td>
                      <td className="px-4 py-2 text-muted-foreground">{s(p.position)}</td>
                      <td className="px-4 py-2 text-muted-foreground">{s(p.email)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </Section>

      {/* ② ブランド関連 */}
      <Section title="② ブランド関連">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="ガイドライン" value={data.brand.guidelines.length} />
          <Stat label="提供価値" value={data.brand.valuePropositions.length} />
          <Stat label="ペルソナ" value={data.brand.personas.length} />
          <Stat label="パーソナリティ" value={data.brand.personalities.length} />
          <Stat label="ビジュアル" value={data.brand.visuals.length} />
          <Stat label="用語" value={data.brand.terms.length} />
        </div>
        {/* ガイドライン */}
        {data.brand.guidelines.map((g) => (
          <Card key={g.id} className="py-0">
            <CardContent className="p-4">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">ガイドライン</p>
              <Line label="スローガン" value={field(g, 'slogan')} />
              <Line label="ブランドステートメント" value={field(g, 'brand_statement')} />
              <Line label="ブランドストーリー" value={field(g, 'brand_story')} />
              <Line label="パーソナリティ要約" value={field(g, 'personality_summary')} />
              <Line label="ブランド動画URL" value={field(g, 'brand_video_url')} />
            </CardContent>
          </Card>
        ))}

        {/* 提供価値 */}
        {data.brand.valuePropositions.length > 0 && (
          <Card className="py-0">
            <CardContent className="space-y-2 p-4">
              <p className="text-xs font-semibold text-muted-foreground">提供価値</p>
              {data.brand.valuePropositions.map((v) => (
                <ItemCard key={v.id}>
                  <p className="text-sm font-semibold">{s(field(v, 'title'))}</p>
                  {field(v, 'description') && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{field(v, 'description')}</p>
                  )}
                </ItemCard>
              ))}
            </CardContent>
          </Card>
        )}

        {/* ペルソナ */}
        {data.brand.personas.length > 0 && (
          <Card className="py-0">
            <CardContent className="space-y-2 p-4">
              <p className="text-xs font-semibold text-muted-foreground">ペルソナ</p>
              {data.brand.personas.map((p) => (
                <ItemCard key={p.id}>
                  <p className="text-sm font-semibold">
                    {s(field(p, 'name'))}
                    {(field(p, 'age_range') || field(p, 'occupation')) && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {[field(p, 'age_range'), field(p, 'occupation')].filter(Boolean).join('・')}
                      </span>
                    )}
                  </p>
                  <Line label="ターゲット" value={field(p, 'target')} />
                  <Line label="説明" value={field(p, 'description')} />
                  <Chips label="ニーズ" items={strArr(p, 'needs')} />
                  <Chips label="ペインポイント" items={strArr(p, 'pain_points')} />
                </ItemCard>
              ))}
            </CardContent>
          </Card>
        )}

        {/* パーソナリティ */}
        {data.brand.personalities.map((pe) => (
          <Card key={pe.id} className="py-0">
            <CardContent className="p-4">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">パーソナリティ</p>
              <Line label="コミュニケーションスタイル" value={field(pe, 'communication_style')} />
              <Chips label="アーキタイプ" items={strArr(pe, 'archetype')} />
            </CardContent>
          </Card>
        ))}

        {/* ビジュアル */}
        {data.brand.visuals.map((vi) => (
          <Card key={vi.id} className="py-0">
            <CardContent className="p-4">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">ビジュアル</p>
              <Line label="ロゴコンセプト" value={field(vi, 'logo_concept')} />
              <Line label="ビジュアルガイドライン" value={field(vi, 'visual_guidelines')} />
              <Line label="ロゴ使用ルール" value={field(vi, 'logo_usage_rules')} />
              <Chips label="カラーパレット" items={strArr(vi, 'color_palette')} />
            </CardContent>
          </Card>
        ))}

        {/* 用語 */}
        {data.brand.terms.length > 0 && (
          <Card className="py-0">
            <CardContent className="p-0">
              <div className="border-b border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground">用語ルール</div>
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr><th className="px-4 py-2">推奨</th><th className="px-4 py-2">避ける</th><th className="px-4 py-2">文脈・カテゴリ</th></tr>
                </thead>
                <tbody>
                  {data.brand.terms.map((t) => (
                    <tr key={t.id} className="border-t border-border">
                      <td className="px-4 py-2 font-medium">{s(field(t, 'preferred_term'))}</td>
                      <td className="px-4 py-2 text-muted-foreground">{s(field(t, 'avoided_term'))}</td>
                      <td className="px-4 py-2 text-muted-foreground">{[field(t, 'context'), field(t, 'category')].filter(Boolean).join(' / ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </Section>

      {/* ③ スコア・KPI・活動 */}
      <Section title="③ スコア・KPI・活動">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="名刺閲覧（合計）" value={cv.total} />
          <Stat label="今月" value={cv.month} />
          <Stat label="今週" value={cv.week} />
          <Stat label="サーベイ回答" value={data.metrics.surveyResponseCount} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="目標期間" value={data.metrics.goalPeriods.length} />
          <Stat label="KPI" value={data.metrics.goalKpis.length} />
          <Stat label="個人目標" value={data.metrics.personalGoalCount} />
          <Stat label="マイクロFB" value={data.metrics.microFeedbackCount} />
        </div>

        {/* スコア推移（簡易バー） */}
        <Card className="py-0">
          <CardContent className="p-4">
            <p className="mb-3 text-xs font-semibold text-muted-foreground">ブランドスコア推移</p>
            {data.metrics.scoreSnapshots.length === 0 ? (
              <p className="text-xs text-muted-foreground">スナップショットなし</p>
            ) : (
              <div className="flex h-32 items-end gap-2">
                {data.metrics.scoreSnapshots.map((x, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] tabular-nums text-muted-foreground">{x.total_score ?? 0}</span>
                    <div className="w-full rounded-t bg-primary/70" style={{ height: `${((x.total_score ?? 0) / maxScore) * 100}%` }} />
                    <span className="text-[9px] text-muted-foreground">{x.snapshot_date ? String(x.snapshot_date).slice(5) : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 活動: タイムライン / お知らせ */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Card className="py-0">
            <CardContent className="p-4">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">タイムライン投稿（{data.metrics.timeline.count}件）</p>
              {data.metrics.timeline.recent.length === 0 ? (
                <p className="text-xs text-muted-foreground">投稿なし</p>
              ) : (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {data.metrics.timeline.recent.map((t) => (
                    <li key={t.id}>{t.created_at ? new Date(t.created_at).toLocaleString('ja-JP', { hour12: false }) : t.id}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card className="py-0">
            <CardContent className="p-4">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">お知らせ（{data.metrics.announcements.count}件）</p>
              {data.metrics.announcements.recent.length === 0 ? (
                <p className="text-xs text-muted-foreground">お知らせなし</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {data.metrics.announcements.recent.map((a) => (
                    <li key={a.id} className="truncate">{s(a.title)}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </Section>
    </div>
  )
}
