'use client'

// ビジュアルアイデンティティ 編集ページ（1企業1レコード、upsert方式）
import { useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/supabase-fetch'
import { useAuth } from '../../components/AuthProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DEFAULT_SUBTITLES, type PortalSubtitles } from '@/lib/portal-subtitles'
import { FONT_PREVIEW_TEXT, DEFAULT_FONT_ID, DEFAULT_FONT_ROLE, getCssFontFamily, getGoogleFontsUrl, parseFontsFromDB, type BrandFonts, type FontSource } from '@/lib/brand-fonts'
import { GoogleFontPicker } from '@/components/GoogleFontPicker'
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
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type LogoItem = { url: string; caption: string; added_index: number }
type LogoSection = { title: string; items: LogoItem[] }

type ColorItem = { name: string; hex: string }
type ColorPalette = {
  brand_colors: ColorItem[]
  secondary_colors: ColorItem[]
  accent_colors: ColorItem[]
  utility_colors: ColorItem[]
}

type ColorCategory = keyof ColorPalette

const COLOR_CATEGORIES: { key: ColorCategory; label: string; minColors: number }[] = [
  { key: 'brand_colors', label: 'プライマリカラー', minColors: 1 },
  { key: 'secondary_colors', label: 'セカンダリカラー', minColors: 1 },
  { key: 'accent_colors', label: 'アクセントカラー', minColors: 1 },
  { key: 'utility_colors', label: 'その他', minColors: 0 },
]

const DEFAULT_PALETTE: ColorPalette = {
  brand_colors: [{ name: 'Primary', hex: '#1a1a1a' }],
  secondary_colors: [{ name: 'Secondary', hex: '#666666' }],
  accent_colors: [{ name: 'Accent', hex: '#2563eb' }],
  utility_colors: [],
}

type GuidelineImage = { url: string; caption: string; added_index: number }

type Visuals = {
  fonts: BrandFonts
  visual_guidelines: string
  visual_guidelines_images: GuidelineImage[]
  visual_guidelines_sort: 'registered' | 'custom'
  logo_concept: string
  logo_sections: LogoSection[]
  logo_sections_sort: 'registered' | 'custom'
  color_palette: ColorPalette
}

type VisualsCache = {
  visualsId: string | null
  visuals: Visuals
  portalSubtitle: string
  portalSubtitlesData: PortalSubtitles | null
}

function SortableGuidelineItem({
  id,
  img,
  index,
  onCaptionChange,
  onRemove,
}: {
  id: string
  img: GuidelineImage
  index: number
  onCaptionChange: (index: number, caption: string) => void
  onRemove: (index: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="border border-border rounded-lg overflow-hidden bg-gray-50 relative">
      <div className="p-2 flex items-center justify-center min-h-[100px] bg-gray-100">
        <button
          type="button"
          className="absolute top-1 left-1 p-1 rounded hover:bg-gray-200 cursor-grab active:cursor-grabbing text-muted-foreground z-10"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute top-1 right-1 size-7 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive bg-background/80 z-10"
            >
              <Trash2 size={12} />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>画像を削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>この画像を削除します。この操作は保存後に確定されます。</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={() => onRemove(index)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除する</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <img
          src={img.url}
          alt={img.caption || ''}
          className="max-w-full max-h-[100px] object-contain"
        />
      </div>
      <div className="p-2">
        <Input
          type="text"
          value={img.caption}
          onChange={(e) => onCaptionChange(index, e.target.value)}
          placeholder="キャプション"
          className="text-xs py-1.5 px-2"
        />
      </div>
    </div>
  )
}

function SortableLogoItem({
  id,
  item,
  sIdx,
  iIdx,
  onCaptionChange,
  onRemove,
}: {
  id: string
  item: LogoItem
  sIdx: number
  iIdx: number
  onCaptionChange: (sIdx: number, iIdx: number, caption: string) => void
  onRemove: (sIdx: number, iIdx: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="border border-border rounded-lg overflow-hidden bg-gray-50 relative">
      <div className="p-2 flex items-center justify-center min-h-[100px] bg-gray-100">
        <button
          type="button"
          className="absolute top-1 left-1 p-1 rounded hover:bg-gray-200 cursor-grab active:cursor-grabbing text-muted-foreground z-10"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute top-1 right-1 size-7 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive bg-background/80 z-10"
            >
              <Trash2 size={12} />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>画像を削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>この画像を削除します。この操作は保存後に確定されます。</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={() => onRemove(sIdx, iIdx)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除する</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <img
          src={item.url}
          alt={item.caption || ''}
          className="max-w-full max-h-[100px] object-contain"
        />
      </div>
      <div className="p-2">
        <Input
          type="text"
          value={item.caption}
          onChange={(e) => onCaptionChange(sIdx, iIdx, e.target.value)}
          placeholder="キャプション"
          className="text-xs py-1.5 px-2"
        />
      </div>
    </div>
  )
}

export default function BrandVisualsPage() {
  const { companyId } = useAuth()
  const cacheKey = `admin-brand-visuals-${companyId}`
  const cached = companyId ? getPageCache<VisualsCache>(cacheKey) : null
  const [visualsId, setVisualsId] = useState<string | null>(cached?.visualsId ?? null)
  const [visuals, setVisuals] = useState<Visuals>(cached?.visuals ?? {
    fonts: { primary_font: { ...DEFAULT_FONT_ROLE }, secondary_font: { ...DEFAULT_FONT_ROLE } },
    visual_guidelines: '',
    visual_guidelines_images: [],
    visual_guidelines_sort: 'registered',
    logo_concept: '',
    logo_sections: [],
    logo_sections_sort: 'registered',
    color_palette: { ...DEFAULT_PALETTE },
  })
  const [loading, setLoading] = useState(!cached)
  const [fetchError, setFetchError] = useState('')
  const [saving, setSaving] = useState(false)
  const [portalSubtitle, setPortalSubtitle] = useState(cached?.portalSubtitle ?? '')
  const [portalSubtitlesData, setPortalSubtitlesData] = useState<PortalSubtitles | null>(cached?.portalSubtitlesData ?? null)
  const [uploadingMap, setUploadingMap] = useState<Record<string, boolean>>({})
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleGuidelineDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setVisuals(prev => {
      const oldIndex = prev.visual_guidelines_images.findIndex((_, i) => `guideline-${i}` === active.id)
      const newIndex = prev.visual_guidelines_images.findIndex((_, i) => `guideline-${i}` === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      return {
        ...prev,
        visual_guidelines_images: arrayMove(prev.visual_guidelines_images, oldIndex, newIndex),
      }
    })
  }

  const handleLogoDragEnd = (sIdx: number) => (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setVisuals(prev => {
      const sections = [...prev.logo_sections]
      const items = [...sections[sIdx].items]
      const oldIndex = items.findIndex((_, i) => `logo-${sIdx}-${i}` === active.id)
      const newIndex = items.findIndex((_, i) => `logo-${sIdx}-${i}` === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      sections[sIdx] = { ...sections[sIdx], items: arrayMove(items, oldIndex, newIndex) }
      return { ...prev, logo_sections: sections }
    })
  }

  const fetchVisuals = async () => {
    if (!companyId) return
    setLoading(true)
    setFetchError('')

    try {
      const { data, error: fetchErr } = await fetchWithRetry(() =>
        supabase.from('brand_visuals').select('*').eq('company_id', companyId).single()
      )
      if (fetchErr) throw new Error(fetchErr)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = data as Record<string, any> | null

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
          fetchedSubtitle = subtitles?.visuals || ''
          setPortalSubtitlesData(subtitles)
          setPortalSubtitle(fetchedSubtitle)
        }
      } catch {
        // サブタイトル取得失敗は無視
      }

      if (result) {
        setVisualsId(result.id)

        const cp = (result.color_palette as ColorPalette) || { brand_colors: [], secondary_colors: [], accent_colors: [], utility_colors: [] }
        const palette: ColorPalette = {
          brand_colors: cp.brand_colors || [{ name: 'Primary', hex: '#1a1a1a' }],
          secondary_colors: cp.secondary_colors || [{ name: 'Secondary', hex: '#666666' }],
          accent_colors: cp.accent_colors || [{ name: 'Accent', hex: '#2563eb' }],
          utility_colors: cp.utility_colors || [],
        }

        const parsedVisuals: Visuals = {
          fonts: parseFontsFromDB(result.fonts),
          visual_guidelines: result.visual_guidelines || '',
          visual_guidelines_images: ((result.visual_guidelines_images as { url: string; caption: string; added_index?: number }[]) || []).map((img, i) => ({
            ...img,
            added_index: img.added_index ?? i,
          })),
          visual_guidelines_sort: (result.visual_guidelines_sort as 'registered' | 'custom') || 'registered',
          logo_concept: result.logo_concept || '',
          logo_sections: ((result.logo_sections as { title: string; items: { url: string; caption: string; added_index?: number }[] }[]) || []).map(section => ({
            ...section,
            items: section.items.map((item, i) => ({
              ...item,
              added_index: item.added_index ?? i,
            })),
          })),
          logo_sections_sort: (result.logo_sections_sort as 'registered' | 'custom') || 'registered',
          color_palette: palette,
        }

        setVisuals(parsedVisuals)
        setPageCache(cacheKey, {
          visualsId: result.id,
          visuals: parsedVisuals,
          portalSubtitle: fetchedSubtitle,
          portalSubtitlesData: fetchedSubtitlesData,
        })
      }
    } catch (err) {
      console.error('[BrandVisuals] データ取得エラー:', err)
      const msg = err instanceof Error ? err.message : 'データの取得に失敗しました'
      setFetchError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<VisualsCache>(cacheKey)) return
    fetchVisuals()
  }, [companyId, cacheKey])

  const handleChange = (field: 'visual_guidelines' | 'logo_concept', value: string) => {
    setVisuals(prev => ({ ...prev, [field]: value }))
  }

  const handleFontChange = (
    fontRole: 'primary_font' | 'secondary_font',
    field: 'latin' | 'japanese',
    value: string,
    source: FontSource = 'google'
  ) => {
    setVisuals(prev => ({
      ...prev,
      fonts: {
        ...prev.fonts,
        [fontRole]: {
          ...prev.fonts[fontRole],
          [field]: value,
          [`${field}_source`]: source,
        },
      },
    }))
  }

  type FontPickerTarget = { fontRole: 'primary_font' | 'secondary_font'; field: 'latin' | 'japanese' } | null
  const [fontPickerTarget, setFontPickerTarget] = useState<FontPickerTarget>(null)

  // --- カラーパレット操作 ---
  const addColor = (category: ColorCategory) => {
    setVisuals(prev => {
      const colors = prev.color_palette[category]
      if (colors.length >= 10) return prev
      return {
        ...prev,
        color_palette: {
          ...prev.color_palette,
          [category]: [...colors, { name: '', hex: '#888888' }],
        },
      }
    })
  }

  const removeColor = (category: ColorCategory, index: number) => {
    setVisuals(prev => {
      const colors = prev.color_palette[category]
      return {
        ...prev,
        color_palette: {
          ...prev.color_palette,
          [category]: colors.filter((_, i) => i !== index),
        },
      }
    })
  }

  const updateColor = (category: ColorCategory, index: number, field: 'name' | 'hex', value: string) => {
    setVisuals(prev => {
      const colors = [...prev.color_palette[category]]
      colors[index] = { ...colors[index], [field]: value }
      return {
        ...prev,
        color_palette: {
          ...prev.color_palette,
          [category]: colors,
        },
      }
    })
  }

  // --- ロゴセクション操作 ---
  const addSection = () => {
    if (visuals.logo_sections.length >= 10) return
    setVisuals(prev => ({
      ...prev,
      logo_sections: [...prev.logo_sections, { title: '', items: [] }],
    }))
  }

  const removeSection = (sIdx: number) => {
    setVisuals(prev => ({
      ...prev,
      logo_sections: prev.logo_sections.filter((_, i) => i !== sIdx),
    }))
  }

  const updateSectionTitle = (sIdx: number, title: string) => {
    setVisuals(prev => {
      const sections = [...prev.logo_sections]
      sections[sIdx] = { ...sections[sIdx], title }
      return { ...prev, logo_sections: sections }
    })
  }

  const handleImageUpload = async (sIdx: number, file: File) => {
    if (!companyId) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('ファイルサイズは5MB以下にしてください')
      return
    }

    const key = `${sIdx}`
    setUploadingMap(prev => ({ ...prev, [key]: true }))

    try {
      const ext = file.name.split('.').pop()
      const fileName = `${companyId}/logos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error } = await supabase.storage
        .from('brand-assets')
        .upload(fileName, file, { upsert: true })

      if (error) {
        toast.error('アップロードに失敗しました: ' + error.message)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('brand-assets')
        .getPublicUrl(fileName)

      setVisuals(prev => {
        const sections = [...prev.logo_sections]
        const maxIndex = sections[sIdx].items.reduce((max, item) => Math.max(max, item.added_index), -1)
        const items = [...sections[sIdx].items, { url: publicUrl, caption: '', added_index: maxIndex + 1 }]
        sections[sIdx] = { ...sections[sIdx], items }
        return { ...prev, logo_sections: sections }
      })
    } catch {
      toast.error('アップロード中にエラーが発生しました')
    } finally {
      setUploadingMap(prev => ({ ...prev, [key]: false }))
    }
  }

  const removeImage = async (sIdx: number, iIdx: number) => {
    const url = visuals.logo_sections[sIdx].items[iIdx].url
    // Storage から削除
    try {
      const pathMatch = url.match(/brand-assets\/(.+)$/)
      if (pathMatch) {
        await supabase.storage.from('brand-assets').remove([pathMatch[1]])
      }
    } catch {
      // Storage削除失敗は無視（UIからは消す）
    }

    setVisuals(prev => {
      const sections = [...prev.logo_sections]
      const items = sections[sIdx].items.filter((_, i) => i !== iIdx)
      sections[sIdx] = { ...sections[sIdx], items }
      return { ...prev, logo_sections: sections }
    })
  }

  const updateCaption = (sIdx: number, iIdx: number, caption: string) => {
    setVisuals(prev => {
      const sections = [...prev.logo_sections]
      const items = [...sections[sIdx].items]
      items[iIdx] = { ...items[iIdx], caption }
      sections[sIdx] = { ...sections[sIdx], items }
      return { ...prev, logo_sections: sections }
    })
  }

  // --- ビジュアルガイドライン画像操作 ---
  const handleGuidelineImageUpload = async (file: File) => {
    if (!companyId) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('ファイルサイズは5MB以下にしてください')
      return
    }

    setUploadingMap(prev => ({ ...prev, guideline: true }))

    try {
      const ext = file.name.split('.').pop()
      const fileName = `${companyId}/guidelines/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error } = await supabase.storage
        .from('brand-assets')
        .upload(fileName, file, { upsert: true })

      if (error) {
        toast.error('アップロードに失敗しました: ' + error.message)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('brand-assets')
        .getPublicUrl(fileName)

      setVisuals(prev => {
        const maxIndex = prev.visual_guidelines_images.reduce((max, img) => Math.max(max, img.added_index), -1)
        return {
          ...prev,
          visual_guidelines_images: [...prev.visual_guidelines_images, { url: publicUrl, caption: '', added_index: maxIndex + 1 }],
        }
      })
    } catch {
      toast.error('アップロード中にエラーが発生しました')
    } finally {
      setUploadingMap(prev => ({ ...prev, guideline: false }))
    }
  }

  const removeGuidelineImage = async (index: number) => {
    const url = visuals.visual_guidelines_images[index].url
    try {
      const pathMatch = url.match(/brand-assets\/(.+)$/)
      if (pathMatch) {
        await supabase.storage.from('brand-assets').remove([pathMatch[1]])
      }
    } catch {
      // Storage削除失敗は無視
    }
    setVisuals(prev => ({
      ...prev,
      visual_guidelines_images: prev.visual_guidelines_images.filter((_, i) => i !== index),
    }))
  }

  const updateGuidelineCaption = (index: number, caption: string) => {
    setVisuals(prev => {
      const images = [...prev.visual_guidelines_images]
      images[index] = { ...images[index], caption }
      return { ...prev, visual_guidelines_images: images }
    })
  }

  // Supabase REST APIに直接fetchで保存
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

      // 空タイトル・空アイテムのセクションをクリーンアップ
      const cleanedSections = visuals.logo_sections
        .filter(s => s.title.trim() || s.items.length > 0)
        .map(s => ({
          title: s.title.trim(),
          items: s.items.map(item => ({ url: item.url, caption: item.caption.trim(), added_index: item.added_index })),
        }))

      const palette = visuals.color_palette

      const saveData: Record<string, unknown> = {
        company_id: companyId,
        color_palette: palette,
        fonts: visuals.fonts,
        visual_guidelines: visuals.visual_guidelines || null,
        visual_guidelines_images: visuals.visual_guidelines_images,
        visual_guidelines_sort: visuals.visual_guidelines_sort,
        logo_concept: visuals.logo_concept || null,
        logo_sections: cleanedSections,
        logo_sections_sort: visuals.logo_sections_sort,
      }

      let result: { ok: boolean; error?: string; data?: Record<string, unknown> }
      if (visualsId) {
        result = await supabasePatch('brand_visuals', visualsId, saveData, token)
      } else {
        result = await supabaseInsert('brand_visuals', saveData, token)
        if (result.ok && result.data) {
          setVisualsId(result.data.id as string)
        }
      }

      // ポータルサブタイトル保存
      const updatedSubtitles = { ...(portalSubtitlesData || {}) }
      if (portalSubtitle.trim()) {
        updatedSubtitles.visuals = portalSubtitle.trim()
      } else {
        delete updatedSubtitles.visuals
      }
      await supabasePatch('companies', companyId, {
        portal_subtitles: Object.keys(updatedSubtitles).length > 0 ? updatedSubtitles : null,
      }, token)
      setPortalSubtitlesData(updatedSubtitles)

      if (result.ok) {
        toast.success('保存しました')
      } else {
        toast.error('保存に失敗しました: ' + result.error)
      }
    } catch (err) {
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
        <div className="space-y-6">
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5 space-y-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-20 w-full rounded-md" />
              <Skeleton className="h-4 w-36" />
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-32 w-full rounded-lg" />
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5 space-y-4">
              <Skeleton className="h-4 w-32" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="border border-border rounded-lg overflow-hidden">
                    <Skeleton className="h-16 w-full" />
                    <div className="p-2">
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5 space-y-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
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
        <Button variant="outline" onClick={fetchVisuals} className="py-2 px-4 text-[13px]">
          再読み込み
        </Button>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">
        ビジュアルアイデンティティ
      </h1>
      <div className="mb-6">
        <Input
          type="text"
          value={portalSubtitle}
          onChange={(e) => setPortalSubtitle(e.target.value)}
          placeholder={DEFAULT_SUBTITLES.visuals}
          className="h-9 text-sm"
        />
        <p className="text-[11px] text-muted-foreground mt-1">ポータルに表示されるサブタイトル（空欄でデフォルト表示）</p>
      </div>

      <form id="visuals-form" onSubmit={handleSubmit} className="space-y-8">
        {/* カード1: ロゴコンセプト＆ロゴガイドライン */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            {/* ロゴコンセプト */}
            <div className="mb-5">
              <h2 className="text-sm font-bold mb-3">ロゴコンセプト</h2>
              <AutoResizeTextarea
                value={visuals.logo_concept}
                onChange={(e) => handleChange('logo_concept', e.target.value)}
                placeholder="ロゴに込めた意味やコンセプトを記述"
                className="min-h-[100px]"
              />
            </div>

            {/* ロゴガイドライン */}
            <div>
              <h2 className="text-sm font-bold mb-3">ロゴガイドライン</h2>

              {/* 表示順設定 */}
              {visuals.logo_sections.some(s => s.items.length > 0) && (
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs text-muted-foreground m-0">表示順:</p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setVisuals(prev => ({ ...prev, logo_sections_sort: 'registered' }))}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${visuals.logo_sections_sort === 'registered' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                    >
                      登録順
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisuals(prev => ({ ...prev, logo_sections_sort: 'custom' }))}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${visuals.logo_sections_sort === 'custom' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                    >
                      カスタム
                    </button>
                  </div>
                </div>
              )}

              {visuals.logo_sections.map((section, sIdx) => (
                <div key={sIdx} className="border border-border rounded-lg p-4 mb-3 bg-background">
                  {/* セクションヘッダー */}
                  <div className="flex items-center gap-2 mb-3">
                    <Input
                      type="text"
                      value={section.title}
                      onChange={(e) => updateSectionTitle(sIdx, e.target.value)}
                      placeholder="セクションタイトル（例: ロゴ、余白の指定、禁止事項）"
                      className="h-10 flex-1"
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>セクションを削除しますか？</AlertDialogTitle>
                          <AlertDialogDescription>「{section.title || `セクション ${sIdx + 1}`}」とその画像を全て削除します。</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>キャンセル</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removeSection(sIdx)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除する</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  {/* 画像一覧（カスタム順 — ドラッグ&ドロップ） */}
                  {section.items.length > 0 && visuals.logo_sections_sort === 'custom' && (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleLogoDragEnd(sIdx)}>
                      <SortableContext items={section.items.map((_, i) => `logo-${sIdx}-${i}`)} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 mb-3">
                          {section.items.map((item, iIdx) => (
                            <SortableLogoItem
                              key={`logo-${sIdx}-${iIdx}`}
                              id={`logo-${sIdx}-${iIdx}`}
                              item={item}
                              sIdx={sIdx}
                              iIdx={iIdx}
                              onCaptionChange={updateCaption}
                              onRemove={removeImage}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}

                  {/* 画像一覧（登録順） */}
                  {section.items.length > 0 && visuals.logo_sections_sort === 'registered' && (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 mb-3">
                      {[...section.items].sort((a, b) => a.added_index - b.added_index).map((item) => {
                        const realIdx = section.items.indexOf(item)
                        return (
                          <div key={realIdx} className="border border-border rounded-lg overflow-hidden bg-gray-50 relative">
                            <div className="p-2 flex items-center justify-center min-h-[100px] bg-gray-100">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="absolute top-1 right-1 size-7 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive bg-background/80 z-10"
                                  >
                                    <Trash2 size={12} />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>画像を削除しますか？</AlertDialogTitle>
                                    <AlertDialogDescription>この画像を削除します。この操作は保存後に確定されます。</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => removeImage(sIdx, realIdx)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除する</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              <img
                                src={item.url}
                                alt={item.caption || ''}
                                className="max-w-full max-h-[100px] object-contain"
                              />
                            </div>
                            <div className="p-2">
                              <Input
                                type="text"
                                value={item.caption}
                                onChange={(e) => updateCaption(sIdx, realIdx, e.target.value)}
                                placeholder="キャプション"
                                className="text-xs py-1.5 px-2"
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* 画像追加 */}
                  {section.items.length < 10 && (
                    <div>
                      <input
                        ref={(el) => { fileInputRefs.current[`file-${sIdx}`] = el }}
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleImageUpload(sIdx, file)
                          e.target.value = ''
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={uploadingMap[`${sIdx}`]}
                        onClick={() => fileInputRefs.current[`file-${sIdx}`]?.click()}
                        className="py-2 px-4 text-[13px]"
                      >
                        {uploadingMap[`${sIdx}`] ? 'アップロード中...' : <><Plus size={16} />画像を追加</>}
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              {visuals.logo_sections.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={addSection}
                  className="py-2 px-4 text-[13px]"
                >
                  <Plus size={16} />セクションを追加
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* カード2: ブランドカラー */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <h2 className="text-sm font-bold mb-5">ブランドカラー</h2>

            {COLOR_CATEGORIES.map((cat, catIdx) => (
              <div key={cat.key} className={catIdx < COLOR_CATEGORIES.length - 1 ? 'mb-6' : ''}>
                <h3 className="text-sm font-bold mb-3 text-muted-foreground">{cat.label}</h3>

                <div className="space-y-2">
                  {visuals.color_palette[cat.key].map((color, cIdx) => (
                    <div key={cIdx} className="flex items-center gap-2">
                      <input
                        type="color"
                        value={color.hex}
                        onChange={(e) => updateColor(cat.key, cIdx, 'hex', e.target.value)}
                        className="w-10 h-10 border border-border rounded-lg cursor-pointer p-0.5 shrink-0"
                      />
                      <Input
                        type="text"
                        value={color.hex}
                        onChange={(e) => updateColor(cat.key, cIdx, 'hex', e.target.value)}
                        className="h-10 w-[120px] font-mono text-sm shrink-0"
                      />
                      <Input
                        type="text"
                        value={color.name}
                        onChange={(e) => updateColor(cat.key, cIdx, 'name', e.target.value)}
                        placeholder="色名"
                        className="h-10 flex-1"
                      />
                      {visuals.color_palette[cat.key].length > cat.minColors && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>カラーを削除しますか？</AlertDialogTitle>
                              <AlertDialogDescription>「{color.name || color.hex}」を削除します。</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>キャンセル</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removeColor(cat.key, cIdx)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除する</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  ))}
                </div>

                {visuals.color_palette[cat.key].length < 10 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addColor(cat.key)}
                    className="py-2 px-4 text-[13px] mt-2"
                  >
                    <Plus size={16} />色を追加
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* カード3: フォント設定 */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            {/* Google Fonts CDN 読み込み */}
            {/* eslint-disable-next-line @next/next/no-page-custom-font */}
            <link rel="stylesheet" href={getGoogleFontsUrl(visuals.fonts)} />
            <h2 className="text-sm font-bold mb-5">フォント</h2>

            {/* プライマリフォント */}
            <div className="mb-6">
              <p className="text-xs font-semibold text-foreground mb-3 m-0">プライマリフォント（見出し・タイトル用）</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-10 shrink-0">欧文</span>
                  <button
                    type="button"
                    onClick={() => setFontPickerTarget({ fontRole: 'primary_font', field: 'latin' })}
                    className="flex-1 h-9 px-3 text-left text-sm bg-background border border-input rounded-md hover:bg-accent/50 transition-colors truncate"
                  >
                    {visuals.fonts.primary_font.latin}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-10 shrink-0">和文</span>
                  <button
                    type="button"
                    onClick={() => setFontPickerTarget({ fontRole: 'primary_font', field: 'japanese' })}
                    className="flex-1 h-9 px-3 text-left text-sm bg-background border border-input rounded-md hover:bg-accent/50 transition-colors truncate"
                  >
                    {visuals.fonts.primary_font.japanese}
                  </button>
                </div>
              </div>
              <p
                className="mt-2 text-sm leading-relaxed text-muted-foreground m-0"
                style={{ fontFamily: getCssFontFamily(visuals.fonts.primary_font), fontWeight: 700 }}
              >
                {FONT_PREVIEW_TEXT}
              </p>
            </div>

            {/* セカンダリフォント */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-3 m-0">セカンダリフォント（本文・説明文用）</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-10 shrink-0">欧文</span>
                  <button
                    type="button"
                    onClick={() => setFontPickerTarget({ fontRole: 'secondary_font', field: 'latin' })}
                    className="flex-1 h-9 px-3 text-left text-sm bg-background border border-input rounded-md hover:bg-accent/50 transition-colors truncate"
                  >
                    {visuals.fonts.secondary_font.latin}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-10 shrink-0">和文</span>
                  <button
                    type="button"
                    onClick={() => setFontPickerTarget({ fontRole: 'secondary_font', field: 'japanese' })}
                    className="flex-1 h-9 px-3 text-left text-sm bg-background border border-input rounded-md hover:bg-accent/50 transition-colors truncate"
                  >
                    {visuals.fonts.secondary_font.japanese}
                  </button>
                </div>
              </div>
              <p
                className="mt-2 text-sm leading-relaxed text-muted-foreground m-0"
                style={{ fontFamily: getCssFontFamily(visuals.fonts.secondary_font) }}
              >
                {FONT_PREVIEW_TEXT}
              </p>
            </div>

            <GoogleFontPicker
              open={fontPickerTarget !== null}
              onOpenChange={(open) => { if (!open) setFontPickerTarget(null) }}
              value={fontPickerTarget ? visuals.fonts[fontPickerTarget.fontRole][fontPickerTarget.field] : null}
              onSelect={(family, source) => {
                if (fontPickerTarget) handleFontChange(fontPickerTarget.fontRole, fontPickerTarget.field, family, source)
              }}
              mode={fontPickerTarget?.field || 'latin'}
            />
          </CardContent>
        </Card>

        {/* カード4: ビジュアルガイドライン */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <h2 className="text-sm font-bold mb-3">ビジュアルガイドライン</h2>
            <AutoResizeTextarea
              value={visuals.visual_guidelines}
              onChange={(e) => handleChange('visual_guidelines', e.target.value)}
              placeholder="写真のトーン、イラストのスタイルなど"
              className="min-h-[100px] mb-4"
            />

            {/* 表示順設定 */}
            {visuals.visual_guidelines_images.length > 0 && (
              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs text-muted-foreground m-0">表示順:</p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setVisuals(prev => ({ ...prev, visual_guidelines_sort: 'registered' }))}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${visuals.visual_guidelines_sort === 'registered' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                  >
                    登録順
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisuals(prev => ({ ...prev, visual_guidelines_sort: 'custom' }))}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${visuals.visual_guidelines_sort === 'custom' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                  >
                    カスタム
                  </button>
                </div>
              </div>
            )}

            {/* 参考画像 */}
            {visuals.visual_guidelines_images.length > 0 && visuals.visual_guidelines_sort === 'custom' && (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGuidelineDragEnd}>
                <SortableContext items={visuals.visual_guidelines_images.map((_, i) => `guideline-${i}`)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 mb-3">
                    {visuals.visual_guidelines_images.map((img, idx) => (
                      <SortableGuidelineItem
                        key={`guideline-${idx}`}
                        id={`guideline-${idx}`}
                        img={img}
                        index={idx}
                        onCaptionChange={updateGuidelineCaption}
                        onRemove={removeGuidelineImage}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
            {visuals.visual_guidelines_images.length > 0 && visuals.visual_guidelines_sort === 'registered' && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 mb-3">
                {[...visuals.visual_guidelines_images].sort((a, b) => a.added_index - b.added_index).map((img, idx) => {
                  const realIdx = visuals.visual_guidelines_images.indexOf(img)
                  return (
                    <div key={idx} className="border border-border rounded-lg overflow-hidden bg-gray-50 relative">
                      <div className="p-2 flex items-center justify-center min-h-[100px] bg-gray-100">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="absolute top-1 right-1 size-7 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive bg-background/80 z-10"
                            >
                              <Trash2 size={12} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>画像を削除しますか？</AlertDialogTitle>
                              <AlertDialogDescription>この画像を削除します。この操作は保存後に確定されます。</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>キャンセル</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removeGuidelineImage(realIdx)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除する</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <img
                          src={img.url}
                          alt={img.caption || ''}
                          className="max-w-full max-h-[100px] object-contain"
                        />
                      </div>
                      <div className="p-2">
                        <Input
                          type="text"
                          value={img.caption}
                          onChange={(e) => updateGuidelineCaption(realIdx, e.target.value)}
                          placeholder="キャプション"
                          className="text-xs py-1.5 px-2"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {visuals.visual_guidelines_images.length < 10 && (
              <div>
                <input
                  ref={(el) => { fileInputRefs.current['guideline'] = el }}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleGuidelineImageUpload(file)
                    e.target.value = ''
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadingMap['guideline']}
                  onClick={() => fileInputRefs.current['guideline']?.click()}
                  className="py-2 px-4 text-[13px]"
                >
                  {uploadingMap['guideline'] ? 'アップロード中...' : <><Plus size={16} />参考画像を追加</>}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

      </form>

      {/* 固定保存バー */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex justify-start">
        <Button
          type="submit"
          form="visuals-form"
          disabled={saving}
          className={`${saving ? 'opacity-60' : ''}`}
        >
          {saving ? '保存中...' : '保存する'}
        </Button>
      </div>
    </div>
  )
}
