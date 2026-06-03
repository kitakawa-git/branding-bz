'use client'

// ブランドパーソナリティ 編集ページ（トーンオブボイス）
// 旧 /admin/brand/verbal から分離。保存先は brand_personalities（スキーマ変更なし）。
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/supabase-fetch'
import { useAuth } from '../../components/AdminDataProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { Button } from '@/components/ui/button'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { Check } from 'lucide-react'
import { Fab, FabButton } from '@/components/ui/fab'

type Personality = {
  tone_of_voice: string
}

type PersonalityCache = {
  personalityId: string | null
  personality: Personality
}

export default function BrandPersonalityPage() {
  const { companyId } = useAuth()
  const cacheKey = `admin-brand-personality-${companyId}`
  const cached = companyId ? getPageCache<PersonalityCache>(cacheKey) : null
  const [personalityId, setPersonalityId] = useState<string | null>(cached?.personalityId ?? null)
  const [personality, setPersonality] = useState<Personality>(cached?.personality ?? {
    tone_of_voice: '',
  })
  const [loading, setLoading] = useState(!cached)
  const [fetchError, setFetchError] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchData = async () => {
    if (!companyId) return
    setLoading(true)
    setFetchError('')

    try {
      // 新規企業は行が未作成のため maybeSingle（0件でもエラーにせず空フォーム表示）
      const personalityRes = await fetchWithRetry(() =>
        supabase.from('brand_personalities').select('*').eq('company_id', companyId).maybeSingle()
      )
      if (personalityRes.error) throw new Error(personalityRes.error)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const personalityData = personalityRes.data as Record<string, any> | null

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

      setPageCache(cacheKey, {
        personalityId: parsedPersonalityId,
        personality: parsedPersonality,
      })
    } catch (err) {
      console.error('[BrandPersonality] データ取得エラー:', err)
      const msg = err instanceof Error ? err.message : 'データの取得に失敗しました'
      setFetchError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<PersonalityCache>(cacheKey)) return
    fetchData()
  }, [companyId, cacheKey])

  const handleChange = (field: keyof Personality, value: string) => {
    setPersonality(prev => ({ ...prev, [field]: value }))
  }

  // Supabase REST API直接fetch（verbal から移植）
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

      // パーソナリティ保存（brand_personalities）
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

      toast.success('保存しました')
    } catch (err) {
      console.error('[BrandPersonality Save] エラー:', err)
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
      {/* タイトルはヘッダーのパンくずに移管 */}
      <form id="personality-form" onSubmit={handleSubmit} className="space-y-8">
        {/* トーンオブボイス（人格・トーン＆マナー） */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <h2 className="text-xs font-bold mb-3">トーンオブボイス</h2>
            <AutoResizeTextarea
              value={personality.tone_of_voice}
              onChange={(e) => handleChange('tone_of_voice', e.target.value)}
              placeholder="フォーマルだが親しみやすい、専門用語は最小限に..."
              className="min-h-[100px]"
            />
          </CardContent>
        </Card>
      </form>

      {/* FabBar との重なりを防ぐスペーサー */}
      <div className="h-24" />

      {/* 保存 FAB（右下固定） */}
      <Fab>
        <FabButton type="submit" form="personality-form" disabled={saving} icon={<Check size={16} />}>
          {saving ? '保存中...' : '保存'}
        </FabButton>
      </Fab>
    </div>
  )
}
