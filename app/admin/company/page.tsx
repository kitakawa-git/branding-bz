'use client'

// 企業情報編集ページ（マルチテナント対応: 自社のレコードのみ表示・編集）
// ブランド関連項目（スローガン、MVV、ブランドストーリー、提供価値、ブランドカラー）は
// ブランド掲示の各ページで管理。ここでは基本情報＋事業内容（philosophy_elements の service 行）を管理する。
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/supabase-fetch'
import { useAuth } from '../components/AdminDataProvider'
import { ImageUpload } from '../components/ImageUpload'
import { IndustrySelect } from '@/components/shared/IndustrySelect'
import { BusinessContentEditor, type BusinessContentItem } from '@/components/shared/BusinessContentEditor'
import { parseYearMonth, formatYearMonth, YEAR_OPTIONS } from '@/lib/year-month'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { Check } from 'lucide-react'
import { Fab, FabButton } from '@/components/ui/fab'

// ターゲットセグメントの型
interface TargetSegment {
  name: string
  description: string
}

type Company = {
  id: string
  // name は保存時に表示言語トグルで選んだ表記へ自動同期する派生値（各所の表示はこれを読む）
  name: string
  // 企業名の表記。日本語/英語。表示はトグル name_display_lang で選択
  name_ja: string
  name_en: string
  name_display_lang: 'ja' | 'en'
  logo_url: string
  website_url: string
  industry_category: string
  industry_subcategory: string
  // 会社概要（ポータル「会社について」で表示）
  founded: string
  address: string
  representative: string
  target_segments: TargetSegment[]
  // 事業内容（philosophy_elements の service 行）。表示順は business_content_sort。
  // 実データは companies ではなく philosophy_elements / brand_guidelines に保存する。
  business_content: BusinessContentItem[]
  business_content_sort: 'registered' | 'custom'
}

export default function CompanyPage() {
  const { companyId } = useAuth()
  const cacheKey = `admin-company-${companyId}`
  const cached = companyId ? getPageCache<Company>(cacheKey) : null
  const [company, setCompany] = useState<Company | null>(cached)
  const [loading, setLoading] = useState(!cached)
  const [fetchError, setFetchError] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchCompany = async () => {
    if (!companyId) return
    setLoading(true)
    setFetchError('')

    // fetchWithRetry: タイムアウト6秒 + リトライ1回（setTimeout のリーク防止＋短縮版）
    // 事業内容（service 行）と表示順（business_content_sort）も並列取得する。
    const [companyRes, serviceRes, guidelinesRes] = await Promise.all([
      fetchWithRetry(() =>
        supabase
          .from('companies')
          .select('id, name, name_ja, name_en, name_display_lang, logo_url, website_url, industry_category, industry_subcategory, founded, address, representative, target_segments')
          .eq('id', companyId)
          .single()
      ),
      fetchWithRetry(() =>
        supabase
          .from('philosophy_elements')
          .select('id, title, body, sort_order')
          .eq('company_id', companyId)
          .eq('element_type', 'service')
          .order('sort_order', { ascending: true })
      ),
      fetchWithRetry(() =>
        supabase
          .from('brand_guidelines')
          .select('business_content_sort')
          .eq('company_id', companyId)
          .maybeSingle()
      ),
    ])
    const { data, error } = companyRes

    if (error) {
      console.error('[Company] データ取得エラー:', error)
      setFetchError(error)
    } else if (data) {
      const row = data as {
        id: string; name: string | null
        name_ja: string | null; name_en: string | null
        name_display_lang: string | null
        logo_url: string | null; website_url: string | null
        industry_category: string | null; industry_subcategory: string | null
        founded: string | null; address: string | null; representative: string | null
        target_segments: TargetSegment[] | null
      }
      const rawName = row.name || ''
      let nameJa = row.name_ja || ''
      let nameEn = row.name_en || ''
      // 旧来の単一 name しか無い企業は、ASCII なら英語表記・それ以外は日本語表記へ寄せて初期表示（移行）
      if (!nameJa && !nameEn && rawName) {
        if (/^[\x00-\x7F]+$/.test(rawName)) nameEn = rawName
        else nameJa = rawName
      }
      // デフォルトは日本語。明示的に 'en' の時のみ英語。
      const displayLang: 'ja' | 'en' = row.name_display_lang === 'en' ? 'en' : 'ja'
      // 事業内容（philosophy_elements の service 行）。id を保持し保存時の差分計算に使う。
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const serviceRows = (serviceRes.data as any[] | null) || []
      const businessContent: BusinessContentItem[] = serviceRows.map((r, i) => ({
        id: r.id as string,
        title: (r.title as string) || '',
        description: (r.body as string) || '',
        added_index: (r.sort_order as number) ?? i,
      }))
      const guidelinesRow = guidelinesRes.data as { business_content_sort?: string | null } | null
      const businessSort: 'registered' | 'custom' =
        guidelinesRow?.business_content_sort === 'custom' ? 'custom' : 'registered'
      const companyData: Company = {
        id: row.id,
        name: rawName,
        name_ja: nameJa,
        name_en: nameEn,
        name_display_lang: displayLang,
        logo_url: row.logo_url || '',
        website_url: row.website_url || '',
        industry_category: row.industry_category || '',
        industry_subcategory: row.industry_subcategory || '',
        founded: row.founded || '',
        address: row.address || '',
        representative: row.representative || '',
        target_segments: row.target_segments || [],
        business_content: businessContent,
        business_content_sort: businessSort,
      }
      setCompany(companyData)
      setPageCache(cacheKey, companyData)
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<Company>(cacheKey)) return
    fetchCompany()
  }, [companyId, cacheKey])

  const handleChange = (field: keyof Company, value: string | TargetSegment[] | BusinessContentItem[]) => {
    setCompany(prev => prev ? { ...prev, [field]: value } : null)
  }

  // URL正規化: http(s)://がなければhttps://を自動付与、空欄はそのまま
  const normalizeUrl = (url: string): string => {
    const trimmed = url.trim()
    if (!trimmed) return ''
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
    return 'https://' + trimmed
  }

  // Supabase REST APIに直接fetchで保存（JSクライアントの認証ハングを回避）
  const supabasePatch = async (table: string, id: string, data: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> => {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    // セッショントークンを取得（RLSポリシー用）
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token || ''

    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!res.ok) {
        const body = await res.text()
        return { ok: false, error: `HTTP ${res.status}: ${body}` }
      }
      return { ok: true }
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false, error: 'タイムアウト（10秒）: サーバーからの応答がありません。' }
      }
      return { ok: false, error: err instanceof Error ? err.message : '不明なエラー' }
    }
  }

  // Supabase REST API直接fetch (INSERT)。brand_guidelines 行の新規作成に使う。
  const supabaseInsert = async (table: string, data: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> => {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token || ''

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (!res.ok) {
        const body = await res.text()
        return { ok: false, error: `HTTP ${res.status}: ${body}` }
      }
      return { ok: true }
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false, error: 'タイムアウト（10秒）' }
      }
      return { ok: false, error: err instanceof Error ? err.message : '不明なエラー' }
    }
  }

  // 事業内容を philosophy_elements の service 行へ同期（id一致でUPDATE・id無しでINSERT・不要行DELETE）。
  // element_type='service' でスコープされるため、他の理念要素（mission/vision/value/action_guideline）には触れない。
  // sort_order = 表示順（配列インデックス）。保存後の id・表示順を反映した配列を返す。
  const syncServiceElements = async (
    desired: BusinessContentItem[],
  ): Promise<{ ok: boolean; error?: string; business: BusinessContentItem[] }> => {
    try {
      const now = new Date().toISOString()
      const { data: exRows, error: exErr } = await supabase
        .from('philosophy_elements')
        .select('id')
        .eq('company_id', companyId)
        .eq('element_type', 'service')
      if (exErr) throw exErr
      const existingIds = new Set((exRows as { id: string }[] | null)?.map((r) => r.id) ?? [])
      const kept = new Set<string>()
      const ids: string[] = []
      for (let i = 0; i < desired.length; i++) {
        const d = desired[i]
        if (d.id && existingIds.has(d.id)) {
          const { error } = await supabase
            .from('philosophy_elements')
            .update({ title: d.title, body: d.description, sort_order: i, status: 'published', updated_at: now })
            .eq('id', d.id)
          if (error) throw error
          kept.add(d.id)
          ids.push(d.id)
        } else {
          const { data, error } = await supabase
            .from('philosophy_elements')
            .insert({ company_id: companyId, element_type: 'service', title: d.title, body: d.description, sort_order: i, status: 'published' })
            .select('id')
            .single()
          if (error) throw error
          const nid = (data as { id: string }).id
          kept.add(nid)
          ids.push(nid)
        }
      }
      const toDelete = [...existingIds].filter((id) => !kept.has(id))
      if (toDelete.length > 0) {
        const { error } = await supabase.from('philosophy_elements').delete().in('id', toDelete)
        if (error) throw error
      }
      const business: BusinessContentItem[] = desired.map((b, i) => ({ ...b, id: ids[i], added_index: i }))
      return { ok: true, business }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : '不明なエラー', business: desired }
    }
  }

  // 事業内容の表示順トグルを brand_guidelines へ保存（行があればPATCH・無ければINSERT）。
  const saveBusinessContentSort = async (sort: 'registered' | 'custom'): Promise<{ ok: boolean; error?: string }> => {
    try {
      const { data: bgRow, error: bgErr } = await supabase
        .from('brand_guidelines')
        .select('id')
        .eq('company_id', companyId)
        .maybeSingle()
      if (bgErr) throw new Error(bgErr.message)
      const bgId = (bgRow as { id: string } | null)?.id ?? null
      if (bgId) {
        return await supabasePatch('brand_guidelines', bgId, { business_content_sort: sort })
      }
      return await supabaseInsert('brand_guidelines', { company_id: companyId, business_content_sort: sort })
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : '不明なエラー' }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!company) return
    setSaving(true)

    try {
      const normalizedWebsiteUrl = normalizeUrl(company.website_url)

      // ターゲットセグメントの空名を除外
      const cleanedTargetSegments = company.target_segments
        .filter(ts => ts.name.trim() !== '')
        .map(ts => ({
          name: ts.name.trim(),
          description: ts.description.trim(),
        }))

      // 事業内容の空タイトル行を除外（philosophy_elements の service 行へ同期）
      const cleanedBusiness = company.business_content.filter(b => b.title.trim() !== '')

      // name は表示言語トグルで選んだ表記へ同期。選択側が空なら他方→従来 name の順でフォールバック（空にしない）
      const ja = company.name_ja.trim()
      const en = company.name_en.trim()
      const preferred = company.name_display_lang === 'en' ? en : ja
      const other = company.name_display_lang === 'en' ? ja : en
      const syncedName = preferred || other || company.name

      const updateData: Record<string, unknown> = {
        name: syncedName,
        name_ja: ja || null,
        name_en: en || null,
        name_display_lang: company.name_display_lang,
        logo_url: company.logo_url,
        website_url: normalizedWebsiteUrl,
        industry_category: company.industry_category || null,
        industry_subcategory: company.industry_subcategory || null,
        founded: company.founded.trim() || null,
        address: company.address.trim() || null,
        representative: company.representative.trim() || null,
        target_segments: cleanedTargetSegments,
      }

      const result = await supabasePatch('companies', company.id, updateData)

      // 事業内容（service 行）と表示順を同期
      const bizResult = await syncServiceElements(cleanedBusiness)
      const sortResult = await saveBusinessContentSort(company.business_content_sort)

      if (!result.ok) {
        console.error('[Company Save] エラー:', result.error)
        toast.error('保存に失敗しました: ' + result.error)
      } else if (!bizResult.ok || !sortResult.ok) {
        console.error('[Company Save] 事業内容エラー:', bizResult.error || sortResult.error)
        toast.error('保存に失敗しました: ' + (bizResult.error || sortResult.error))
      } else {
        toast.success('保存しました')
        // 保存後の正規化済み state（事業内容のid・表示順を反映）をキャッシュへも反映
        const nextCompany: Company = {
          ...company,
          name: syncedName,
          website_url: normalizedWebsiteUrl,
          target_segments: cleanedTargetSegments,
          business_content: bizResult.business,
        }
        setCompany(nextCompany)
        setPageCache(cacheKey, nextCompany)
      }
    } catch (err) {
      console.error('[Company Save] 予期しないエラー:', err)
      const errorMessage = err instanceof Error ? err.message : '不明なエラーが発生しました'
      toast.error('保存に失敗しました: ' + errorMessage)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div>
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 space-y-5">
            {/* ロゴ */}
            <div>
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-24 w-24 rounded-lg" />
            </div>
            {/* 企業名／業種／ウェブサイトURL／概要／事業内容 */}
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i}>
                <Skeleton className="h-4 w-28 mb-2" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="text-center p-10">
        <p className="text-red-600 text-sm mb-3">{fetchError}</p>
        <Button variant="outline" onClick={() => fetchCompany()} className="py-2 px-4 text-[13px]">
          再読み込み
        </Button>
      </div>
    )
  }

  if (!company) {
    return (
      <p className="text-muted-foreground text-center p-10">
        企業データが見つかりません
      </p>
    )
  }

  return (
    <div>
      <form id="company-form" onSubmit={handleSubmit} className="space-y-6">
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            {/* ロゴ */}
            <div className="mb-5">
              <h2 className="text-xs font-bold mb-3">ロゴ</h2>
              <ImageUpload
                bucket="avatars"
                folder="logos"
                currentUrl={company.logo_url}
                onUpload={(url) => handleChange('logo_url', url)}
              />
            </div>

            {/* 企業名またはブランド名（日本語/英語＋表示トグル） */}
            <div className="mb-5">
              <h2 className="text-xs font-bold mb-3">企業名またはブランド名</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] text-gray-500 mb-1.5">日本語表記</p>
                  <Input
                    type="text"
                    value={company.name_ja}
                    onChange={(e) => handleChange('name_ja', e.target.value)}
                    placeholder="例: 株式会社サンプル"
                    className="h-10"
                  />
                </div>
                <div>
                  <p className="text-[11px] text-gray-500 mb-1.5">英語表記</p>
                  <Input
                    type="text"
                    value={company.name_en}
                    onChange={(e) => handleChange('name_en', e.target.value)}
                    placeholder="例: Sample Inc."
                    className="h-10"
                  />
                </div>
              </div>

              {/* 表示に使う表記のトグル */}
              <div className="mt-3 flex items-center gap-3">
                <p className="text-[11px] text-gray-500 m-0 shrink-0">表示に使う表記</p>
                <div className="flex rounded-lg border border-border overflow-hidden">
                  {([
                    { value: 'ja' as const, label: '日本語' },
                    { value: 'en' as const, label: '英語' },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleChange('name_display_lang', opt.value)}
                      className={`px-4 py-1.5 text-xs font-medium transition-colors ${
                        company.name_display_lang === opt.value
                          ? 'bg-foreground text-background'
                          : 'bg-background text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 業種 */}
            <div className="mb-5">
              <h2 className="text-xs font-bold mb-3">業種</h2>
              <IndustrySelect
                category={company.industry_category}
                subcategory={company.industry_subcategory}
                onCategoryChange={(val) => handleChange('industry_category', val)}
                onSubcategoryChange={(val) => handleChange('industry_subcategory', val)}
              />
            </div>

            {/* WebサイトURL */}
            <div className="mb-5">
              <h2 className="text-xs font-bold mb-3">ウェブサイトURL</h2>
              <Input
                type="text"
                value={company.website_url}
                onChange={(e) => handleChange('website_url', e.target.value)}
                placeholder="https://example.com"
                className="h-10"
              />
            </div>

            {/* 概要（ポータル「私たちについて」に表示） */}
            <div className="mb-5">
              <h2 className="text-xs font-bold mb-3">概要</h2>
              <p className="text-[13px] text-muted-foreground mb-3">
                ポータルの「私たちについて」ページに表示されます（任意）
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-[11px] text-gray-500 mb-1.5">設立</p>
                  {(() => {
                    const { year, month } = parseYearMonth(company.founded)
                    return (
                      <div className="flex gap-1">
                        <select
                          value={year}
                          onChange={(e) => handleChange('founded', formatYearMonth(e.target.value, month))}
                          className="h-10 rounded-md border border-input bg-white px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="">年</option>
                          {YEAR_OPTIONS.map(y => (
                            <option key={y} value={y}>{y}年</option>
                          ))}
                        </select>
                        <select
                          value={month}
                          onChange={(e) => handleChange('founded', formatYearMonth(year, e.target.value))}
                          className="h-10 rounded-md border border-input bg-white px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="">月</option>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(mo => (
                            <option key={mo} value={mo}>{mo}月</option>
                          ))}
                        </select>
                      </div>
                    )
                  })()}
                </div>
                <div>
                  <p className="text-[11px] text-gray-500 mb-1.5">代表者</p>
                  <Input
                    type="text"
                    value={company.representative}
                    onChange={(e) => handleChange('representative', e.target.value)}
                    placeholder="例: 山田太郎"
                    className="h-10"
                  />
                </div>
                <div className="sm:col-span-3">
                  <p className="text-[11px] text-gray-500 mb-1.5">所在地</p>
                  <Input
                    type="text"
                    value={company.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    placeholder="例: 東京都千代田区..."
                    className="h-10"
                  />
                </div>
              </div>
            </div>

            {/* 事業内容（philosophy_elements の service 行。表示はポータル「私たちについて」） */}
            <div className="mb-5">
              <BusinessContentEditor
                items={company.business_content}
                sort={company.business_content_sort}
                onSortChange={(s) => handleChange('business_content_sort', s)}
                onItemsChange={(items) => handleChange('business_content', items)}
              />
            </div>

          </CardContent>
        </Card>
      </form>

      {/* FabBar との重なりを防ぐスペーサー */}
      <div className="h-24" />

      {/* 保存 FAB（右下固定・include-bz node の FabButton と同装飾） */}
      <Fab>
        <FabButton type="submit" form="company-form" disabled={saving} icon={<Check size={16} />}>
          {saving ? '保存中...' : '保存'}
        </FabButton>
      </Fab>
    </div>
  )
}
