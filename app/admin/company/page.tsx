'use client'

// 企業情報編集ページ（マルチテナント対応: 自社のレコードのみ表示・編集）
// ブランド関連項目（スローガン、MVV、ブランドストーリー、提供価値、ブランドカラー）は
// ブランド掲示の各ページで管理するため、ここでは基本情報のみ管理
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/supabase-fetch'
import { useAuth } from '../components/AdminDataProvider'
import { ImageUpload } from '../components/ImageUpload'
import { IndustrySelect } from '@/components/shared/IndustrySelect'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  name: string
  logo_url: string
  website_url: string
  industry_category: string
  industry_subcategory: string
  brand_stage: string
  competitors: Competitor[]
  target_segments: TargetSegment[]
}

// ブランドステージの定義
const BRAND_STAGES = [
  { value: 'new', label: '新規ブランド', description: 'ブランドをゼロから構築' },
  { value: 'rebrand', label: 'リブランド', description: '既存ブランドを大幅に刷新' },
] as const

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

  const fetchCompany = async () => {
    if (!companyId) return
    setLoading(true)
    setFetchError('')

    // fetchWithRetry: タイムアウト6秒 + リトライ1回（setTimeout のリーク防止＋短縮版）
    const { data, error } = await fetchWithRetry(() =>
      supabase
        .from('companies')
        .select('id, name, logo_url, website_url, industry_category, industry_subcategory, brand_stage, competitors, target_segments')
        .eq('id', companyId)
        .single()
    )

    if (error) {
      console.error('[Company] データ取得エラー:', error)
      setFetchError(error)
    } else if (data) {
      const row = data as {
        id: string; name: string | null; logo_url: string | null; website_url: string | null
        industry_category: string | null; industry_subcategory: string | null; brand_stage: string | null
        competitors: Competitor[] | null; target_segments: TargetSegment[] | null
      }
      const companyData: Company = {
        id: row.id,
        name: row.name || '',
        logo_url: row.logo_url || '',
        website_url: row.website_url || '',
        industry_category: row.industry_category || '',
        industry_subcategory: row.industry_subcategory || '',
        brand_stage: row.brand_stage || '',
        competitors: row.competitors || [],
        target_segments: row.target_segments || [],
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
      })
      .catch(() => {
        /* 残り回数の取得失敗は致命的でないため握りつぶす */
      })
    return () => {
      cancelled = true
    }
  }, [companyId])

  const handleChange = (field: keyof Company, value: string | Competitor[] | TargetSegment[]) => {
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
    if (suggestRemaining !== null && suggestRemaining <= 0) {
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

      const updateData: Record<string, unknown> = {
        name: company.name,
        logo_url: company.logo_url,
        website_url: normalizedWebsiteUrl,
        industry_category: company.industry_category || null,
        industry_subcategory: company.industry_subcategory || null,
        brand_stage: company.brand_stage || null,
        competitors: cleanedCompetitors,
        target_segments: cleanedTargetSegments,
      }

      const result = await supabasePatch('companies', company.id, updateData)

      if (!result.ok) {
        console.error('[Company Save] エラー:', result.error)
        toast.error('保存に失敗しました: ' + result.error)
      } else {
        toast.success('保存しました')
        handleChange('website_url', normalizedWebsiteUrl)
        handleChange('competitors', cleanedCompetitors)
        handleChange('target_segments', cleanedTargetSegments)
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

            {/* 企業名またはブランド名 */}
            <div className="mb-5">
              <h2 className="text-xs font-bold mb-3">企業名またはブランド名</h2>
              <Input
                type="text"
                value={company.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="株式会社○○"
                className="h-10"
              />
              <p className="text-[13px] text-muted-foreground mt-1.5">
                企業名・サービス名・個人名など、ブランディングの対象となる名称を入力してください
              </p>
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

            {/* ブランドステージ */}
            <div className="mb-5">
              <h2 className="text-xs font-bold mb-3">ブランドステージ</h2>
              <Select
                value={company.brand_stage || ''}
                onValueChange={(val) => handleChange('brand_stage', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {BRAND_STAGES.map((stage) => (
                    <SelectItem key={stage.value} value={stage.value}>
                      {stage.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            {/* 競合企業・サービス */}
            <div className="mb-5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h2 className="text-xs font-bold">競合企業・サービス</h2>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleSuggestCompetitors}
                  disabled={suggesting || suggestRemaining === 0}
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
                {suggestRemaining === 0
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
                          {/* 色ドット表示（閲覧のみ） */}
                          {comp.colors && comp.colors.length > 0 && (
                            <div className="flex gap-1 shrink-0">
                              {comp.colors.map((color, ci) => (
                                <div
                                  key={ci}
                                  className="h-4 w-4 rounded-full border border-gray-200"
                                  style={{ backgroundColor: color }}
                                  title={color}
                                />
                              ))}
                            </div>
                          )}
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
                        onClick={() => removeCompetitor(index)}
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
                        className="inline-flex items-center gap-1 break-all text-xs text-blue-700 hover:underline"
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
    </div>
  )
}
