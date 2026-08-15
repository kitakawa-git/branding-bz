'use client'

// バーバルアイデンティティ 閲覧ページ（トーンオブボイス・用語ルール）
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/supabase-fetch'
import { usePortalAuth } from '../components/PortalDataProvider'
import { useBrandFonts } from '@/hooks/useBrandFonts'
import { BrandFontLoader } from '@/components/BrandFontLoader'
import { getCssFontFamily } from '@/lib/brand-fonts'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { BrandPageTracker } from '@/components/analytics/BrandPageTracker'
import { BrandExpressionTabs } from '../components/BrandExpressionTabs'
import { BrandPersonalityCard } from '@/components/shared/BrandPersonalityCard'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { BrandEmptyState } from '@/components/brand/BrandEmptyState'

type Term = {
  preferred_term: string
  avoided_term: string
  context: string | null
  category: string | null
}

type ToneRule = {
  rule_text: string
  ng_example: string | null
  ok_example: string | null
}

type VerbalCache = {
  terms: Term[]
  communicationStyle: string | null
  toneRules: ToneRule[]
  expectedTags: string[]
}

export default function PortalVerbalIdentityPage() {
  const { companyId } = usePortalAuth()
  const brandFonts = useBrandFonts(companyId)
  const secondaryStyle = brandFonts ? { fontFamily: getCssFontFamily(brandFonts.secondary_font) } : undefined
  // v2: BrandPersonalityCard 統合＋期待タグ追加によりキャッシュ形状が変わったためキー更新
  const cacheKey = `portal-verbal-v2-${companyId}`
  const cached = companyId ? getPageCache<VerbalCache>(cacheKey) : null

  const [terms, setTerms] = useState<Term[]>(cached?.terms ?? [])
  const [communicationStyle, setCommunicationStyle] = useState<string | null>(cached?.communicationStyle ?? null)
  const [toneRules, setToneRules] = useState<ToneRule[]>(cached?.toneRules ?? [])
  const [expectedTags, setExpectedTags] = useState<string[]>(cached?.expectedTags ?? [])
  const [loading, setLoading] = useState(!cached)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<VerbalCache>(cacheKey)) return

    Promise.all([
      fetchWithRetry(() =>
        supabase.from('brand_terms').select('preferred_term, avoided_term, context, category, sort_order').eq('company_id', companyId).order('sort_order')
      ),
      // コミュニケーションスタイル: brand_personalities.communication_style
      fetchWithRetry(() =>
        supabase.from('brand_personalities').select('communication_style').eq('company_id', companyId).maybeSingle()
      ),
      // 表現ルール: governance_rules(tone_rule)。RLSがメンバー読み取り不可のためAPI経由（失敗時は非表示のまま）
      fetch('/api/brand/tone-rules')
        .then(res => (res.ok ? res.json() : { rules: [] }))
        .catch(() => ({ rules: [] })),
      // 期待される印象タグ: brand_personality_tag_mappings (is_expected=true)
      fetchWithRetry(() =>
        supabase.from('brand_personality_tag_mappings').select('tag').eq('company_id', companyId).eq('is_expected', true)
      ),
    ]).then(([tRes, pRes, rRes, tagRes]) => {
      let parsedTerms: Term[] = []
      if (tRes.data && Array.isArray(tRes.data)) {
        parsedTerms = tRes.data.map((d: unknown) => {
          const rec = d as Record<string, unknown>
          return {
            preferred_term: (rec.preferred_term as string) || '',
            avoided_term: (rec.avoided_term as string) || '',
            context: (rec.context as string) || null,
            category: (rec.category as string) || null,
          }
        })
        setTerms(parsedTerms)
      }
      const p = pRes.data as Record<string, unknown> | null
      const comm = (p?.communication_style as string) || null
      setCommunicationStyle(comm)
      const parsedRules: ToneRule[] = (Array.isArray(rRes?.rules) ? rRes.rules : []).map((r: Record<string, unknown>) => ({
        rule_text: (r.rule_text as string) || '',
        ng_example: (r.ng_example as string) || null,
        ok_example: (r.ok_example as string) || null,
      })).filter((r: ToneRule) => r.rule_text)
      setToneRules(parsedRules)
      const parsedTags: string[] = Array.isArray(tagRes?.data)
        ? tagRes.data.map((r: unknown) => ((r as Record<string, unknown>).tag as string) || '').filter(Boolean)
        : []
      setExpectedTags(parsedTags)
      setPageCache(cacheKey, {
        terms: parsedTerms,
        communicationStyle: comm,
        toneRules: parsedRules,
        expectedTags: parsedTags,
      })
      setLoading(false)
    })
  }, [companyId, cacheKey])

  // カテゴリ一覧（ユニーク）
  const categories = useMemo(() => {
    const cats = terms
      .map(t => t.category)
      .filter((c): c is string => c !== null && c.trim() !== '')
    return [...new Set(cats)]
  }, [terms])

  const hasCategories = categories.length > 0

  // 絞り込み + 検索
  const filteredTerms = useMemo(() => {
    let result = terms

    if (selectedCategory !== 'all') {
      result = result.filter(t => t.category === selectedCategory)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(t =>
        t.preferred_term.toLowerCase().includes(q) ||
        t.avoided_term.toLowerCase().includes(q) ||
        (t.context || '').toLowerCase().includes(q)
      )
    }

    return result
  }, [terms, selectedCategory, searchQuery])

  if (loading) return (
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-10 space-y-6">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none overflow-hidden">
        <CardContent className="p-5 pb-0">
          <Skeleton className="h-4 w-24 mb-3" />
        </CardContent>
        <CardContent className="p-0">
          <div className="w-full">
            <div className="flex bg-muted px-4 py-3 gap-4 border-b border-border">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex px-4 py-3 gap-4 border-b border-border">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const hasTerms = terms.length > 0
  const hasComm = !!communicationStyle
  const hasRules = toneRules.length > 0
  const hasTags = expectedTags.length > 0
  const hasPersonality = hasComm || hasTags || hasRules

  if (!hasTerms && !hasPersonality) {
    return <BrandEmptyState label="バーバル" description="言葉づかいのトーンと用語のルールを登録すると、話し方や書き方が揃います。" href="/admin/brand/verbal" />
  }

  return (
    <>
    <BrandFontLoader fonts={brandFonts} />
    {companyId && <BrandPageTracker companyId={companyId} pageType="verbal" />}
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-10 space-y-6">
      {/* ビジュアル / バーバル 切替タブ */}
      <BrandExpressionTabs />

      {/* コミュニケーションスタイル + 期待タグ + 表現ルール（共通コンポーネント。Step5と装飾統一） */}
      {hasPersonality && (
        <section>
          <BrandPersonalityCard
            communicationStyle={communicationStyle}
            expectedTags={expectedTags}
            toneRules={toneRules}
            bodyTextStyle={secondaryStyle}
          />
        </section>
      )}

      {/* 用語ルール */}
      {hasTerms && (
        <section>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none overflow-hidden">
            <CardContent className="p-5 pb-0">
              <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">用語ルール</h2>

              {/* 絞り込み＋検索 */}
              {(hasCategories || terms.length > 5) && (
                <div className="flex flex-col sm:flex-row sm:items-start gap-3 mb-4">
                  {hasCategories && (
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() => setSelectedCategory('all')}
                        className={`px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
                          selectedCategory === 'all'
                            ? 'bg-foreground text-background'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        すべて
                      </button>
                      {categories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
                            selectedCategory === cat
                              ? 'bg-foreground text-background'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="relative sm:ml-auto sm:w-[240px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="用語を検索..."
                      className="h-11 pl-9"
                    />
                  </div>
                </div>
              )}
            </CardContent>
            <CardContent className="p-0">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {hasCategories && (
                      <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs w-[18%]">
                        カテゴリ
                      </th>
                    )}
                    <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs w-[25%]">
                      推奨する表現
                    </th>
                    <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs w-[25%]">
                      避ける表現
                    </th>
                    <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">
                      補足・文脈
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTerms.length > 0 ? (
                    filteredTerms.map((term, i) => (
                      <tr key={i}>
                        {hasCategories && (
                          <td className="px-4 py-3 border-b border-border text-muted-foreground text-xs">
                            {term.category || '—'}
                          </td>
                        )}
                        <td className="px-4 py-3 border-b border-border font-bold text-green-600 text-sm">
                          {term.preferred_term}
                        </td>
                        <td className="px-4 py-3 border-b border-border text-red-500 line-through text-sm">
                          {term.avoided_term}
                        </td>
                        <td className="px-4 py-3 border-b border-border text-muted-foreground text-xs">
                          {term.context || '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={hasCategories ? 4 : 3} className="px-4 py-8 text-center text-muted-foreground text-sm">
                        該当する用語が見つかりません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
    </>
  )
}
