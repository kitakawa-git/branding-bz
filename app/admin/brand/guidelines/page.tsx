'use client'

// ブランド方針 編集ページ
// スローガン・コンセプトビジュアル・動画・メッセージ・MVV・ストーリー・沿革・事業内容・特性
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/supabase-fetch'
import { useAuth } from '../../components/AuthProvider'
import { ImageUpload } from '../../components/ImageUpload'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { DEFAULT_SUBTITLES, type PortalSubtitles } from '@/lib/portal-subtitles'
import { TitleDescriptionList } from '@/components/shared/TitleDescriptionList'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type ValueItem = { name: string; description: string; added_index: number }
type HistoryItem = { year: string; event: string }
type BusinessItem = { title: string; description: string; added_index: number }
type TraitItem = { name: string; score: number; description: string; added_index: number }

type Guidelines = {
  slogan: string
  concept_visual_url: string
  brand_video_url: string
  brand_statement: string
  mission: string
  vision: string
  values: ValueItem[]
  values_sort: 'registered' | 'custom'
  brand_story: string
  history: HistoryItem[]
  business_content: BusinessItem[]
  business_content_sort: 'registered' | 'custom'
  traits: TraitItem[]
  traits_sort: 'registered' | 'custom'
}

type GuidelinesCache = {
  guidelinesId: string | null
  guidelines: Guidelines
  portalSubtitle: string
  portalSubtitlesData: PortalSubtitles | null
}

function SortableValueItem({
  id, value, index, onUpdate, onRemove,
}: {
  id: string; value: ValueItem; index: number
  onUpdate: (index: number, field: 'name' | 'description', value: string) => void
  onRemove: (index: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="flex gap-2 mb-2 items-start">
      <button type="button" className="mt-2.5 p-1 rounded hover:bg-gray-200 cursor-grab active:cursor-grabbing text-muted-foreground shrink-0" {...attributes} {...listeners}>
        <GripVertical size={16} />
      </button>
      <Input type="text" value={value.name} onChange={(e) => onUpdate(index, 'name', e.target.value)} placeholder={`バリュー名 ${index + 1}`} className="h-10 flex-1" />
      <Input type="text" value={value.description} onChange={(e) => onUpdate(index, 'description', e.target.value)} placeholder="説明" className="h-10 flex-[2]" />
      <Button type="button" variant="outline" size="icon" onClick={() => onRemove(index)} className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} /></Button>
    </div>
  )
}

function SortableTraitItem({
  id, trait, index, onUpdate, onRemove,
}: {
  id: string; trait: TraitItem; index: number
  onUpdate: (index: number, field: keyof TraitItem, value: string | number) => void
  onRemove: (index: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="flex gap-2 mb-2 items-center">
      <button type="button" className="p-1 rounded hover:bg-gray-200 cursor-grab active:cursor-grabbing text-muted-foreground shrink-0" {...attributes} {...listeners}>
        <GripVertical size={16} />
      </button>
      <Input type="text" value={trait.name} onChange={(e) => onUpdate(index, 'name', e.target.value)} placeholder="特性名" className="h-10 flex-1" />
      <Input type="number" min={1} max={10} value={trait.score} onChange={(e) => onUpdate(index, 'score', parseInt(e.target.value) || 5)} className="h-10 w-[70px] text-center" />
      <Input type="text" value={trait.description} onChange={(e) => onUpdate(index, 'description', e.target.value)} placeholder="この特性の説明" className="h-10 flex-[2]" />
      <Button type="button" variant="outline" size="icon" onClick={() => onRemove(index)} className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} /></Button>
    </div>
  )
}

function SortableBusinessItem({
  id, item, index, onUpdate, onRemove,
}: {
  id: string; item: BusinessItem; index: number
  onUpdate: (index: number, field: 'title' | 'description', value: string) => void
  onRemove: (index: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="border border-border rounded-lg p-3 mb-2 bg-background">
      <div className="flex gap-2 mb-2 items-center">
        <button type="button" className="p-1 rounded hover:bg-gray-200 cursor-grab active:cursor-grabbing text-muted-foreground shrink-0" {...attributes} {...listeners}>
          <GripVertical size={16} />
        </button>
        <Input type="text" value={item.title} onChange={(e) => onUpdate(index, 'title', e.target.value)} placeholder="事業タイトル" className="h-10 flex-1" />
        <Button type="button" variant="outline" size="icon" onClick={() => onRemove(index)} className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} /></Button>
      </div>
      <AutoResizeTextarea
        value={item.description}
        onChange={(e) => onUpdate(index, 'description', e.target.value)}
        placeholder="事業の説明"
        className="min-h-[60px]"
      />
    </div>
  )
}

export default function BrandGuidelinesPage() {
  const { companyId } = useAuth()
  const cacheKey = `admin-brand-guidelines-${companyId}`
  const cached = companyId ? getPageCache<GuidelinesCache>(cacheKey) : null
  const [guidelinesId, setGuidelinesId] = useState<string | null>(cached?.guidelinesId ?? null)
  const [guidelines, setGuidelines] = useState<Guidelines>(cached?.guidelines ?? {
    slogan: '',
    concept_visual_url: '',
    brand_video_url: '',
    brand_statement: '',
    mission: '',
    vision: '',
    values: [],
    values_sort: 'registered',
    brand_story: '',
    history: [],
    business_content: [],
    business_content_sort: 'registered',
    traits: [],
    traits_sort: 'registered',
  })
  const [loading, setLoading] = useState(!cached)
  const [fetchError, setFetchError] = useState('')
  const [saving, setSaving] = useState(false)
  const [portalSubtitle, setPortalSubtitle] = useState(cached?.portalSubtitle ?? '')
  const [portalSubtitlesData, setPortalSubtitlesData] = useState<PortalSubtitles | null>(cached?.portalSubtitlesData ?? null)

  const fetchGuidelines = async () => {
    if (!companyId) return
    setLoading(true)
    setFetchError('')

    try {
      const { data, error: fetchErr } = await fetchWithRetry(() =>
        supabase.from('brand_guidelines').select('*').eq('company_id', companyId).single()
      )
      if (fetchErr) throw new Error(fetchErr)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = data as Record<string, any> | null

      // ポータルサブタイトル取得
      let fetchedSubtitlesData: PortalSubtitles | null = null
      let fetchedSubtitle = ''
      try {
        const { data: companyData } = await supabase
          .from('companies')
          .select('portal_subtitles')
          .eq('id', companyId)
          .single()
        if (companyData) {
          const subtitles = (companyData.portal_subtitles as PortalSubtitles) || null
          fetchedSubtitlesData = subtitles
          fetchedSubtitle = subtitles?.guidelines || ''
          setPortalSubtitlesData(subtitles)
          setPortalSubtitle(fetchedSubtitle)
        }
      } catch {
        // サブタイトル取得失敗は無視
      }

      if (result) {
        const parsedId = result.id as string
        const parsedGuidelines: Guidelines = {
          slogan: result.slogan || '',
          concept_visual_url: result.concept_visual_url || '',
          brand_video_url: result.brand_video_url || '',
          brand_statement: result.brand_statement || '',
          mission: result.mission || '',
          vision: result.vision || '',
          values: ((result.values as { name: string; description: string; added_index?: number }[]) || []).map((v, i) => ({
            ...v,
            added_index: v.added_index ?? i,
          })),
          values_sort: (result.values_sort as 'registered' | 'custom') || 'registered',
          brand_story: result.brand_story || '',
          history: result.history || [],
          business_content: ((result.business_content as { title: string; description: string; added_index?: number }[]) || []).map((b, i) => ({
            ...b,
            added_index: b.added_index ?? i,
          })),
          business_content_sort: (result.business_content_sort as 'registered' | 'custom') || 'registered',
          traits: ((result.traits as { name: string; score: number; description: string; added_index?: number }[]) || []).map((t, i) => ({
            ...t,
            added_index: t.added_index ?? i,
          })),
          traits_sort: (result.traits_sort as 'registered' | 'custom') || 'registered',
        }
        setGuidelinesId(parsedId)
        setGuidelines(parsedGuidelines)
        setPageCache<GuidelinesCache>(cacheKey, {
          guidelinesId: parsedId,
          guidelines: parsedGuidelines,
          portalSubtitle: fetchedSubtitle,
          portalSubtitlesData: fetchedSubtitlesData,
        })
      }
    } catch (err) {
      console.error('[BrandGuidelines] データ取得エラー:', err)
      const msg = err instanceof Error ? err.message : 'データの取得に失敗しました'
      setFetchError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<GuidelinesCache>(cacheKey)) return
    fetchGuidelines()
  }, [companyId, cacheKey])

  // --- ジェネリック更新 ---
  const handleChange = (field: keyof Guidelines, value: unknown) => {
    setGuidelines(prev => ({ ...prev, [field]: value }))
  }

  // --- バリュー ---
  const addValue = () => {
    if (guidelines.values.length >= 10) return
    const maxIndex = guidelines.values.reduce((max, v) => Math.max(max, v.added_index), -1)
    handleChange('values', [...guidelines.values, { name: '', description: '', added_index: maxIndex + 1 }])
  }
  const updateValue = (index: number, field: 'name' | 'description', value: string) => {
    const updated = [...guidelines.values]
    updated[index] = { ...updated[index], [field]: value }
    handleChange('values', updated)
  }
  const removeValue = (index: number) => {
    handleChange('values', guidelines.values.filter((_, i) => i !== index))
  }

  // --- 沿革 ---
  const addHistory = () => {
    handleChange('history', [...guidelines.history, { year: '', event: '' }])
  }
  const updateHistory = (index: number, field: 'year' | 'event', value: string) => {
    const updated = [...guidelines.history]
    updated[index] = { ...updated[index], [field]: value }
    handleChange('history', updated)
  }
  const removeHistory = (index: number) => {
    handleChange('history', guidelines.history.filter((_, i) => i !== index))
  }

  // --- 事業内容 ---
  const addBusiness = () => {
    const maxIndex = guidelines.business_content.reduce((max, b) => Math.max(max, b.added_index), -1)
    handleChange('business_content', [...guidelines.business_content, { title: '', description: '', added_index: maxIndex + 1 }])
  }
  const updateBusiness = (index: number, field: 'title' | 'description', value: string) => {
    const updated = [...guidelines.business_content]
    updated[index] = { ...updated[index], [field]: value }
    handleChange('business_content', updated)
  }
  const removeBusiness = (index: number) => {
    handleChange('business_content', guidelines.business_content.filter((_, i) => i !== index))
  }

  // --- ブランド特性 ---
  const addTrait = () => {
    if (guidelines.traits.length >= 5) return
    const maxIndex = guidelines.traits.reduce((max, t) => Math.max(max, t.added_index), -1)
    handleChange('traits', [...guidelines.traits, { name: '', score: 5, description: '', added_index: maxIndex + 1 }])
  }
  const updateTrait = (index: number, field: keyof TraitItem, value: string | number) => {
    const updated = [...guidelines.traits]
    updated[index] = { ...updated[index], [field]: value }
    handleChange('traits', updated)
  }
  const removeTrait = (index: number) => {
    handleChange('traits', guidelines.traits.filter((_, i) => i !== index))
  }

  // --- ドラッグ&ドロップ ---
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleValuesDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = guidelines.values.findIndex((_, i) => `value-${i}` === active.id)
    const newIndex = guidelines.values.findIndex((_, i) => `value-${i}` === over.id)
    if (oldIndex !== -1 && newIndex !== -1) {
      handleChange('values', arrayMove(guidelines.values, oldIndex, newIndex))
    }
  }

  const handleBusinessDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = guidelines.business_content.findIndex((_, i) => `business-${i}` === active.id)
    const newIndex = guidelines.business_content.findIndex((_, i) => `business-${i}` === over.id)
    if (oldIndex !== -1 && newIndex !== -1) {
      handleChange('business_content', arrayMove(guidelines.business_content, oldIndex, newIndex))
    }
  }

  const handleTraitsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = guidelines.traits.findIndex((_, i) => `trait-${i}` === active.id)
    const newIndex = guidelines.traits.findIndex((_, i) => `trait-${i}` === over.id)
    if (oldIndex !== -1 && newIndex !== -1) {
      handleChange('traits', arrayMove(guidelines.traits, oldIndex, newIndex))
    }
  }

  // URL正規化
  const normalizeUrl = (url: string): string => {
    const trimmed = url.trim()
    if (!trimmed) return ''
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
    return 'https://' + trimmed
  }

  // Supabase REST API直接fetch (PATCH)
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

  // Supabase REST API直接fetch (INSERT)
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

      const cleanedValues = guidelines.values.filter(v => v.name.trim() !== '')
      const cleanedHistory = guidelines.history.filter(h => h.year.trim() !== '' || h.event.trim() !== '')
      const cleanedBusiness = guidelines.business_content.filter(b => b.title.trim() !== '')
      const cleanedTraits = guidelines.traits.filter(t => t.name.trim() !== '')

      const saveData: Record<string, unknown> = {
        company_id: companyId,
        slogan: guidelines.slogan || null,
        concept_visual_url: guidelines.concept_visual_url || null,
        brand_video_url: guidelines.brand_video_url ? normalizeUrl(guidelines.brand_video_url) : null,
        brand_statement: guidelines.brand_statement || null,
        mission: guidelines.mission || null,
        vision: guidelines.vision || null,
        values: cleanedValues.length > 0 ? cleanedValues : [],
        values_sort: guidelines.values_sort,
        brand_story: guidelines.brand_story || null,
        history: cleanedHistory.length > 0 ? cleanedHistory : [],
        business_content: cleanedBusiness.length > 0 ? cleanedBusiness : [],
        business_content_sort: guidelines.business_content_sort,
        traits: cleanedTraits.length > 0 ? cleanedTraits : [],
        traits_sort: guidelines.traits_sort,
      }

      let result: { ok: boolean; error?: string; data?: Record<string, unknown> }

      if (guidelinesId) {
        result = await supabasePatch('brand_guidelines', guidelinesId, saveData, token)
      } else {
        result = await supabaseInsert('brand_guidelines', saveData, token)
        if (result.ok && result.data) {
          setGuidelinesId(result.data.id as string)
        }
      }

      // ポータルサブタイトル保存
      const updatedSubtitles = { ...(portalSubtitlesData || {}) }
      if (portalSubtitle.trim()) {
        updatedSubtitles.guidelines = portalSubtitle.trim()
      } else {
        delete updatedSubtitles.guidelines
      }
      await supabasePatch('companies', companyId, {
        portal_subtitles: Object.keys(updatedSubtitles).length > 0 ? updatedSubtitles : null,
      }, token)
      setPortalSubtitlesData(updatedSubtitles)

      if (result.ok) {
        toast.success('保存しました')
        handleChange('values', cleanedValues)
        handleChange('history', cleanedHistory)
        handleChange('business_content', cleanedBusiness)
        handleChange('traits', cleanedTraits)
        if (guidelines.brand_video_url) {
          handleChange('brand_video_url', normalizeUrl(guidelines.brand_video_url))
        }
      } else {
        toast.error('保存に失敗しました: ' + result.error)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '不明なエラーが発生しました'
      toast.error('保存に失敗しました: ' + errorMessage)
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
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-20 w-full rounded-md" />
            </CardContent>
          </Card>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5 space-y-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-4 w-20" />
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
        <Button variant="outline" onClick={fetchGuidelines} className="py-2 px-4 text-[13px]">再読み込み</Button>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">
        ブランド方針
      </h1>
      <div className="mb-6">
        <Input
          type="text"
          value={portalSubtitle}
          onChange={(e) => setPortalSubtitle(e.target.value)}
          placeholder={DEFAULT_SUBTITLES.guidelines}
          className="h-9 text-sm"
        />
        <p className="text-[11px] text-muted-foreground mt-1">ポータルに表示されるサブタイトル（空欄でデフォルト表示）</p>
      </div>

      <form id="guidelines-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: スローガン＋コンセプトビジュアル＋ブランド動画＋メッセージ */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 space-y-5">
            <div>
              <h2 className="text-sm font-bold mb-3">スローガン</h2>
              <Input
                type="text"
                value={guidelines.slogan}
                onChange={(e) => handleChange('slogan', e.target.value)}
                placeholder="企業スローガン"
                className="h-10"
              />
            </div>

            <div>
              <h2 className="text-sm font-bold mb-3">コンセプトビジュアル</h2>
              <ImageUpload
                bucket="avatars"
                folder="concept-visuals"
                currentUrl={guidelines.concept_visual_url}
                onUpload={(url) => handleChange('concept_visual_url', url)}
              />
            </div>

            <div>
              <h2 className="text-sm font-bold mb-3">ブランド動画URL</h2>
              <Input
                type="text"
                value={guidelines.brand_video_url}
                onChange={(e) => handleChange('brand_video_url', e.target.value)}
                placeholder="https://youtube.com/..."
                className="h-10"
              />
            </div>

            <div>
              <h2 className="text-sm font-bold mb-3">メッセージ</h2>
              <AutoResizeTextarea
                value={guidelines.brand_statement}
                onChange={(e) => handleChange('brand_statement', e.target.value)}
                placeholder="ブランドとしてのメッセージ"
                className="min-h-[100px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: ミッション＋ビジョン＋バリュー */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 space-y-5">
            <div>
              <h2 className="text-sm font-bold mb-3">ミッション</h2>
              <AutoResizeTextarea
                value={guidelines.mission}
                onChange={(e) => handleChange('mission', e.target.value)}
                placeholder="私たちの使命は..."
                className="min-h-[100px]"
              />
            </div>

            <div>
              <h2 className="text-sm font-bold mb-3">ビジョン</h2>
              <AutoResizeTextarea
                value={guidelines.vision}
                onChange={(e) => handleChange('vision', e.target.value)}
                placeholder="私たちが目指す未来は..."
                className="min-h-[100px]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold">バリュー（最大10個）</h2>
                {guidelines.values.length > 1 && (
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    <button type="button" onClick={() => handleChange('values_sort', 'registered')}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${guidelines.values_sort === 'registered' ? 'bg-foreground text-background' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
                      登録順
                    </button>
                    <button type="button" onClick={() => handleChange('values_sort', 'custom')}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${guidelines.values_sort === 'custom' ? 'bg-foreground text-background' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
                      カスタム
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                企業が大切にする価値観を設定します
              </p>
              {guidelines.values_sort === 'custom' ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleValuesDragEnd}>
                  <SortableContext items={guidelines.values.map((_, i) => `value-${i}`)} strategy={verticalListSortingStrategy}>
                    {guidelines.values.map((value, index) => (
                      <SortableValueItem key={`value-${index}`} id={`value-${index}`} value={value} index={index} onUpdate={updateValue} onRemove={removeValue} />
                    ))}
                  </SortableContext>
                </DndContext>
              ) : (
                <>
                  {[...guidelines.values]
                    .sort((a, b) => (a.added_index ?? 0) - (b.added_index ?? 0))
                    .map((value) => {
                      const realIndex = guidelines.values.indexOf(value)
                      return (
                        <div key={realIndex} className="flex gap-2 mb-2 items-start">
                          <Input type="text" value={value.name} onChange={(e) => updateValue(realIndex, 'name', e.target.value)} placeholder={`バリュー名 ${realIndex + 1}`} className="h-10 flex-1" />
                          <Input type="text" value={value.description} onChange={(e) => updateValue(realIndex, 'description', e.target.value)} placeholder="説明" className="h-10 flex-[2]" />
                          <Button type="button" variant="outline" size="icon" onClick={() => removeValue(realIndex)} className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} /></Button>
                        </div>
                      )
                    })}
                </>
              )}
              {guidelines.values.length < 10 && (
                <Button type="button" variant="outline" onClick={addValue} className="py-2 px-4 text-[13px]">
                  <Plus size={16} />バリューを追加
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 3: ブランドストーリー＋沿革＋事業内容 */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 space-y-5">
            <div>
              <h2 className="text-sm font-bold mb-3">ブランドストーリー</h2>
              <AutoResizeTextarea
                value={guidelines.brand_story}
                onChange={(e) => handleChange('brand_story', e.target.value)}
                placeholder="企業の成り立ちや想いを物語として..."
                className="min-h-[200px]"
              />
            </div>

            <div>
              <h2 className="text-sm font-bold mb-3">沿革</h2>
              <p className="text-xs text-muted-foreground mb-2">
                企業の歩みを年と出来事で記録します
              </p>
              {guidelines.history.map((item, index) => (
                <div key={index} className="flex gap-2 mb-2 items-center">
                  <Input
                    type="text"
                    value={item.year}
                    onChange={(e) => updateHistory(index, 'year', e.target.value)}
                    placeholder="年"
                    className="h-10 w-20 shrink-0"
                  />
                  <Input
                    type="text"
                    value={item.event}
                    onChange={(e) => updateHistory(index, 'event', e.target.value)}
                    placeholder="出来事"
                    className="h-10 flex-1"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => removeHistory(index)} className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addHistory} className="py-2 px-4 text-[13px]">
                <Plus size={16} />沿革を追加
              </Button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold">事業内容</h2>
                {guidelines.business_content.length > 1 && (
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    <button type="button" onClick={() => handleChange('business_content_sort', 'registered')}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${guidelines.business_content_sort === 'registered' ? 'bg-foreground text-background' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
                      登録順
                    </button>
                    <button type="button" onClick={() => handleChange('business_content_sort', 'custom')}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${guidelines.business_content_sort === 'custom' ? 'bg-foreground text-background' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
                      カスタム
                    </button>
                  </div>
                )}
              </div>
              {guidelines.business_content_sort === 'custom' ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleBusinessDragEnd}>
                  <SortableContext items={guidelines.business_content.map((_, i) => `business-${i}`)} strategy={verticalListSortingStrategy}>
                    {guidelines.business_content.map((item, index) => (
                      <SortableBusinessItem key={`business-${index}`} id={`business-${index}`} item={item} index={index} onUpdate={updateBusiness} onRemove={removeBusiness} />
                    ))}
                  </SortableContext>
                </DndContext>
              ) : (
                <TitleDescriptionList
                  label=""
                  items={[...guidelines.business_content]
                    .sort((a, b) => (a.added_index ?? 0) - (b.added_index ?? 0))
                    .map(item => ({ title: item.title, description: item.description }))}
                  onChange={(newItems) => {
                    // added_index を保持してマージ
                    const sorted = [...guidelines.business_content].sort((a, b) => (a.added_index ?? 0) - (b.added_index ?? 0))
                    const maxIndex = sorted.reduce((max, b) => Math.max(max, b.added_index ?? 0), -1)
                    const result: BusinessItem[] = newItems.map((item, i) => ({
                      title: item.title,
                      description: item.description,
                      added_index: i < sorted.length ? sorted[i].added_index : maxIndex + 1 + (i - sorted.length),
                    }))
                    handleChange('business_content', result)
                  }}
                  addButtonLabel="事業内容を追加"
                  titlePlaceholder="事業タイトル"
                  descriptionPlaceholder="事業の説明"
                  required={false}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 4: ブランド特性 */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold">ブランド特性（最大5つ）</h2>
                {guidelines.traits.length > 1 && (
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    <button type="button" onClick={() => handleChange('traits_sort', 'registered')}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${guidelines.traits_sort === 'registered' ? 'bg-foreground text-background' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
                      登録順
                    </button>
                    <button type="button" onClick={() => handleChange('traits_sort', 'custom')}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${guidelines.traits_sort === 'custom' ? 'bg-foreground text-background' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
                      カスタム
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                ブランドの性格を表す特性とスコア（1〜10）を設定します
              </p>
              {guidelines.traits_sort === 'custom' ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTraitsDragEnd}>
                  <SortableContext items={guidelines.traits.map((_, i) => `trait-${i}`)} strategy={verticalListSortingStrategy}>
                    {guidelines.traits.map((trait, index) => (
                      <SortableTraitItem key={`trait-${index}`} id={`trait-${index}`} trait={trait} index={index} onUpdate={updateTrait} onRemove={removeTrait} />
                    ))}
                  </SortableContext>
                </DndContext>
              ) : (
                <>
                  {[...guidelines.traits]
                    .sort((a, b) => (a.added_index ?? 0) - (b.added_index ?? 0))
                    .map((trait) => {
                      const realIndex = guidelines.traits.indexOf(trait)
                      return (
                        <div key={realIndex} className="flex gap-2 mb-2 items-center">
                          <Input type="text" value={trait.name} onChange={(e) => updateTrait(realIndex, 'name', e.target.value)} placeholder="特性名" className="h-10 flex-1" />
                          <Input type="number" min={1} max={10} value={trait.score} onChange={(e) => updateTrait(realIndex, 'score', parseInt(e.target.value) || 5)} className="h-10 w-[70px] text-center" />
                          <Input type="text" value={trait.description} onChange={(e) => updateTrait(realIndex, 'description', e.target.value)} placeholder="この特性の説明" className="h-10 flex-[2]" />
                          <Button type="button" variant="outline" size="icon" onClick={() => removeTrait(realIndex)} className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} /></Button>
                        </div>
                      )
                    })}
                </>
              )}
              {guidelines.traits.length < 5 && (
                <Button type="button" variant="outline" onClick={addTrait} className="py-2 px-4 text-[13px]">
                  <Plus size={16} />特性を追加
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

      </form>

      {/* 固定保存バー */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex justify-start">
        <Button
          type="submit"
          form="guidelines-form"
          disabled={saving}
          className={`${saving ? 'opacity-60' : ''}`}
        >
          {saving ? '保存中...' : '保存する'}
        </Button>
      </div>
    </div>
  )
}
