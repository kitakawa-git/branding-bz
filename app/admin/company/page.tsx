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
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { Plus, Trash2, Check, WandSparkles, Loader2, ExternalLink } from 'lucide-react'
import { Fab, FabButton } from '@/components/ui/fab'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { COMPETITOR_SUGGEST_MONTHLY_LIMIT } from '@/lib/constants/ai-limits'

// AI提案された競合候補の型
interface SuggestedCompetitor {
  name: string
  url: string
  reason: string
}

// 競合企業の型
interface Competitor {
  name: string
  url: string
  colors: string[]
  notes: string
}

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
  competitors: Competitor[]
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

  // AI競合提案
  const [suggesting, setSuggesting] = useState(false)
  const [suggestRemaining, setSuggestRemaining] = useState<number | null>(null)
  const [suggestResetsAt, setSuggestResetsAt] = useState<string | null>(null)
  const [suggestDialogOpen, setSuggestDialogOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<SuggestedCompetitor[]>([])
  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set())
  const [suggestUnlimited, setSuggestUnlimited] = useState(false)
  // 削除確認ダイアログ対象の競合インデックス（null=非表示）
  const [competitorToDelete, setCompetitorToDelete] = useState<number | null>(null)

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
          .select('id, name, name_ja, name_en, name_display_lang, logo_url, website_url, industry_category, industry_subcategory, founded, address, representative, competitors, target_segments')
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
        competitors: Competitor[] | null; target_segments: TargetSegment[] | null
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
        competitors: row.competitors || [],
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

  // AI競合提案の今月残り回数を取得（初期表示用）
  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    fetch('/api/admin/competitors/suggest')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data) return
        if (typeof data.remaining === 'number') setSuggestRemaining(data.remaining)
        if (data.resetsAt) setSuggestResetsAt(data.resetsAt)
        setSuggestUnlimited(data.unlimited === true)
      })
      .catch(() => {
        /* 残り回数の取得失敗は致命的でないため握りつぶす */
      })
    return () => {
      cancelled = true
    }
  }, [companyId])

  const handleChange = (field: keyof Company, value: string | Competitor[] | TargetSegment[] | BusinessContentItem[]) => {
    setCompany(prev => prev ? { ...prev, [field]: value } : null)
  }

  // URL正規化: http(s)://がなければhttps://を自動付与、空欄はそのまま
  const normalizeUrl = (url: string): string => {
    const trimmed = url.trim()
    if (!trimmed) return ''
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
    return 'https://' + trimmed
  }

  // 競合企業の操作
  const addCompetitor = () => {
    if (!company) return
    if (company.competitors.length >= 10) {
      toast.error('競合企業は最大10社まで登録できます')
      return
    }
    handleChange('competitors', [...company.competitors, { name: '', url: '', colors: [], notes: '' }])
  }

  const updateCompetitor = (index: number, field: keyof Competitor, value: string) => {
    if (!company) return
    const updated = [...company.competitors]
    updated[index] = { ...updated[index], [field]: value }
    handleChange('competitors', updated)
  }

  const removeCompetitor = (index: number) => {
    if (!company) return
    const updated = company.competitors.filter((_, i) => i !== index)
    handleChange('competitors', updated)
  }

  // 社名・URLホストの正規化（重複判定用。サーバー側と同一ロジック）
  const normName = (s: string): string => (s || '').trim().toLowerCase()
  const normHost = (u: string): string => {
    let h = (u || '').trim().toLowerCase()
    if (!h) return ''
    h = h.replace(/^https?:\/\//, '').replace(/^www\./, '')
    h = h.split(/[/?#]/)[0]
    return h.replace(/\/$/, '')
  }

  // ISO日時（翌月1日00:00 JST）を「○月○日」表記に
  const formatResetDate = (iso: string | null): string => {
    if (!iso) return ''
    const jst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000)
    return `${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日`
  }

  // AIで競合を提案
  const handleSuggestCompetitors = async () => {
    if (!company || suggesting) return
    if (!suggestUnlimited && suggestRemaining !== null && suggestRemaining <= 0) {
      toast.error('今月の利用上限に達しました')
      return
    }
    setSuggesting(true)
    try {
      const res = await fetch('/api/admin/competitors/suggest', { method: 'POST' })
      const data = await res.json().catch(() => ({}))

      if (res.status === 429) {
        setSuggestRemaining(0)
        if (data.resetsAt) setSuggestResetsAt(data.resetsAt)
        toast.error('今月の利用上限に達しました')
        return
      }
      if (!res.ok) {
        toast.error('競合の提案に失敗しました。時間をおいて再度お試しください')
        return
      }

      if (typeof data.remaining === 'number') setSuggestRemaining(data.remaining)
      if (data.resetsAt) setSuggestResetsAt(data.resetsAt)
      setSuggestUnlimited(data.unlimited === true)

      const list: SuggestedCompetitor[] = Array.isArray(data.suggestions) ? data.suggestions : []
      if (list.length === 0) {
        toast.info('新たな競合候補は見つかりませんでした')
        return
      }
      setSuggestions(list)
      setSelectedIdx(new Set(list.map((_, i) => i))) // 既定で全選択
      setSuggestDialogOpen(true)
    } catch (err) {
      console.error('[Company] AI競合提案エラー:', err)
      toast.error('競合の提案に失敗しました。時間をおいて再度お試しください')
    } finally {
      setSuggesting(false)
    }
  }

  const toggleSuggestion = (index: number) => {
    setSelectedIdx(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const toggleAllSuggestions = () => {
    setSelectedIdx(prev =>
      prev.size === suggestions.length ? new Set() : new Set(suggestions.map((_, i) => i)),
    )
  }

  // 選択した候補を competitors に APPEND（既存と重複はスキップ・最大10社）
  const addSelectedSuggestions = () => {
    if (!company) return
    const existing = company.competitors
    const existingNames = new Set(existing.map(c => normName(c.name)).filter(Boolean))
    const existingHosts = new Set(existing.map(c => normHost(c.url)).filter(Boolean))

    const toAdd: Competitor[] = []
    let skipped = 0
    let capped = 0

    suggestions.forEach((s, i) => {
      if (!selectedIdx.has(i)) return
      const n = normName(s.name)
      const h = normHost(s.url)
      if (existingNames.has(n) || (h && existingHosts.has(h))) {
        skipped++
        return
      }
      if (existing.length + toAdd.length >= 10) {
        capped++
        return
      }
      existingNames.add(n)
      if (h) existingHosts.add(h)
      toAdd.push({ name: s.name, url: s.url, notes: s.reason, colors: [] })
    })

    if (toAdd.length > 0) {
      handleChange('competitors', [...existing, ...toAdd])
    }

    setSuggestDialogOpen(false)

    const parts: string[] = []
    if (toAdd.length > 0) parts.push(`${toAdd.length}社を追加しました`)
    if (skipped > 0) parts.push(`重複${skipped}社をスキップ`)
    if (capped > 0) parts.push(`上限(10社)超過${capped}社をスキップ`)
    const msg = parts.length > 0 ? parts.join('・') : '追加対象がありませんでした'
    if (toAdd.length > 0) {
      toast.success(`${msg}（「保存」で確定します）`)
    } else {
      toast.info(msg)
    }
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

      // 競合企業のURLも正規化し、空名を除外
      const cleanedCompetitors = company.competitors
        .filter(c => c.name.trim() !== '')
        .map(c => ({
          ...c,
          name: c.name.trim(),
          url: normalizeUrl(c.url),
          notes: c.notes.trim(),
        }))

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
        competitors: cleanedCompetitors,
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
        // 保存後の正規化済み state（competitors/事業内容のid・表示順を反映）をキャッシュへも反映
        const nextCompany: Company = {
          ...company,
          name: syncedName,
          website_url: normalizedWebsiteUrl,
          competitors: cleanedCompetitors,
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
            {/* 企業名／業種／ブランドステージ／ウェブサイトURL／競合 */}
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
                  <Input
                    type="text"
                    value={company.founded}
                    onChange={(e) => handleChange('founded', e.target.value)}
                    placeholder="例: 2020年4月"
                    className="h-10"
                  />
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

            {/* 競合企業・サービス */}
            <div className="mb-5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h2 className="text-xs font-bold">競合企業・サービス</h2>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleSuggestCompetitors}
                  disabled={suggesting || (!suggestUnlimited && suggestRemaining === 0)}
                  className="text-sm"
                >
                  {suggesting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <WandSparkles size={14} />
                  )}
                  {suggesting ? 'AI提案中...' : 'AIで競合を提案'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {suggestUnlimited
                  ? 'AIによる提案（テストモード・無制限）'
                  : suggestRemaining === 0
                    ? `今月の利用上限に達しました（${formatResetDate(suggestResetsAt)}にリセット）`
                    : suggestRemaining !== null
                      ? `AIによる提案は月${COMPETITOR_SUGGEST_MONTHLY_LIMIT}回まで・今月あと ${suggestRemaining} 回`
                      : `AIによる提案は月${COMPETITOR_SUGGEST_MONTHLY_LIMIT}回まで`}
              </p>
              {company.competitors.length > 0 && (
                <div className="space-y-3 mb-3">
                  {company.competitors.map((comp, index) => (
                    <div key={index} className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white p-3">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            value={comp.name}
                            onChange={(e) => updateCompetitor(index, 'name', e.target.value)}
                            placeholder="企業名（必須）"
                            className="h-9 text-sm"
                          />
                          {/* 色ドット表示（閲覧のみ）。色未指定のフォールバック #888888 と空は非表示 */}
                          {(() => {
                            const realColors = (comp.colors ?? []).filter(
                              c => c && c.trim() && c.trim().toLowerCase() !== '#888888'
                            )
                            if (realColors.length === 0) return null
                            return (
                              <div className="flex gap-1 shrink-0">
                                {realColors.map((color, ci) => (
                                  <div
                                    key={ci}
                                    className="h-4 w-4 rounded-full border border-gray-200"
                                    style={{ backgroundColor: color }}
                                    title={color}
                                  />
                                ))}
                              </div>
                            )
                          })()}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Input
                            value={comp.url}
                            onChange={(e) => updateCompetitor(index, 'url', e.target.value)}
                            placeholder="https://..."
                            className="h-9 text-sm"
                          />
                          <Input
                            value={comp.notes}
                            onChange={(e) => updateCompetitor(index, 'notes', e.target.value)}
                            placeholder="メモ"
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setCompetitorToDelete(index)}
                        className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {company.competitors.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCompetitor}
                  className="text-sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  競合企業・サービスを追加
                </Button>
              )}
              {company.competitors.length >= 10 && (
                <p className="text-xs text-muted-foreground mt-1">最大10社まで登録できます</p>
              )}
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

      {/* AI競合提案の候補選択ダイアログ */}
      <Dialog open={suggestDialogOpen} onOpenChange={setSuggestDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>AIによる競合候補</DialogTitle>
            <DialogDescription>
              web検索で見つかった実在の競合候補です。追加するものを選択してください。
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {selectedIdx.size} / {suggestions.length} 件を選択中
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleAllSuggestions}
              className="h-7 text-xs"
            >
              {selectedIdx.size === suggestions.length ? '全解除' : '全選択'}
            </Button>
          </div>

          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {suggestions.map((s, i) => {
              const selected = selectedIdx.has(i)
              return (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleSuggestion(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleSuggestion(i)
                    }
                  }}
                  className={`flex w-full cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                    selected
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  {/* チェックボックス風インジケータ */}
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    {selected && <Check size={12} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900">{s.name}</div>
                    {s.url && (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 break-all text-xs text-ds-app-accent-hover hover:underline"
                      >
                        {s.url}
                        <ExternalLink size={11} className="shrink-0" />
                      </a>
                    )}
                    {s.reason && <p className="mt-1 text-xs text-gray-600">{s.reason}</p>}
                  </div>
                </div>
              )
            })}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSuggestDialogOpen(false)}>
              キャンセル
            </Button>
            <Button type="button" onClick={addSelectedSuggestions} disabled={selectedIdx.size === 0}>
              選択した競合を追加（{selectedIdx.size}）
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 競合削除の確認ダイアログ */}
      <AlertDialog
        open={competitorToDelete !== null}
        onOpenChange={(open) => { if (!open) setCompetitorToDelete(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>この競合を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {competitorToDelete !== null && company?.competitors[competitorToDelete]?.name
                ? `「${company.competitors[competitorToDelete].name}」を削除します。`
                : 'この競合を削除します。'}
              この操作は取り消せません（「保存」で確定します）。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (competitorToDelete !== null) removeCompetitor(competitorToDelete)
                setCompetitorToDelete(null)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
