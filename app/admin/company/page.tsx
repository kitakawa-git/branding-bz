'use client'

// 企業情報編集ページ（マルチテナント対応: 自社のレコードのみ表示・編集）
// ブランド関連項目（スローガン、MVV、ブランドストーリー、提供価値、ブランドカラー）は
// ブランド掲示の各ページで管理するため、ここでは基本情報のみ管理
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { ImageUpload } from '../components/ImageUpload'
import { IndustrySelect } from '@/components/shared/IndustrySelect'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { Plus, Trash2 } from 'lucide-react'

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

  const fetchCompany = async (retryCount = 0) => {
    if (!companyId) return
    if (retryCount === 0) {
      setLoading(true)
      setFetchError('')
    }

    const MAX_RETRIES = 2

    try {
      const result = await Promise.race([
        supabase
          .from('companies')
          .select('id, name, logo_url, website_url, industry_category, industry_subcategory, brand_stage, competitors, target_segments')
          .eq('id', companyId)
          .single(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 15000)
        ),
      ])

      if (result.error) throw new Error(result.error.message)
      if (result.data) {
        const companyData: Company = {
          id: result.data.id,
          name: result.data.name || '',
          logo_url: result.data.logo_url || '',
          website_url: result.data.website_url || '',
          industry_category: result.data.industry_category || '',
          industry_subcategory: result.data.industry_subcategory || '',
          brand_stage: result.data.brand_stage || '',
          competitors: (result.data.competitors as Competitor[]) || [],
          target_segments: (result.data.target_segments as TargetSegment[]) || [],
        }
        setCompany(companyData)
        setPageCache(cacheKey, companyData)
      }
    } catch (err) {
      console.error(`[Company] データ取得エラー (試行${retryCount + 1}/${MAX_RETRIES + 1}):`, err)

      if (retryCount < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)))
        return fetchCompany(retryCount + 1)
      }

      const msg = err instanceof Error && err.message === 'timeout'
        ? 'データの取得がタイムアウトしました。再読み込みをお試しください。'
        : 'データの取得に失敗しました'
      setFetchError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<Company>(cacheKey)) return
    fetchCompany()
  }, [companyId, cacheKey])

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
        <Skeleton className="h-8 w-44 mb-6" />
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 space-y-6">
            <div>
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-24 w-24 rounded-lg" />
            </div>
            <div>
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div>
              <Skeleton className="h-4 w-28 mb-2" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="text-center p-10">
        <p className="text-red-600 text-sm mb-3">{fetchError}</p>
        <Button variant="outline" onClick={() => fetchCompany(0)} className="py-2 px-4 text-[13px]">
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
      <h1 className="text-2xl font-bold text-foreground mb-6">
        ブランド基本情報
      </h1>

      <form id="company-form" onSubmit={handleSubmit} className="space-y-6">
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            {/* ロゴ */}
            <div className="mb-5">
              <h2 className="text-sm font-bold mb-3">ロゴ</h2>
              <ImageUpload
                bucket="avatars"
                folder="logos"
                currentUrl={company.logo_url}
                onUpload={(url) => handleChange('logo_url', url)}
              />
            </div>

            {/* 企業名・ブランド名 */}
            <div className="mb-5">
              <h2 className="text-sm font-bold mb-3">企業名・ブランド名</h2>
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
              <h2 className="text-sm font-bold mb-3">業種</h2>
              <IndustrySelect
                category={company.industry_category}
                subcategory={company.industry_subcategory}
                onCategoryChange={(val) => handleChange('industry_category', val)}
                onSubcategoryChange={(val) => handleChange('industry_subcategory', val)}
              />
            </div>

            {/* ブランドステージ */}
            <div className="mb-5">
              <h2 className="text-sm font-bold mb-3">ブランドステージ</h2>
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
              <h2 className="text-sm font-bold mb-3">ウェブサイトURL</h2>
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
              <h2 className="text-sm font-bold mb-3">競合企業・サービス</h2>
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

      {/* 固定保存バー */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex justify-end">
        <Button
          type="submit"
          form="company-form"
          disabled={saving}
          className={`${saving ? 'opacity-60' : ''}`}
        >
          {saving ? '保存中...' : '保存する'}
        </Button>
      </div>
    </div>
  )
}
