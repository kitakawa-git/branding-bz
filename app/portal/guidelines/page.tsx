'use client'

// ブランド方針 閲覧ページ（考え方｜ブランド方針）
// 表示項目: MVV / バリュー / 行動指針 / 沿革 / 事業内容
// - MVV・バリュー・沿革・事業内容: brand_guidelines
// - 行動指針: brand_guidelines.action_guidelines
// ※ 提供価値（value_propositions＋companies.provided_values）は「接し方｜ブランド戦略」(/portal/strategy) へ移動
import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/supabase-fetch'
import { fetchPhilosophy } from '@/lib/brand/philosophy'
import { usePortalAuth } from '../components/PortalDataProvider'
import { useBrandFonts } from '@/hooks/useBrandFonts'
import { BrandFontLoader } from '@/components/BrandFontLoader'
import { getCssFontFamily } from '@/lib/brand-fonts'
import { splitBrandCopy } from '@/lib/brand-mvv'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { BrandPageTracker } from '@/components/analytics/BrandPageTracker'
import { ConceptVisualSlideshow } from './ConceptVisualSlideshow'

type ValueItem = { name: string; description: string; added_index?: number }
type HistoryItem = { year: string; event: string }
type BusinessItem = { title: string; description: string; added_index?: number }
type ActionGuideline = { title: string; description: string }

type Guidelines = {
  slogan: string | null
  // 複数コンセプトビジュアル（スライドショー）。レガシー concept_visual_url からのフォールバックあり。
  concept_visuals: string[]
  brand_video_url: string | null
  brand_statement: string | null
  mission: string | null
  vision: string | null
  values: ValueItem[]
  values_sort: 'registered' | 'custom'
  brand_story: string | null
  history: HistoryItem[]
  business_content: BusinessItem[]
  business_content_sort: 'registered' | 'custom'
  // 統合表示分（brand_guidelines 以外のテーブル由来）
  action_guidelines: ActionGuideline[]
}

// YouTube URL をembedに変換
function getYouTubeEmbedUrl(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : null
}

// 長文を指定文字数で折りたたみ、「もっと見る」で全文表示する
function ExpandableText({
  text,
  limit = 300,
  className,
  style,
}: {
  text: string
  limit?: number
  className?: string
  style?: CSSProperties
}) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > limit
  const shown = !isLong || expanded ? text : text.slice(0, limit).trimEnd() + '…'
  return (
    <div>
      <p className={className} style={style}>{shown}</p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs font-bold text-ds-app-accent hover:text-ds-app-accent-hover cursor-pointer bg-transparent border-0 p-0"
        >
          {expanded ? '閉じる' : 'もっと見る'}
        </button>
      )}
    </div>
  )
}

export default function PortalGuidelinesPage() {
  const { companyId } = usePortalAuth()
  const brandFonts = useBrandFonts(companyId)
  const primaryStyle = brandFonts ? { fontFamily: getCssFontFamily(brandFonts.primary_font) } : undefined
  const secondaryStyle = brandFonts ? { fontFamily: getCssFontFamily(brandFonts.secondary_font) } : undefined
  const cacheKey = `portal-guidelines-${companyId}`
  const cached = companyId ? getPageCache<Guidelines>(cacheKey) : null
  const [data, setData] = useState<Guidelines | null>(cached)
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<Guidelines>(cacheKey)) return

    Promise.all([
      fetchWithRetry(() =>
        supabase
          .from('brand_guidelines')
          .select('slogan, concept_visual_url, concept_visuals, brand_video_url, brand_statement, values_sort, brand_story, history, business_content_sort')
          .eq('company_id', companyId)
          .single()
      ),
      fetchPhilosophy(supabase, companyId),
    ]).then(([gRes, phil]) => {
      const g = gRes.data as Record<string, unknown> | null

      // 行動指針は philosophy_elements 由来（brand_guidelines.action_guidelines から正規化済み）
      const actionGuidelines: ActionGuideline[] = phil.action_guidelines.filter(a => a && a.title)

      // brand_guidelines 行も理念要素（ミッション/ビジョン/バリュー/行動指針）も無ければ未登録扱い
      if (!g && actionGuidelines.length === 0 && !phil.mission && !phil.vision && phil.values.length === 0) {
        setLoading(false)
        return
      }

      const parsed: Guidelines = {
        slogan: (g?.slogan as string) || null,
        // 新カラム concept_visuals を優先。空ならレガシー concept_visual_url を1枚として扱う
        concept_visuals: (Array.isArray(g?.concept_visuals) && (g?.concept_visuals as string[]).length > 0)
          ? (g?.concept_visuals as string[])
          : (g?.concept_visual_url ? [g.concept_visual_url as string] : []),
        brand_video_url: (g?.brand_video_url as string) || null,
        brand_statement: (g?.brand_statement as string) || null,
        mission: phil.mission,
        vision: phil.vision,
        values: phil.values,
        values_sort: (g?.values_sort as 'registered' | 'custom') || 'registered',
        brand_story: (g?.brand_story as string) || null,
        history: (g?.history as HistoryItem[]) || [],
        business_content: phil.services,
        business_content_sort: (g?.business_content_sort as 'registered' | 'custom') || 'registered',
        action_guidelines: actionGuidelines,
      }
      setData(parsed)
      setPageCache(cacheKey, parsed)
      setLoading(false)
    })
  }, [companyId, cacheKey])

  if (loading) return (
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-10 space-y-6">
      {/* スローガン＋コンセプトビジュアル＋動画＋メッセージ */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
      {/* ミッション＋ビジョン＋バリュー（バリューは2列） */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-4 sm:p-5 space-y-6">
          <div className="space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-7 w-2/3" /><Skeleton className="h-4 w-full" /></div>
          <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-7 w-1/2" /><Skeleton className="h-4 w-full" /></div>
          <div>
            <Skeleton className="h-4 w-20 mb-3" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="rounded-lg border border-border bg-background p-5">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      {/* 提供価値 / 行動指針（番号付きリスト） */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-4 sm:p-5 space-y-3">
          <Skeleton className="h-4 w-24" />
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-lg border border-border bg-background p-4 flex items-start gap-4">
              <Skeleton className="size-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-full" /></div>
            </div>
          ))}
        </CardContent>
      </Card>
      {/* ブランドストーリー＋沿革＋事業内容 */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-4 w-24" />
          <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-4 w-full" />)}</div>
        </CardContent>
      </Card>
    </div>
  )
  if (!data) return <div className="text-center py-16 text-muted-foreground text-[15px]">まだ登録されていません</div>

  // フィルター: 入力済みのバリューのみ（ソート対応）
  const filteredValues = data.values_sort === 'custom'
    ? data.values.filter(v => v.name)
    : [...data.values].filter(v => v.name).sort((a, b) => (a.added_index ?? 0) - (b.added_index ?? 0))

  // フィルター: 入力済みの沿革のみ
  const filteredHistory = data.history.filter(h => h.year || h.event)

  // フィルター: 入力済みの事業内容のみ（ソート対応）
  const filteredBusiness = data.business_content_sort === 'custom'
    ? data.business_content.filter(b => b.title)
    : [...data.business_content].filter(b => b.title).sort((a, b) => (a.added_index ?? 0) - (b.added_index ?? 0))

  const embedUrl = data.brand_video_url ? getYouTubeEmbedUrl(data.brand_video_url) : null

  return (
    <>
    <BrandFontLoader fonts={brandFonts} />
    {companyId && <BrandPageTracker companyId={companyId} pageType="guidelines" />}
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-10 space-y-6">
      {/* 1. スローガン＋コンセプトビジュアル＋ブランド動画＋メッセージ */}
      {(data.slogan || data.concept_visuals.length > 0 || data.brand_video_url || data.brand_statement) && (
        <section>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none overflow-hidden">
            <CardContent className="p-4 sm:p-5 space-y-8">
              {data.slogan && (
                <div>
                  <h2 className="text-sm font-bold text-foreground mb-2 tracking-wide">スローガン</h2>
                  <p className="text-3xl font-bold text-foreground m-0" style={primaryStyle}>{data.slogan}</p>
                </div>
              )}
              {data.concept_visuals.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">コンセプトビジュアル</h2>
                  <ConceptVisualSlideshow images={data.concept_visuals} />
                </div>
              )}
              {data.brand_video_url && (
                <div>
                  <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">ブランド動画</h2>
                  {embedUrl ? (
                    <div className="relative pb-[56.25%] h-0">
                      <iframe
                        src={embedUrl}
                        title="ブランド動画"
                        className="absolute top-0 left-0 w-full h-full border-none rounded-lg"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <a
                      href={data.brand_video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ds-app-accent text-sm"
                    >
                      {data.brand_video_url}
                    </a>
                  )}
                </div>
              )}
              {data.brand_statement && (
                <div>
                  <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">メッセージ</h2>
                  <p className="text-base text-foreground/80 leading-relaxed whitespace-pre-wrap m-0" style={secondaryStyle}>{data.brand_statement}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* 2. ミッション＋ビジョン＋バリュー */}
      {(data.mission || data.vision || filteredValues.length > 0) && (
        <section>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-4 sm:p-5 space-y-8">
              {data.mission && (() => {
                const { copy, body } = splitBrandCopy(data.mission)
                return (
                  <div>
                    <h2 className="text-sm font-bold text-foreground mb-2 tracking-wide">ミッション</h2>
                    {copy && <p className="text-2xl font-bold text-foreground m-0" style={primaryStyle}>{copy}</p>}
                    {body && <p className="text-base text-foreground/80 leading-relaxed whitespace-pre-line mt-3 m-0" style={secondaryStyle}>{body}</p>}
                  </div>
                )
              })()}
              {data.vision && (() => {
                const { copy, body } = splitBrandCopy(data.vision)
                return (
                  <div>
                    <h2 className="text-sm font-bold text-foreground mb-2 tracking-wide">ビジョン</h2>
                    {copy && <p className="text-2xl font-bold text-foreground m-0" style={primaryStyle}>{copy}</p>}
                    {body && <p className="text-base text-foreground/80 leading-relaxed whitespace-pre-line mt-3 m-0" style={secondaryStyle}>{body}</p>}
                  </div>
                )
              })()}
              {filteredValues.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">バリュー</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredValues.map((v, i) => (
                      <div key={i} className="rounded-lg border border-border bg-background p-5">
                        <p className="text-lg font-bold text-foreground mb-1.5 m-0" style={primaryStyle}>
                          {v.name}
                        </p>
                        {v.description && (
                          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap m-0" style={secondaryStyle}>
                            {v.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* 提供価値（value_propositions＋companies.provided_values）は「接し方｜ブランド戦略」へ移動 */}

      {/* 4. 行動指針（brand_guidelines.action_guidelines。空なら非表示） */}
      {data.action_guidelines.length > 0 && (
        <section>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-4 sm:p-5">
              <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">行動指針</h2>
              <div className="space-y-2">
                {data.action_guidelines.map((g, i) => (
                  <div key={i} className="relative overflow-hidden rounded-lg border border-border bg-background p-4 pl-5 flex gap-3">
                    {/* 左端の青バー（「私たちの『らしさ』」カードと同装飾：角丸クリップで丸端） */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-ds-app-accent" />
                    <span className="text-xs font-mono text-muted-foreground tabular-nums pt-0.5">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-[18px] font-semibold text-foreground">{g.title}</span>
                      {g.description && (
                        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap mt-1 m-0" style={secondaryStyle}>
                          {g.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* 5. ブランドストーリー＋沿革＋事業内容 */}
      {(data.brand_story || filteredHistory.length > 0 || filteredBusiness.length > 0) && (
        <section>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-4 sm:p-5 space-y-8">
              {data.brand_story && (
                <div>
                  <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">ブランドストーリー</h2>
                  <ExpandableText
                    text={data.brand_story}
                    limit={300}
                    className="text-base text-foreground/80 leading-relaxed whitespace-pre-wrap m-0"
                    style={secondaryStyle}
                  />
                </div>
              )}
              {filteredHistory.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">沿革</h2>
                  <div className="relative">
                    {filteredHistory.map((item, i) => (
                      <div key={i} className="relative flex gap-6 pb-8 last:pb-0">
                        {/* ドットを繋ぐ縦ライン（最後の項目以外） */}
                        {i < filteredHistory.length - 1 && (
                          <span className="absolute left-[3px] top-2 -bottom-1.5 w-px bg-blue-200" />
                        )}
                        <div className="shrink-0 w-16 text-sm font-bold text-ds-app-accent relative pl-4">
                          <span className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-ds-app-accent z-10" />
                          {item.year}
                        </div>
                        <div className="text-base text-foreground/80 leading-relaxed">
                          {item.event}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {filteredBusiness.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">事業内容</h2>
                  <div className="space-y-2">
                    {filteredBusiness.map((item, i) => (
                      <div key={i} className="relative overflow-hidden rounded-lg border border-border bg-background p-4 pl-5 flex gap-3">
                        {/* 左端の青バー（「私たちの『らしさ』」カードと同装飾：角丸クリップで丸端） */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-ds-app-accent" />
                        <span className="text-xs font-mono text-muted-foreground tabular-nums pt-0.5">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-[18px] font-semibold text-foreground">{item.title}</span>
                          {item.description && (
                            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap mt-1 m-0">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
    </>
  )
}
