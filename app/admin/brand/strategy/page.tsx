'use client'

// ブランド戦略 編集ページ（ターゲット・ペルソナ・ポジショニングマップ・行動指針）
import { useEffect, useState } from 'react'
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
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { PositioningMap } from '@/components/PositioningMap'
import { Plus, Trash2 } from 'lucide-react'
import { TitleDescriptionList } from '@/components/shared/TitleDescriptionList'
import type { PositioningMapData, PositioningMapItem, PositioningMapSize } from '@/lib/types/positioning-map'

type PersonaItem = {
  name: string
  age_range: string
  occupation: string
  description: string
  needs: string[]
  pain_points: string[]
}

type ActionGuideline = {
  title: string
  description: string
}

type TargetSegment = {
  name: string
  description: string
}

const emptyPersona = (): PersonaItem => ({
  name: '',
  age_range: '',
  occupation: '',
  description: '',
  needs: [],
  pain_points: [],
})

const emptyGuideline = (): ActionGuideline => ({
  title: '',
  description: '',
})

const emptyMapData = (): PositioningMapData => ({
  x_axis: { left: '', right: '' },
  y_axis: { bottom: '', top: '' },
  items: [],
})

const emptyMapItem = (): PositioningMapItem => ({
  name: '',
  color: '#3B82F6',
  x: 50,
  y: 50,
  size: 'md',
})

const DEFAULT_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
]

type StrategyCache = {
  targetSegments: TargetSegment[]
  personas: PersonaItem[]
  positioningMapData: PositioningMapData | null
  actionGuidelines: ActionGuideline[]
  portalSubtitle: string
  portalSubtitlesData: PortalSubtitles | null
}

export default function BrandStrategyPage() {
  const { companyId } = useAuth()
  const cacheKey = `admin-brand-strategy-${companyId}`
  const cached = companyId ? getPageCache<StrategyCache>(cacheKey) : null
  const [targetSegments, setTargetSegments] = useState<TargetSegment[]>(cached?.targetSegments ?? [])
  const [personas, setPersonas] = useState<PersonaItem[]>(cached?.personas ?? [])
  const [positioningMapData, setPositioningMapData] = useState<PositioningMapData | null>(cached?.positioningMapData ?? null)
  const [actionGuidelines, setActionGuidelines] = useState<ActionGuideline[]>(cached?.actionGuidelines ?? [])
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
      const { data, error: fetchErr } = await fetchWithRetry(() =>
        supabase.from('brand_personas').select('*').eq('company_id', companyId).order('sort_order')
      )
      if (fetchErr) throw new Error(fetchErr)

      // ポータルサブタイトル・ターゲットセグメント取得
      let fetchedSubtitlesData: PortalSubtitles | null = null
      let fetchedSubtitle = ''
      let companyData: Record<string, unknown> | null = null
      try {
        const { data: cd } = await supabase
          .from('companies')
          .select('portal_subtitles, target_segments')
          .eq('id', companyId)
          .single()
        companyData = cd as Record<string, unknown> | null
        if (companyData) {
          const subtitles = (companyData.portal_subtitles as PortalSubtitles) || null
          fetchedSubtitlesData = subtitles
          fetchedSubtitle = subtitles?.strategy || ''
          setPortalSubtitlesData(subtitles)
          setPortalSubtitle(fetchedSubtitle)
        }
      } catch {
        // 取得失敗は無視
      }

      // target_segments 構造化データ: companies.target_segments 優先
      const rawTs = (companyData?.target_segments as TargetSegment[]) || []
      const companyTargetSegments = rawTs
        .filter(ts => ts && ts.name)
        .map(ts => ({ name: ts.name || '', description: ts.description || '' }))

      if (data && data.length > 0) {
        const first = data[0] as Record<string, unknown>
        const parsedTargetText = (first.target as string) || ''
        const parsedMapData = (first.positioning_map_data as PositioningMapData) || null
        const parsedActionGuidelines = (first.action_guidelines as ActionGuideline[]) || []
        const parsedPersonas = data.map((d: Record<string, unknown>) => ({
          name: (d.name as string) || '',
          age_range: (d.age_range as string) || '',
          occupation: (d.occupation as string) || '',
          description: (d.description as string) || '',
          needs: (d.needs as string[]) || [],
          pain_points: (d.pain_points as string[]) || [],
        }))

        // ターゲットセグメント: companies.target_segments → brand_personas.target テキストのフォールバック
        let parsedTargetSegments: TargetSegment[]
        if (companyTargetSegments.length > 0) {
          parsedTargetSegments = companyTargetSegments
        } else if (parsedTargetText) {
          parsedTargetSegments = [{ name: 'ターゲット', description: parsedTargetText }]
        } else {
          parsedTargetSegments = []
        }

        setTargetSegments(parsedTargetSegments)
        setPositioningMapData(parsedMapData)
        setActionGuidelines(parsedActionGuidelines)
        setPersonas(parsedPersonas)
        setPageCache<StrategyCache>(cacheKey, {
          targetSegments: parsedTargetSegments,
          personas: parsedPersonas,
          positioningMapData: parsedMapData,
          actionGuidelines: parsedActionGuidelines,
          portalSubtitle: fetchedSubtitle,
          portalSubtitlesData: fetchedSubtitlesData,
        })
      } else if (companyTargetSegments.length > 0) {
        // brand_personas レコードなしでも companies のデータがあれば表示
        setTargetSegments(companyTargetSegments)
      }
    } catch (err) {
      console.error('[BrandStrategy] データ取得エラー:', err)
      const msg = err instanceof Error ? err.message : 'データの取得に失敗しました'
      setFetchError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<StrategyCache>(cacheKey)) return
    fetchData()
  }, [companyId, cacheKey])

  // ペルソナ操作
  const addPersona = () => {
    if (personas.length >= 5) return
    setPersonas([...personas, emptyPersona()])
  }

  const updatePersona = (index: number, field: keyof PersonaItem, value: string | string[]) => {
    const updated = [...personas]
    updated[index] = { ...updated[index], [field]: value }
    setPersonas(updated)
  }

  const removePersona = (index: number) => {
    setPersonas(personas.filter((_, i) => i !== index))
  }

  // ニーズの操作
  const addNeed = (personaIndex: number) => {
    const updated = [...personas]
    updated[personaIndex] = {
      ...updated[personaIndex],
      needs: [...updated[personaIndex].needs, ''],
    }
    setPersonas(updated)
  }

  const updateNeed = (personaIndex: number, needIndex: number, value: string) => {
    const updated = [...personas]
    const needs = [...updated[personaIndex].needs]
    needs[needIndex] = value
    updated[personaIndex] = { ...updated[personaIndex], needs }
    setPersonas(updated)
  }

  const removeNeed = (personaIndex: number, needIndex: number) => {
    const updated = [...personas]
    updated[personaIndex] = {
      ...updated[personaIndex],
      needs: updated[personaIndex].needs.filter((_, i) => i !== needIndex),
    }
    setPersonas(updated)
  }

  // 課題の操作
  const addPainPoint = (personaIndex: number) => {
    const updated = [...personas]
    updated[personaIndex] = {
      ...updated[personaIndex],
      pain_points: [...updated[personaIndex].pain_points, ''],
    }
    setPersonas(updated)
  }

  const updatePainPoint = (personaIndex: number, pointIndex: number, value: string) => {
    const updated = [...personas]
    const pain_points = [...updated[personaIndex].pain_points]
    pain_points[pointIndex] = value
    updated[personaIndex] = { ...updated[personaIndex], pain_points }
    setPersonas(updated)
  }

  const removePainPoint = (personaIndex: number, pointIndex: number) => {
    const updated = [...personas]
    updated[personaIndex] = {
      ...updated[personaIndex],
      pain_points: updated[personaIndex].pain_points.filter((_, i) => i !== pointIndex),
    }
    setPersonas(updated)
  }

  // 行動指針の操作
  const addGuideline = () => {
    if (actionGuidelines.length >= 10) return
    setActionGuidelines([...actionGuidelines, emptyGuideline()])
  }

  const updateGuideline = (index: number, field: keyof ActionGuideline, value: string) => {
    const updated = [...actionGuidelines]
    updated[index] = { ...updated[index], [field]: value }
    setActionGuidelines(updated)
  }

  const removeGuideline = (index: number) => {
    setActionGuidelines(actionGuidelines.filter((_, i) => i !== index))
  }

  // ポジショニングマップ操作
  const initializeMap = () => {
    setPositioningMapData(emptyMapData())
  }

  const clearMap = () => {
    setPositioningMapData(null)
  }

  const updateXAxis = (side: 'left' | 'right', value: string) => {
    setPositioningMapData(prev => {
      if (!prev) return prev
      return { ...prev, x_axis: { ...prev.x_axis, [side]: value } }
    })
  }

  const updateYAxis = (side: 'top' | 'bottom', value: string) => {
    setPositioningMapData(prev => {
      if (!prev) return prev
      return { ...prev, y_axis: { ...prev.y_axis, [side]: value } }
    })
  }

  const addMapItem = () => {
    setPositioningMapData(prev => {
      if (!prev || prev.items.length >= 10) return prev
      const newItem = emptyMapItem()
      newItem.color = DEFAULT_COLORS[prev.items.length % DEFAULT_COLORS.length]
      return { ...prev, items: [...prev.items, newItem] }
    })
  }

  const updateMapItem = (index: number, field: keyof PositioningMapItem, value: string | number) => {
    setPositioningMapData(prev => {
      if (!prev) return prev
      const items = [...prev.items]
      items[index] = { ...items[index], [field]: value }
      return { ...prev, items }
    })
  }

  const removeMapItem = (index: number) => {
    setPositioningMapData(prev => {
      if (!prev) return prev
      return { ...prev, items: prev.items.filter((_, i) => i !== index) }
    })
  }

  // 保存処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return
    setSaving(true)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token || ''

    const headers = {
      'Content-Type': 'application/json',
      'apikey': anonKey,
      'Authorization': `Bearer ${token}`,
      'Prefer': 'return=minimal',
    }

    // 行動指針をクリーンアップ
    const cleanedGuidelines = actionGuidelines.filter(g =>
      g.title.trim() !== '' || g.description.trim() !== ''
    )

    // ターゲットセグメントをクリーンアップ＋テキスト生成（brand_personas.target 用）
    const validSegments = targetSegments
      .filter(ts => ts.name.trim())
      .map(ts => ({ name: ts.name.trim(), description: ts.description?.trim() || '' }))
    const targetText = validSegments
      .map(ts => {
        const desc = ts.description ? `：${ts.description}` : ''
        return `・${ts.name}${desc}`
      })
      .join('\n')

    try {
      // 1. 既存を全削除
      const delRes = await fetch(`${supabaseUrl}/rest/v1/brand_personas?company_id=eq.${companyId}`, {
        method: 'DELETE',
        headers,
      })
      if (!delRes.ok) {
        const body = await delRes.text()
        throw new Error(`削除エラー: HTTP ${delRes.status}: ${body}`)
      }

      // 2. 現在のリストを全INSERT
      const cleanedPersonas = personas.filter(p =>
        p.name.trim() !== '' || p.age_range.trim() !== '' || p.occupation.trim() !== ''
      )

      if (cleanedPersonas.length > 0) {
        const insertData = cleanedPersonas.map((p, i) => ({
          company_id: companyId,
          name: p.name,
          age_range: p.age_range || null,
          occupation: p.occupation || null,
          description: p.description || null,
          needs: p.needs.filter(n => n.trim() !== ''),
          pain_points: p.pain_points.filter(pp => pp.trim() !== ''),
          sort_order: i,
          target: i === 0 ? (targetText || null) : null,
          positioning_map_url: null,
          positioning_map_data: i === 0 ? (positioningMapData || null) : null,
          action_guidelines: i === 0 ? (cleanedGuidelines.length > 0 ? cleanedGuidelines : null) : null,
        }))

        const insRes = await fetch(`${supabaseUrl}/rest/v1/brand_personas`, {
          method: 'POST',
          headers,
          body: JSON.stringify(insertData),
        })
        if (!insRes.ok) {
          const body = await insRes.text()
          throw new Error(`挿入エラー: HTTP ${insRes.status}: ${body}`)
        }
      } else {
        // ペルソナがなくてもtarget等を保存するためダミーレコードを作成
        if (targetText || positioningMapData || cleanedGuidelines.length > 0) {
          const insertData = [{
            company_id: companyId,
            name: '',
            sort_order: 0,
            target: targetText || null,
            positioning_map_url: null,
            positioning_map_data: positioningMapData || null,
            action_guidelines: cleanedGuidelines.length > 0 ? cleanedGuidelines : null,
          }]

          const insRes = await fetch(`${supabaseUrl}/rest/v1/brand_personas`, {
            method: 'POST',
            headers,
            body: JSON.stringify(insertData),
          })
          if (!insRes.ok) {
            const body = await insRes.text()
            throw new Error(`挿入エラー: HTTP ${insRes.status}: ${body}`)
          }
        }
      }

      // ポータルサブタイトル + ターゲットセグメント保存（companies テーブル）
      const updatedSubtitles = { ...(portalSubtitlesData || {}) }
      if (portalSubtitle.trim()) {
        updatedSubtitles.strategy = portalSubtitle.trim()
      } else {
        delete updatedSubtitles.strategy
      }
      await fetch(`${supabaseUrl}/rest/v1/companies?id=eq.${companyId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          portal_subtitles: Object.keys(updatedSubtitles).length > 0 ? updatedSubtitles : null,
          target_segments: validSegments.length > 0 ? validSegments : null,
        }),
      })
      setPortalSubtitlesData(updatedSubtitles)

      setPersonas(cleanedPersonas)
      setActionGuidelines(cleanedGuidelines)
      setTargetSegments(validSegments)
      toast.success('保存しました')
    } catch (err) {
      console.error('[BrandStrategy Save] エラー:', err)
      toast.error('保存に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-36 mb-2" />
        <Skeleton className="h-9 w-full mb-6" />
        <div className="space-y-6">
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5 space-y-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-20 w-full rounded-md" />
              <Skeleton className="h-4 w-20" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map(i => (
                  <div key={i} className="border border-border rounded-lg p-4 space-y-3">
                    <Skeleton className="h-10 w-full rounded-md" />
                    <Skeleton className="h-10 w-full rounded-md" />
                    <Skeleton className="h-16 w-full rounded-md" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5 space-y-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-64 w-full rounded-lg" />
            </CardContent>
          </Card>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5 space-y-3">
              <Skeleton className="h-4 w-24" />
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-10 w-full rounded-md" />
                  <Skeleton className="h-10 w-full rounded-md" />
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
        <Button variant="outline" onClick={fetchData} className="py-2 px-4 text-[13px]">
          再読み込み
        </Button>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">
        ブランド戦略
      </h1>
      <div className="mb-6">
        <Input
          type="text"
          value={portalSubtitle}
          onChange={(e) => setPortalSubtitle(e.target.value)}
          placeholder={DEFAULT_SUBTITLES.strategy}
          className="h-9 text-sm"
        />
        <p className="text-[11px] text-muted-foreground mt-1">ポータルに表示されるサブタイトル（空欄でデフォルト表示）</p>
      </div>

      <form id="strategy-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: ターゲット＋ペルソナ */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 space-y-5">
            <TitleDescriptionList
              label="ターゲット"
              items={targetSegments.map(ts => ({ title: ts.name, description: ts.description }))}
              onChange={(newItems) => {
                setTargetSegments(newItems.map(item => ({ name: item.title, description: item.description })))
              }}
              addButtonLabel="ターゲットを追加"
              titlePlaceholder="セグメント名（例: 中小企業の経営者）"
              descriptionPlaceholder="セグメントの説明"
            />

            <div>
              <h2 className="text-sm font-bold mb-3">ペルソナ</h2>
              <p className="text-xs text-muted-foreground mb-4">
                ターゲット顧客のペルソナを設定します（最大5件）
              </p>

              {personas.map((persona, index) => (
                <div key={index} className="border border-border rounded-lg p-4 mb-3 bg-background">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[13px] font-bold text-muted-foreground">
                      ペルソナ {index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removePersona(index)}
                      className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>

                  <div className="mb-5">
                    <h2 className="text-sm font-bold mb-3">ペルソナ名称</h2>
                    <Input
                      type="text"
                      value={persona.name}
                      onChange={(e) => updatePersona(index, 'name', e.target.value)}
                      placeholder="例: 情報感度の高いマーケター"
                      className="h-10"
                    />
                  </div>

                  <div className="flex gap-3">
                    <div className="mb-5 flex-1">
                      <h2 className="text-sm font-bold mb-3">年齢層</h2>
                      <Input
                        type="text"
                        value={persona.age_range}
                        onChange={(e) => updatePersona(index, 'age_range', e.target.value)}
                        placeholder="例: 30-40代"
                        className="h-10"
                      />
                    </div>
                    <div className="mb-5 flex-1">
                      <h2 className="text-sm font-bold mb-3">職業</h2>
                      <Input
                        type="text"
                        value={persona.occupation}
                        onChange={(e) => updatePersona(index, 'occupation', e.target.value)}
                        placeholder="例: マーケティング担当者"
                        className="h-10"
                      />
                    </div>
                  </div>

                  <div className="mb-5">
                    <h2 className="text-sm font-bold mb-3">説明</h2>
                    <AutoResizeTextarea
                      value={persona.description}
                      onChange={(e) => updatePersona(index, 'description', e.target.value)}
                      placeholder="このペルソナの背景や特徴"
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="mb-5">
                    <h2 className="text-sm font-bold mb-3">ニーズ</h2>
                    {persona.needs.map((need, needIndex) => (
                      <div key={needIndex} className="flex gap-2 mb-2">
                        <Input
                          type="text"
                          value={need}
                          onChange={(e) => updateNeed(index, needIndex, e.target.value)}
                          placeholder={`ニーズ ${needIndex + 1}`}
                          className="h-10 flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeNeed(index, needIndex)}
                          className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addNeed(index)}
                      className="py-1.5 px-3 text-xs"
                    >
                      <Plus size={16} />ニーズを追加
                    </Button>
                  </div>

                  <div>
                    <h2 className="text-sm font-bold mb-3">課題・ペインポイント</h2>
                    {persona.pain_points.map((point, pointIndex) => (
                      <div key={pointIndex} className="flex gap-2 mb-2">
                        <Input
                          type="text"
                          value={point}
                          onChange={(e) => updatePainPoint(index, pointIndex, e.target.value)}
                          placeholder={`課題 ${pointIndex + 1}`}
                          className="h-10 flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removePainPoint(index, pointIndex)}
                          className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addPainPoint(index)}
                      className="py-1.5 px-3 text-xs"
                    >
                      <Plus size={16} />課題を追加
                    </Button>
                  </div>
                </div>
              ))}

              {personas.length < 5 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={addPersona}
                  className="py-2 px-4 text-[13px]"
                >
                  <Plus size={16} />ペルソナを追加
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: ポジショニングマップ */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <h2 className="text-sm font-bold mb-3">ポジショニングマップ</h2>

            {positioningMapData ? (
              <div className="space-y-5">
                {/* 軸ラベル設定 */}
                <div className="space-y-3">
                  <h3 className="text-[13px] font-bold text-muted-foreground">軸ラベル</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">X軸 左</Label>
                      <Input
                        type="text"
                        value={positioningMapData.x_axis.left}
                        onChange={(e) => updateXAxis('left', e.target.value)}
                        placeholder="例: 低価格"
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">X軸 右</Label>
                      <Input
                        type="text"
                        value={positioningMapData.x_axis.right}
                        onChange={(e) => updateXAxis('right', e.target.value)}
                        placeholder="例: 高価格"
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Y軸 下</Label>
                      <Input
                        type="text"
                        value={positioningMapData.y_axis.bottom}
                        onChange={(e) => updateYAxis('bottom', e.target.value)}
                        placeholder="例: 機能重視"
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Y軸 上</Label>
                      <Input
                        type="text"
                        value={positioningMapData.y_axis.top}
                        onChange={(e) => updateYAxis('top', e.target.value)}
                        placeholder="例: デザイン重視"
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>

                {/* アイテム一覧 */}
                <div className="space-y-3">
                  <h3 className="text-[13px] font-bold text-muted-foreground">
                    プロット項目（{positioningMapData.items.length}/10）
                  </h3>

                  {positioningMapData.items.map((item, index) => (
                    <div key={index} className="border border-border rounded-lg p-4 bg-background">
                      <div className="flex items-center gap-3 mb-3">
                        <input
                          type="color"
                          value={item.color}
                          onChange={(e) => updateMapItem(index, 'color', e.target.value)}
                          className="w-10 h-10 border border-border rounded-lg cursor-pointer p-0.5"
                        />
                        <Input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateMapItem(index, 'name', e.target.value)}
                          placeholder="名称（例: 自社、競合A）"
                          className="h-10 flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeMapItem(index)}
                          className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-2 block">
                            X位置: {item.x}
                          </Label>
                          <Slider
                            value={[item.x]}
                            onValueChange={([val]) => updateMapItem(index, 'x', val)}
                            min={0}
                            max={100}
                            step={1}
                            className="w-full"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-2 block">
                            Y位置: {item.y}
                          </Label>
                          <Slider
                            value={[item.y]}
                            onValueChange={([val]) => updateMapItem(index, 'y', val)}
                            min={0}
                            max={100}
                            step={1}
                            className="w-full"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-3">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">サイズ</Label>
                        <div className="flex gap-1.5">
                          {([
                            { value: 'sm' as PositioningMapSize, label: '小' },
                            { value: 'md' as PositioningMapSize, label: '中' },
                            { value: 'lg' as PositioningMapSize, label: '大' },
                            { value: 'custom' as PositioningMapSize, label: 'カスタム' },
                          ]).map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => updateMapItem(index, 'size', opt.value)}
                              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                                item.size === opt.value
                                  ? 'bg-foreground text-background border-foreground'
                                  : 'bg-background text-foreground border-border hover:bg-muted'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        {item.size === 'custom' && (
                          <div className="flex items-center gap-2">
                            <Slider
                              value={[item.customSize || 6]}
                              onValueChange={([val]) => updateMapItem(index, 'customSize', val)}
                              min={2}
                              max={20}
                              step={1}
                              className="w-24"
                            />
                            <span className="text-xs text-muted-foreground w-6">{item.customSize || 6}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {positioningMapData.items.length < 10 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addMapItem}
                      className="py-2 px-4 text-[13px]"
                    >
                      <Plus size={16} />項目を追加
                    </Button>
                  )}
                </div>

                {/* プレビュー */}
                <div>
                  <h3 className="text-[13px] font-bold text-muted-foreground mb-2">プレビュー</h3>
                  <PositioningMap data={positioningMapData} />
                </div>

                {/* マップ削除 */}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={clearMap}
                  className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ) : (
              <div>
                <p className="text-[13px] text-muted-foreground mb-3">
                  ポジショニングマップを作成してください
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={initializeMap}
                  className="py-2 px-4 text-[13px]"
                >
                  マップを作成
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 3: 行動指針 */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <h2 className="text-sm font-bold mb-3">行動指針</h2>

            {actionGuidelines.map((guideline, index) => (
              <div key={index} className="flex gap-2 mb-2 items-start">
                <Input
                  type="text"
                  value={guideline.title}
                  onChange={(e) => updateGuideline(index, 'title', e.target.value)}
                  placeholder="タイトル（例: 顧客第一）"
                  className="h-10 flex-[0_0_200px]"
                />
                <Input
                  type="text"
                  value={guideline.description}
                  onChange={(e) => updateGuideline(index, 'description', e.target.value)}
                  placeholder="説明（例: 常に顧客の視点で考える）"
                  className="h-10 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeGuideline(index)}
                  className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}

            {actionGuidelines.length < 10 && (
              <Button
                type="button"
                variant="outline"
                onClick={addGuideline}
                className="py-1.5 px-3 text-xs"
              >
                <Plus size={16} />行動指針を追加
              </Button>
            )}
          </CardContent>
        </Card>

      </form>

      {/* 固定保存バー */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex justify-start">
        <Button
          type="submit"
          form="strategy-form"
          disabled={saving}
          className={`${saving ? 'opacity-60' : ''}`}
        >
          {saving ? '保存中...' : '保存する'}
        </Button>
      </div>
    </div>
  )
}
