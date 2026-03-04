'use client'

// 提供価値 編集ページ（全削除→全INSERT方式）
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/supabase-fetch'
import { useAuth } from '../../components/AuthProvider'
import { colors } from '../../components/AdminStyles'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { DEFAULT_SUBTITLES, type PortalSubtitles } from '@/lib/portal-subtitles'
import { Plus, Trash2 } from 'lucide-react'

type ValueItem = {
  title: string
  description: string
}

type ValuesCache = {
  values: ValueItem[]
  portalSubtitle: string
  portalSubtitlesData: PortalSubtitles | null
}

export default function BrandValuesPage() {
  const { companyId } = useAuth()
  const cacheKey = `admin-brand-values-${companyId}`
  const cached = companyId ? getPageCache<ValuesCache>(cacheKey) : null
  const [values, setValues] = useState<ValueItem[]>(cached?.values ?? [])
  const [loading, setLoading] = useState(!cached)
  const [fetchError, setFetchError] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [portalSubtitle, setPortalSubtitle] = useState(cached?.portalSubtitle ?? '')
  const [portalSubtitlesData, setPortalSubtitlesData] = useState<PortalSubtitles | null>(cached?.portalSubtitlesData ?? null)

  const fetchValues = async () => {
    if (!companyId) return
    setLoading(true)
    setFetchError('')

    try {
      const { data, error: fetchErr } = await fetchWithRetry(() =>
        supabase.from('brand_values').select('*').eq('company_id', companyId).order('sort_order')
      )
      if (fetchErr) throw new Error(fetchErr)

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
          fetchedSubtitle = subtitles?.values || ''
          setPortalSubtitlesData(fetchedSubtitlesData)
          setPortalSubtitle(fetchedSubtitle)
        }
      } catch {
        // サブタイトル取得失敗は無視
      }

      let parsedValues: ValueItem[] = []
      if (data && data.length > 0) {
        parsedValues = data.map((d: Record<string, unknown>) => ({
          title: (d.title as string) || '',
          description: (d.description as string) || '',
        }))
        setValues(parsedValues)
      }

      setPageCache(cacheKey, {
        values: parsedValues,
        portalSubtitle: fetchedSubtitle,
        portalSubtitlesData: fetchedSubtitlesData,
      })
    } catch (err) {
      console.error('[BrandValues] データ取得エラー:', err)
      const msg = err instanceof Error ? err.message : 'データの取得に失敗しました'
      setFetchError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<ValuesCache>(cacheKey)) return
    fetchValues()
  }, [companyId, cacheKey])

  const addValue = () => {
    setValues([...values, { title: '', description: '' }])
  }

  const updateValue = (index: number, field: 'title' | 'description', value: string) => {
    const updated = [...values]
    updated[index] = { ...updated[index], [field]: value }
    setValues(updated)
  }

  const removeValue = (index: number) => {
    setValues(values.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return
    setSaving(true)
    setMessage('')
    setMessageType('error')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    // セッショントークンを取得（RLSポリシー用）
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token || ''

    const headers = {
      'Content-Type': 'application/json',
      'apikey': anonKey,
      'Authorization': `Bearer ${token}`,
      'Prefer': 'return=minimal',
    }

    try {
      // 1. 既存を全削除
      const delRes = await fetch(`${supabaseUrl}/rest/v1/brand_values?company_id=eq.${companyId}`, {
        method: 'DELETE',
        headers,
      })
      if (!delRes.ok) {
        const body = await delRes.text()
        throw new Error(`削除エラー: HTTP ${delRes.status}: ${body}`)
      }

      // 2. 現在のリストを全INSERT（空のtitleは除外）
      const cleanedValues = values.filter(v => v.title.trim() !== '')
      if (cleanedValues.length > 0) {
        const insertData = cleanedValues.map((v, i) => ({
          company_id: companyId,
          title: v.title,
          description: v.description || null,
          sort_order: i,
        }))

        const insRes = await fetch(`${supabaseUrl}/rest/v1/brand_values`, {
          method: 'POST',
          headers,
          body: JSON.stringify(insertData),
        })
        if (!insRes.ok) {
          const body = await insRes.text()
          throw new Error(`挿入エラー: HTTP ${insRes.status}: ${body}`)
        }
      }

      // ポータルサブタイトル保存
      const updatedSubtitles = { ...(portalSubtitlesData || {}) }
      if (portalSubtitle.trim()) {
        updatedSubtitles.values = portalSubtitle.trim()
      } else {
        delete updatedSubtitles.values
      }
      await fetch(`${supabaseUrl}/rest/v1/companies?id=eq.${companyId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          portal_subtitles: Object.keys(updatedSubtitles).length > 0 ? updatedSubtitles : null,
        }),
      })
      setPortalSubtitlesData(updatedSubtitles)

      setValues(cleanedValues)
      setMessage('保存しました')
      setMessageType('success')
    } catch (err) {
      console.error('[BrandValues Save] エラー:', err)
      setMessage('保存に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
      setMessageType('error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div>
        <Skeleton className="h-7 w-28 mb-2" />
        <Skeleton className="h-9 w-full mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="border border-border rounded-lg p-4 space-y-3">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <p style={{ color: '#dc2626', fontSize: 14, marginBottom: 12 }}>{fetchError}</p>
        <button
          onClick={fetchValues}
          className="inline-block px-4 py-2 bg-transparent text-gray-900 border border-gray-200 rounded-lg text-sm cursor-pointer hover:bg-gray-50 transition-colors"
        >
          再読み込み
        </button>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.textPrimary,
        margin: '0 0 8px',
      }}>
        提供価値
      </h2>
      <div style={{ marginBottom: 24 }}>
        <input
          type="text"
          value={portalSubtitle}
          onChange={(e) => setPortalSubtitle(e.target.value)}
          placeholder={DEFAULT_SUBTITLES.values}
          style={{
            width: '100%',
            padding: '6px 12px',
            border: `1px solid ${colors.inputBorder}`,
            borderRadius: 8,
            fontSize: 14,
            height: 36,
            outline: 'none',
          }}
        />
        <p style={{ fontSize: 11, color: colors.textSecondary, margin: '4px 0 0' }}>
          ポータルに表示されるサブタイトル（空欄でデフォルト表示）
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {message && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            messageType === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {values.map((value, index) => (
            <div key={index} style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              padding: 16,
              marginBottom: 12,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 'bold', color: colors.textSecondary }}>
                  提供価値 {index + 1}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeValue(index)}
                  className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={14} />
                </Button>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label className="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
                <input
                  type="text"
                  value={value.title}
                  onChange={(e) => updateValue(index, 'title', e.target.value)}
                  placeholder="提供価値のタイトル"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div style={{ marginBottom: 0 }}>
                <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                <textarea
                  value={value.description}
                  onChange={(e) => updateValue(index, 'description', e.target.value)}
                  placeholder="この提供価値の詳細説明"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none resize-y min-h-[80px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addValue}
            className="inline-block px-4 py-2 bg-transparent text-gray-900 border border-gray-200 rounded-lg text-sm cursor-pointer hover:bg-gray-50 transition-colors mb-5"
          >
            <Plus size={16} className="inline" />提供価値を追加
          </button>

          <div>
            <button
              type="submit"
              disabled={saving}
              className="inline-block px-5 py-2.5 bg-blue-600 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-700 transition-colors mt-2"
              style={{ opacity: saving ? 0.6 : 1 }}
            >
              {saving ? '保存中...' : '保存する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
