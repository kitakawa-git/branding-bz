'use client'

// バーバルアイデンティティ 編集ページ（トーンオブボイス・コミュニケーションスタイル・用語ルール統合）
import { useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/supabase-fetch'
import { useAuth } from '../../components/AuthProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { DEFAULT_SUBTITLES, type PortalSubtitles } from '@/lib/portal-subtitles'
import { Plus, Trash2 } from 'lucide-react'

type Personality = {
  tone_of_voice: string
}

type TermItem = {
  preferred_term: string
  avoided_term: string
  context: string
  category: string
}

type VerbalCache = {
  personalityId: string | null
  personality: Personality
  terms: TermItem[]
  portalSubtitle: string
  portalSubtitlesData: PortalSubtitles | null
}

export default function VerbalIdentityPage() {
  const { companyId } = useAuth()
  const cacheKey = `admin-brand-verbal-${companyId}`
  const cached = companyId ? getPageCache<VerbalCache>(cacheKey) : null
  const [personalityId, setPersonalityId] = useState<string | null>(cached?.personalityId ?? null)
  const [personality, setPersonality] = useState<Personality>(cached?.personality ?? {
    tone_of_voice: '',
  })
  const [terms, setTerms] = useState<TermItem[]>(cached?.terms ?? [])
  const [loading, setLoading] = useState(!cached)
  const [fetchError, setFetchError] = useState('')
  const [saving, setSaving] = useState(false)
  const [portalSubtitle, setPortalSubtitle] = useState(cached?.portalSubtitle ?? '')
  const [portalSubtitlesData, setPortalSubtitlesData] = useState<PortalSubtitles | null>(cached?.portalSubtitlesData ?? null)

  const fetchData = async () => {
    if (!companyId) return
    setLoading(true)
    setFetchError('')

    try {
      const [personalityRes, termsRes] = await Promise.all([
        fetchWithRetry(() => supabase.from('brand_personalities').select('*').eq('company_id', companyId).single()),
        fetchWithRetry(() => supabase.from('brand_terms').select('*').eq('company_id', companyId).order('sort_order')),
      ])
      if (personalityRes.error) throw new Error(personalityRes.error)
      if (termsRes.error) throw new Error(termsRes.error)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const personalityData = personalityRes.data as Record<string, any> | null
      const termsData = termsRes.data as Record<string, unknown>[] | null

      // ポータルサブタイトル取得
      let fetchedSubtitle = ''
      let fetchedSubtitlesData: PortalSubtitles | null = null
      try {
        const { data: companyData } = await supabase
          .from('companies')
          .select('portal_subtitles')
          .eq('id', companyId)
          .single()
        if (companyData) {
          const subtitles = (companyData.portal_subtitles as PortalSubtitles) || null
          fetchedSubtitlesData = subtitles
          fetchedSubtitle = subtitles?.verbal || ''
          setPortalSubtitlesData(subtitles)
          setPortalSubtitle(fetchedSubtitle)
        }
      } catch {
        // サブタイトル取得失敗は無視
      }

      let parsedPersonalityId: string | null = null
      let parsedPersonality: Personality = { tone_of_voice: '' }
      if (personalityData) {
        parsedPersonalityId = personalityData.id
        parsedPersonality = {
          tone_of_voice: personalityData.tone_of_voice || '',
        }
        setPersonalityId(parsedPersonalityId)
        setPersonality(parsedPersonality)
      }

      let parsedTerms: TermItem[] = []
      if (termsData && termsData.length > 0) {
        parsedTerms = termsData.map((d: Record<string, unknown>) => ({
          preferred_term: (d.preferred_term as string) || '',
          avoided_term: (d.avoided_term as string) || '',
          context: (d.context as string) || '',
          category: (d.category as string) || '',
        }))
        setTerms(parsedTerms)
      }

      setPageCache(cacheKey, {
        personalityId: parsedPersonalityId,
        personality: parsedPersonality,
        terms: parsedTerms,
        portalSubtitle: fetchedSubtitle,
        portalSubtitlesData: fetchedSubtitlesData,
      })
    } catch (err) {
      console.error('[VerbalIdentity] データ取得エラー:', err)
      const msg = err instanceof Error ? err.message : 'データの取得に失敗しました'
      setFetchError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<VerbalCache>(cacheKey)) return
    fetchData()
  }, [companyId, cacheKey])

  const handleChange = (field: keyof Personality, value: string) => {
    setPersonality(prev => ({ ...prev, [field]: value }))
  }

  // --- 用語ルール操作 ---
  // --- カテゴリ候補 ---
  const existingCategories = useMemo(() => {
    const cats = terms.map(t => t.category).filter(c => c.trim() !== '')
    return [...new Set(cats)]
  }, [terms])

  const addTerm = () => {
    setTerms([...terms, { preferred_term: '', avoided_term: '', context: '', category: '' }])
  }

  const updateTerm = (index: number, field: keyof TermItem, value: string) => {
    const updated = [...terms]
    updated[index] = { ...updated[index], [field]: value }
    setTerms(updated)
  }

  const removeTerm = (index: number) => {
    setTerms(terms.filter((_, i) => i !== index))
  }

  // Supabase REST API直接fetch
  const supabasePatch = async (table: string, id: string, data: Record<string, unknown>, token: string): Promise<{ ok: boolean; error?: string }> => {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
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
        return { ok: false, error: 'タイムアウト（10秒）' }
      }
      return { ok: false, error: err instanceof Error ? err.message : '不明なエラー' }
    }
  }

  const supabaseInsert = async (table: string, data: Record<string, unknown>, token: string): Promise<{ ok: boolean; error?: string; data?: Record<string, unknown> }> => {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (!res.ok) {
        const body = await res.text()
        return { ok: false, error: `HTTP ${res.status}: ${body}` }
      }
      const result = await res.json()
      return { ok: true, data: result[0] }
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false, error: 'タイムアウト（10秒）' }
      }
      return { ok: false, error: err instanceof Error ? err.message : '不明なエラー' }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return
    setSaving(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

      // --- 1. パーソナリティ保存 ---
      const personalityData: Record<string, unknown> = {
        company_id: companyId,
        tone_of_voice: personality.tone_of_voice || null,
        communication_style: null,
      }

      let pResult: { ok: boolean; error?: string; data?: Record<string, unknown> }
      if (personalityId) {
        pResult = await supabasePatch('brand_personalities', personalityId, personalityData, token)
      } else {
        pResult = await supabaseInsert('brand_personalities', personalityData, token)
        if (pResult.ok && pResult.data) {
          setPersonalityId(pResult.data.id as string)
        }
      }

      if (!pResult.ok) {
        throw new Error('パーソナリティ保存エラー: ' + pResult.error)
      }

      // --- 2. 用語ルール保存（全削除→全INSERT） ---
      const headers = {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${token}`,
        'Prefer': 'return=minimal',
      }

      const delRes = await fetch(`${supabaseUrl}/rest/v1/brand_terms?company_id=eq.${companyId}`, {
        method: 'DELETE',
        headers,
      })
      if (!delRes.ok) {
        const body = await delRes.text()
        throw new Error(`用語削除エラー: HTTP ${delRes.status}: ${body}`)
      }

      const cleanedTerms = terms.filter(t => t.preferred_term.trim() !== '')
      if (cleanedTerms.length > 0) {
        const insertData = cleanedTerms.map((t, i) => ({
          company_id: companyId,
          preferred_term: t.preferred_term,
          avoided_term: t.avoided_term || null,
          context: t.context || null,
          category: t.category.trim() || null,
          sort_order: i,
        }))

        const insRes = await fetch(`${supabaseUrl}/rest/v1/brand_terms`, {
          method: 'POST',
          headers,
          body: JSON.stringify(insertData),
        })
        if (!insRes.ok) {
          const body = await insRes.text()
          throw new Error(`用語挿入エラー: HTTP ${insRes.status}: ${body}`)
        }
      }
      setTerms(cleanedTerms)

      // ポータルサブタイトル保存
      const updatedSubtitles = { ...(portalSubtitlesData || {}) }
      if (portalSubtitle.trim()) {
        updatedSubtitles.verbal = portalSubtitle.trim()
      } else {
        delete updatedSubtitles.verbal
      }
      await supabasePatch('companies', companyId, {
        portal_subtitles: Object.keys(updatedSubtitles).length > 0 ? updatedSubtitles : null,
      }, token)
      setPortalSubtitlesData(updatedSubtitles)

      toast.success('保存しました')
    } catch (err) {
      console.error('[VerbalIdentity Save] エラー:', err)
      toast.error('保存に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-56 mb-2" />
        <Skeleton className="h-9 w-full mb-6" />
        <div className="space-y-8">
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5 space-y-3">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-24 w-full rounded-md" />
            </CardContent>
          </Card>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5 space-y-3">
              <Skeleton className="h-4 w-24" />
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-10 w-1/4 rounded-md" />
                  <Skeleton className="h-10 w-1/4 rounded-md" />
                  <Skeleton className="h-10 w-1/4 rounded-md" />
                  <Skeleton className="h-10 w-1/4 rounded-md" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="text-center p-10">
        <p className="text-red-600 text-sm mb-3">{fetchError}</p>
        <Button variant="outline" onClick={fetchData} className="py-2 px-4 text-[13px]">再読み込み</Button>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">
        バーバルアイデンティティ
      </h1>
      <div className="mb-6">
        <Input
          type="text"
          value={portalSubtitle}
          onChange={(e) => setPortalSubtitle(e.target.value)}
          placeholder={DEFAULT_SUBTITLES.verbal}
          className="h-9 text-sm"
        />
        <p className="text-[11px] text-muted-foreground mt-1">ポータルに表示されるサブタイトル（空欄でデフォルト表示）</p>
      </div>

      <form id="verbal-form" onSubmit={handleSubmit} className="space-y-8">
        {/* カード1: トーンオブボイス */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <h2 className="text-sm font-bold mb-3">トーンオブボイス</h2>
            <AutoResizeTextarea
              value={personality.tone_of_voice}
              onChange={(e) => handleChange('tone_of_voice', e.target.value)}
              placeholder="フォーマルだが親しみやすい、専門用語は最小限に..."
              className="min-h-[100px]"
            />
          </CardContent>
        </Card>

        {/* カード2: 用語ルール */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <h2 className="text-sm font-bold mb-2">用語ルール</h2>
            <p className="text-xs text-muted-foreground mb-4">
              ブランドで使用する推奨用語と避けるべき用語を設定します
            </p>

            {/* ヘッダー行 */}
            {terms.length > 0 && (
              <div className="flex gap-2 mb-2">
                <span className="w-[140px] shrink-0 text-xs font-bold text-muted-foreground">カテゴリ</span>
                <span className="flex-1 text-xs font-bold text-muted-foreground">推奨用語</span>
                <span className="flex-1 text-xs font-bold text-muted-foreground">非推奨用語</span>
                <span className="flex-1 text-xs font-bold text-muted-foreground">使い分け説明</span>
                <span className="w-14" />
              </div>
            )}

            {terms.map((term, index) => (
              <div key={index} className="flex gap-2 mb-2 items-start">
                <Input
                  type="text"
                  list="term-categories"
                  value={term.category}
                  onChange={(e) => updateTerm(index, 'category', e.target.value)}
                  placeholder="カテゴリ"
                  className="h-10 w-[140px] shrink-0"
                />
                <Input
                  type="text"
                  value={term.preferred_term}
                  onChange={(e) => updateTerm(index, 'preferred_term', e.target.value)}
                  placeholder="推奨用語"
                  className="h-10 flex-1"
                />
                <Input
                  type="text"
                  value={term.avoided_term}
                  onChange={(e) => updateTerm(index, 'avoided_term', e.target.value)}
                  placeholder="非推奨用語"
                  className="h-10 flex-1"
                />
                <Input
                  type="text"
                  value={term.context}
                  onChange={(e) => updateTerm(index, 'context', e.target.value)}
                  placeholder="使い分け説明"
                  className="h-10 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeTerm(index)}
                  className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}

            <datalist id="term-categories">
              {existingCategories.map(cat => (
                <option key={cat} value={cat} />
              ))}
            </datalist>

            <Button
              type="button"
              variant="outline"
              onClick={addTerm}
              className="py-2 px-4 text-[13px]"
            >
              <Plus size={16} />用語ルールを追加
            </Button>
          </CardContent>
        </Card>

      </form>

      {/* 固定保存バー */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex justify-start">
        <Button
          type="submit"
          form="verbal-form"
          disabled={saving}
          className={`${saving ? 'opacity-60' : ''}`}
        >
          {saving ? '保存中...' : '保存する'}
        </Button>
      </div>
    </div>
  )
}
