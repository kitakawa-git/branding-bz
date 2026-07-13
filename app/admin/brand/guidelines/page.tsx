'use client'

// ブランド方針 編集ページ
// スローガン・コンセプトビジュアル・動画・メッセージ・MVV・ストーリー・沿革・事業内容・特性
import { useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/supabase-fetch'
import { useAuth } from '../../components/AdminDataProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { type PortalSubtitles } from '@/lib/portal-subtitles'
import { splitBrandCopy, combineBrandCopy } from '@/lib/brand-mvv'
import { TitleDescriptionList } from '@/components/shared/TitleDescriptionList'
import { GripVertical, Plus, Trash2, Check } from 'lucide-react'
import { Fab, FabButton } from '@/components/ui/fab'
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
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// id は philosophy_elements の行ID（新規追加項目では undefined → 保存時INSERT）
type ValueItem = { id?: string; name: string; description: string; added_index: number }
type HistoryItem = { year: string; event: string }
type BusinessItem = { id?: string; title: string; description: string; added_index: number }

// 沿革の year フィールドは表示文字列（"2011年" / "2011年5月"）で保持する。
// ドロップダウン用に年・月を取り出す／組み立てるヘルパー。既存の年のみデータもそのまま扱える。
function parseHistoryYM(raw: string): { year: string; month: string } {
  const m = (raw || '').match(/(\d{4})[^\d]*(\d{1,2})?/)
  return { year: m?.[1] ?? '', month: m?.[2] ? String(parseInt(m[2], 10)) : '' }
}
function formatHistoryYM(year: string, month: string): string {
  if (!year) return ''
  return month ? `${year}年${month}月` : `${year}年`
}
const HISTORY_CURRENT_YEAR = new Date().getFullYear()
// 選択できる年（現在の年〜1900年）
const HISTORY_YEAR_OPTIONS = Array.from({ length: HISTORY_CURRENT_YEAR - 1900 + 1 }, (_, i) => HISTORY_CURRENT_YEAR - i)
type ActionGuideline = { id?: string; title: string; description: string }

type Guidelines = {
  slogan: string
  // スローガンの補足説明文（ポータル「考え方」でスローガン直下に表示）
  slogan_description: string
  // 複数コンセプトビジュアル（スライドショー用）。順序＝表示順。
  concept_visuals: string[]
  brand_video_url: string
  brand_statement: string
  // ミッション/ビジョンは「コピー（先頭段落）」と「説明文」を分けて編集する。
  // 保存時に combineBrandCopy で1テキスト（空行区切り）に結合し mission/vision カラムへ。
  mission_copy: string
  mission_body: string
  vision_copy: string
  vision_body: string
  values: ValueItem[]
  values_sort: 'registered' | 'custom'
  brand_story: string
  history: HistoryItem[]
  business_content: BusinessItem[]
  business_content_sort: 'registered' | 'custom'
  // 行動指針（旧 ブランド戦略 から移設。brand_guidelines.action_guidelines）
  action_guidelines: ActionGuideline[]
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
      {/* 説明は改行可（複数行入力）。Enterで改行、内容に応じて高さが伸びる */}
      <AutoResizeTextarea value={value.description} onChange={(e) => onUpdate(index, 'description', e.target.value)} placeholder="説明（改行可）" className="flex-[2] min-h-10" />
      <Button type="button" variant="outline" size="icon" onClick={() => onRemove(index)} className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} /></Button>
    </div>
  )
}

function SortableHistoryItem({
  id, item, index, onUpdate, onRemove,
}: {
  id: string; item: HistoryItem; index: number
  onUpdate: (index: number, field: 'year' | 'event', value: string) => void
  onRemove: (index: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const { year, month } = parseHistoryYM(item.year)
  return (
    <div ref={setNodeRef} style={style} className="flex gap-2 mb-2 items-start">
      <button type="button" className="mt-2.5 p-1 rounded hover:bg-gray-200 cursor-grab active:cursor-grabbing text-muted-foreground shrink-0" {...attributes} {...listeners}>
        <GripVertical size={16} />
      </button>
      <div className="flex gap-1 shrink-0">
        <select
          value={year}
          onChange={(e) => onUpdate(index, 'year', formatHistoryYM(e.target.value, month))}
          className="h-10 rounded-md border border-input bg-white px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">年</option>
          {HISTORY_YEAR_OPTIONS.map(y => (
            <option key={y} value={y}>{y}年</option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => onUpdate(index, 'year', formatHistoryYM(year, e.target.value))}
          className="h-10 rounded-md border border-input bg-white px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">月</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(mo => (
            <option key={mo} value={mo}>{mo}月</option>
          ))}
        </select>
      </div>
      {/* 出来事は改行可（複数行）。内容に応じて高さが伸びる */}
      <AutoResizeTextarea value={item.event} onChange={(e) => onUpdate(index, 'event', e.target.value)} placeholder="出来事（改行可）" className="flex-1 min-h-10" />
      <Button type="button" variant="outline" size="icon" onClick={() => onRemove(index)} className="mt-0.5 size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} /></Button>
    </div>
  )
}

function SortableConceptVisual({
  id, url, index, onRemove,
}: {
  id: string; url: string; index: number
  onRemove: (index: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="border border-border rounded-lg overflow-hidden bg-gray-50 relative">
      <div className="p-2 flex items-center justify-center min-h-[120px] bg-gray-100">
        <button type="button" className="absolute top-1 left-1 p-1 rounded hover:bg-gray-200 cursor-grab active:cursor-grabbing text-muted-foreground z-10" {...attributes} {...listeners}>
          <GripVertical size={16} />
        </button>
        <Button type="button" variant="outline" size="icon" onClick={() => onRemove(index)} className="absolute top-1 right-1 size-7 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive bg-background/80 z-10">
          <Trash2 size={12} />
        </Button>
        {/* 表示順バッジ（スライドの順番） */}
        <span className="absolute bottom-1 left-1 text-[10px] font-mono text-white bg-black/50 rounded px-1.5 py-0.5 z-10">{index + 1}</span>
        <img src={url} alt="" className="max-w-full max-h-[140px] object-contain" />
      </div>
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

function SortableActionItem({
  id, item, index, onUpdate, onRemove,
}: {
  id: string; item: ActionGuideline; index: number
  onUpdate: (index: number, field: 'title' | 'description', value: string) => void
  onRemove: (index: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="flex gap-2 mb-2 items-start">
      <button type="button" className="mt-2.5 p-1 rounded hover:bg-gray-200 cursor-grab active:cursor-grabbing text-muted-foreground shrink-0" {...attributes} {...listeners}>
        <GripVertical size={16} />
      </button>
      <Input type="text" value={item.title} onChange={(e) => onUpdate(index, 'title', e.target.value)} placeholder="タイトル（例: 顧客第一）" className="h-10 flex-[0_0_200px]" />
      {/* 説明は改行可（複数行入力）。Enterで改行、内容に応じて高さが伸びる */}
      <AutoResizeTextarea value={item.description} onChange={(e) => onUpdate(index, 'description', e.target.value)} placeholder="説明（改行可）" className="flex-1 min-h-10" />
      <Button type="button" variant="outline" size="icon" onClick={() => onRemove(index)} className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} /></Button>
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
    slogan_description: '',
    concept_visuals: [],
    brand_video_url: '',
    brand_statement: '',
    mission_copy: '',
    mission_body: '',
    vision_copy: '',
    vision_body: '',
    values: [],
    values_sort: 'registered',
    brand_story: '',
    history: [],
    business_content: [],
    business_content_sort: 'registered',
    action_guidelines: [],
  })
  const [loading, setLoading] = useState(!cached)
  const [fetchError, setFetchError] = useState('')
  const [saving, setSaving] = useState(false)
  const [portalSubtitle, setPortalSubtitle] = useState(cached?.portalSubtitle ?? '')
  const [portalSubtitlesData, setPortalSubtitlesData] = useState<PortalSubtitles | null>(cached?.portalSubtitlesData ?? null)
  const [uploadingConcept, setUploadingConcept] = useState(false)
  const conceptFileRef = useRef<HTMLInputElement | null>(null)

  const fetchGuidelines = async () => {
    if (!companyId) return
    setLoading(true)
    setFetchError('')

    try {
      const { data, error: fetchErr } = await fetchWithRetry(() =>
        // 新規企業は brand_guidelines 行が未作成のため maybeSingle（0件でもエラーにせず空フォーム表示）
        supabase.from('brand_guidelines').select('*').eq('company_id', companyId).maybeSingle()
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

      // 理念要素（mission/vision/values/action_guidelines）は philosophy_elements を正とする
      // （Step4: 表示・編集とも新テーブル。brand_guidelines の当該列は読まない）
      const { data: philData } = await fetchWithRetry(() =>
        supabase
          .from('philosophy_elements')
          .select('id, element_type, title, body, sort_order')
          .eq('company_id', companyId)
          .order('sort_order', { ascending: true })
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const philRows = (philData as any[] | null) || []
      const missionRow = philRows.find((r) => r.element_type === 'mission')
      const visionRow = philRows.find((r) => r.element_type === 'vision')
      const valueRows = philRows.filter((r) => r.element_type === 'value')
      const actionRows = philRows.filter((r) => r.element_type === 'action_guideline')
      const serviceRows = philRows.filter((r) => r.element_type === 'service')

      if (result || philRows.length > 0) {
        const parsedId = (result?.id as string) ?? null
        const parsedGuidelines: Guidelines = {
          slogan: result?.slogan || '',
          slogan_description: (result?.slogan_description as string) || '',
          // 新カラム concept_visuals を優先。空ならレガシー concept_visual_url を1枚として取り込む
          concept_visuals: (Array.isArray(result?.concept_visuals) && (result!.concept_visuals as string[]).length > 0)
            ? (result!.concept_visuals as string[])
            : (result?.concept_visual_url ? [result!.concept_visual_url as string] : []),
          brand_video_url: result?.brand_video_url || '',
          brand_statement: result?.brand_statement || '',
          // mission/vision は philosophy_elements の body をコピー/説明文に分割してフォームへ
          mission_copy: splitBrandCopy((missionRow?.body as string) || '').copy,
          mission_body: splitBrandCopy((missionRow?.body as string) || '').body,
          vision_copy: splitBrandCopy((visionRow?.body as string) || '').copy,
          vision_body: splitBrandCopy((visionRow?.body as string) || '').body,
          // values は philosophy_elements の value 行（id を保持し保存時の差分計算に使う）
          values: valueRows.map((r, i) => ({
            id: r.id as string,
            name: (r.title as string) || '',
            description: (r.body as string) || '',
            added_index: (r.sort_order as number) ?? i,
          })),
          values_sort: (result?.values_sort as 'registered' | 'custom') || 'registered',
          brand_story: result?.brand_story || '',
          history: result?.history || [],
          // business_content は philosophy_elements の service 行（id を保持し保存時の差分計算に使う）
          business_content: serviceRows.map((r, i) => ({
            id: r.id as string,
            title: (r.title as string) || '',
            description: (r.body as string) || '',
            added_index: (r.sort_order as number) ?? i,
          })),
          business_content_sort: (result?.business_content_sort as 'registered' | 'custom') || 'registered',
          // action_guidelines は philosophy_elements の action_guideline 行（id を保持）
          action_guidelines: actionRows.map((r) => ({
            id: r.id as string,
            title: (r.title as string) || '',
            description: (r.body as string) || '',
          })),
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

  // --- 行動指針 ---
  const addGuideline = () => {
    if (guidelines.action_guidelines.length >= 10) return
    handleChange('action_guidelines', [...guidelines.action_guidelines, { title: '', description: '' }])
  }
  const updateGuideline = (index: number, field: keyof ActionGuideline, value: string) => {
    const updated = [...guidelines.action_guidelines]
    updated[index] = { ...updated[index], [field]: value }
    handleChange('action_guidelines', updated)
  }
  const removeGuideline = (index: number) => {
    handleChange('action_guidelines', guidelines.action_guidelines.filter((_, i) => i !== index))
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

  const handleHistoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = guidelines.history.findIndex((_, i) => `history-${i}` === active.id)
    const newIndex = guidelines.history.findIndex((_, i) => `history-${i}` === over.id)
    if (oldIndex !== -1 && newIndex !== -1) {
      handleChange('history', arrayMove(guidelines.history, oldIndex, newIndex))
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

  const handleActionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = guidelines.action_guidelines.findIndex((_, i) => `action-${i}` === active.id)
    const newIndex = guidelines.action_guidelines.findIndex((_, i) => `action-${i}` === over.id)
    if (oldIndex !== -1 && newIndex !== -1) {
      handleChange('action_guidelines', arrayMove(guidelines.action_guidelines, oldIndex, newIndex))
    }
  }


  // --- コンセプトビジュアル（複数・スライドショー用） ---
  const handleConceptVisualUpload = async (file: File) => {
    if (!companyId) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('ファイルサイズは5MB以下にしてください')
      return
    }
    setUploadingConcept(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `${companyId}/concept-visuals/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('brand-assets').upload(fileName, file, { upsert: true })
      if (error) {
        toast.error('アップロードに失敗しました: ' + error.message)
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('brand-assets').getPublicUrl(fileName)
      setGuidelines(prev => ({ ...prev, concept_visuals: [...prev.concept_visuals, publicUrl] }))
    } catch {
      toast.error('アップロード中にエラーが発生しました')
    } finally {
      setUploadingConcept(false)
    }
  }

  const removeConceptVisual = (index: number) => {
    setGuidelines(prev => ({ ...prev, concept_visuals: prev.concept_visuals.filter((_, i) => i !== index) }))
  }

  const handleConceptDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setGuidelines(prev => {
      const oldIndex = prev.concept_visuals.findIndex((_, i) => `concept-${i}` === active.id)
      const newIndex = prev.concept_visuals.findIndex((_, i) => `concept-${i}` === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      return { ...prev, concept_visuals: arrayMove(prev.concept_visuals, oldIndex, newIndex) }
    })
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

  // philosophy_elements 行同期（編集も新テーブルへ）
  // mission/vision = 各社1行のsingleton upsert、values/action_guideline/service = id一致の差分CRUD（INSERT/UPDATE/DELETE）。
  // brand_guidelines の mission/vision/values/action_guidelines/business_content へは書かない（Step6でDROP予定）。
  const syncPhilosophyElements = async (
    cleanedValues: ValueItem[],
    cleanedGuidelines: ActionGuideline[],
    cleanedBusiness: BusinessItem[],
  ): Promise<{ ok: boolean; error?: string; values: ValueItem[]; guidelines: ActionGuideline[]; business: BusinessItem[] }> => {
    try {
      const now = new Date().toISOString()

      // mission / vision: 各社1行。本文ありなら upsert、空なら既存行を削除。
      const upsertSingleton = async (type: 'mission' | 'vision', text: string) => {
        const { data: ex, error: exErr } = await supabase
          .from('philosophy_elements')
          .select('id')
          .eq('company_id', companyId)
          .eq('element_type', type)
          .maybeSingle()
        if (exErr) throw exErr
        const exId = (ex as { id: string } | null)?.id ?? null
        if (text) {
          if (exId) {
            const { error } = await supabase
              .from('philosophy_elements')
              .update({ title: null, body: text, sort_order: 0, status: 'published', updated_at: now })
              .eq('id', exId)
            if (error) throw error
          } else {
            const { error } = await supabase
              .from('philosophy_elements')
              .insert({ company_id: companyId, element_type: type, body: text, sort_order: 0, status: 'published' })
            if (error) throw error
          }
        } else if (exId) {
          const { error } = await supabase.from('philosophy_elements').delete().eq('id', exId)
          if (error) throw error
        }
      }
      await upsertSingleton('mission', combineBrandCopy(guidelines.mission_copy, guidelines.mission_body))
      await upsertSingleton('vision', combineBrandCopy(guidelines.vision_copy, guidelines.vision_body))

      // values / action_guideline: 複数行。id一致でUPDATE・id無し（新規）でINSERT・desiredに無い既存行をDELETE。
      // sort_order = 表示順（配列インデックス）。表示ヘルパは sort_order を added_index に写像する。
      const syncList = async (
        type: 'value' | 'action_guideline' | 'service',
        desired: { id?: string; title: string; body: string }[],
      ): Promise<string[]> => {
        const { data: exRows, error: exErr } = await supabase
          .from('philosophy_elements')
          .select('id')
          .eq('company_id', companyId)
          .eq('element_type', type)
        if (exErr) throw exErr
        const existingIds = new Set((exRows as { id: string }[] | null)?.map((r) => r.id) ?? [])
        const kept = new Set<string>()
        const ids: string[] = []
        for (let i = 0; i < desired.length; i++) {
          const d = desired[i]
          if (d.id && existingIds.has(d.id)) {
            const { error } = await supabase
              .from('philosophy_elements')
              .update({ title: d.title, body: d.body, sort_order: i, status: 'published', updated_at: now })
              .eq('id', d.id)
            if (error) throw error
            kept.add(d.id)
            ids.push(d.id)
          } else {
            const { data, error } = await supabase
              .from('philosophy_elements')
              .insert({ company_id: companyId, element_type: type, title: d.title, body: d.body, sort_order: i, status: 'published' })
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
        return ids
      }

      const valueIds = await syncList(
        'value',
        cleanedValues.map((v) => ({ id: v.id, title: v.name, body: v.description })),
      )
      const guidelineIds = await syncList(
        'action_guideline',
        cleanedGuidelines.map((g) => ({ id: g.id, title: g.title, body: g.description })),
      )
      const businessIds = await syncList(
        'service',
        cleanedBusiness.map((b) => ({ id: b.id, title: b.title, body: b.description })),
      )

      // 保存後の最新id・表示順をフォーム状態へ反映（再保存時の差分計算のため）
      const valuesWithId: ValueItem[] = cleanedValues.map((v, i) => ({ ...v, id: valueIds[i], added_index: i }))
      const guidelinesWithId: ActionGuideline[] = cleanedGuidelines.map((g, i) => ({ ...g, id: guidelineIds[i] }))
      const businessWithId: BusinessItem[] = cleanedBusiness.map((b, i) => ({ ...b, id: businessIds[i], added_index: i }))
      return { ok: true, values: valuesWithId, guidelines: guidelinesWithId, business: businessWithId }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : '不明なエラー',
        values: cleanedValues,
        guidelines: cleanedGuidelines,
        business: cleanedBusiness,
      }
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
      const cleanedGuidelines = guidelines.action_guidelines.filter(g => g.title.trim() !== '' || g.description.trim() !== '')

      const saveData: Record<string, unknown> = {
        company_id: companyId,
        slogan: guidelines.slogan || null,
        slogan_description: guidelines.slogan_description || null,
        concept_visuals: guidelines.concept_visuals,
        // レガシー/CIマニュアル表紙互換: 先頭画像を単一URLカラムにも保存
        concept_visual_url: guidelines.concept_visuals[0] || null,
        brand_video_url: guidelines.brand_video_url ? normalizeUrl(guidelines.brand_video_url) : null,
        brand_statement: guidelines.brand_statement || null,
        // ※ mission/vision/values/action_guidelines/business_content は philosophy_elements へ移行済み。
        //   ここでは brand_guidelines へ書かない（Step6でDROP）。values_sort/business_content_sort は表示順設定として継続。
        values_sort: guidelines.values_sort,
        brand_story: guidelines.brand_story || null,
        history: cleanedHistory.length > 0 ? cleanedHistory : [],
        business_content_sort: guidelines.business_content_sort,
      }

      let result: { ok: boolean; error?: string; data?: Record<string, unknown> }
      let effectiveGuidelinesId = guidelinesId

      if (guidelinesId) {
        result = await supabasePatch('brand_guidelines', guidelinesId, saveData, token)
      } else {
        result = await supabaseInsert('brand_guidelines', saveData, token)
        if (result.ok && result.data) {
          effectiveGuidelinesId = result.data.id as string
          setGuidelinesId(effectiveGuidelinesId)
        }
      }

      // 理念要素（mission/vision/values/action_guidelines/service）を philosophy_elements の行へ同期
      const philResult = await syncPhilosophyElements(cleanedValues, cleanedGuidelines, cleanedBusiness)

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

      if (result.ok && philResult.ok) {
        toast.success('保存しました')
        // 保存後の正規化済み state（philosophy_elements の id・表示順を反映）
        const nextGuidelines: Guidelines = {
          ...guidelines,
          values: philResult.values,
          action_guidelines: philResult.guidelines,
          history: cleanedHistory,
          business_content: philResult.business,
          brand_video_url: guidelines.brand_video_url ? normalizeUrl(guidelines.brand_video_url) : '',
        }
        setGuidelines(nextGuidelines)
        // 再保存時の差分計算のため、最新id等をキャッシュへ反映
        setPageCache<GuidelinesCache>(cacheKey, {
          guidelinesId: effectiveGuidelinesId,
          guidelines: nextGuidelines,
          portalSubtitle: portalSubtitle.trim(),
          portalSubtitlesData: updatedSubtitles,
        })
      } else {
        toast.error('保存に失敗しました: ' + (result.error || philResult.error || ''))
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
      <div className="space-y-6">
        {/* スローガン＋コンセプトビジュアル＋動画＋メッセージ */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 space-y-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-20 w-full rounded-md" />
          </CardContent>
        </Card>
        {/* ミッション＋ビジョン＋バリュー（コピー欄＋説明欄＋値リスト） */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-4 w-28" />
            {[1, 2].map(i => (
              <div key={i} className="flex gap-2 items-start">
                <Skeleton className="h-10 flex-1 rounded-md" />
                <Skeleton className="h-10 flex-[2] rounded-md" />
                <Skeleton className="size-9 rounded-md" />
              </div>
            ))}
          </CardContent>
        </Card>
        {/* ブランドストーリー＋沿革＋事業内容 */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 space-y-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full rounded-md" />
          </CardContent>
        </Card>
        {/* 行動指針 */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 space-y-3">
            <Skeleton className="h-4 w-24" />
            {[1, 2].map(i => (
              <div key={i} className="flex gap-2 items-start">
                <Skeleton className="h-10 flex-1 rounded-md" />
                <Skeleton className="h-10 flex-[2] rounded-md" />
                <Skeleton className="size-9 rounded-md" />
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
        <Button variant="outline" onClick={fetchGuidelines} className="py-2 px-4 text-[13px]">再読み込み</Button>
      </div>
    )
  }

  return (
    <div>
      <form id="guidelines-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: スローガン＋コンセプトビジュアル＋ブランド動画＋メッセージ */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 space-y-8">
            <div>
              <h2 className="text-xs font-bold mb-3">スローガン</h2>
              <Input
                type="text"
                value={guidelines.slogan}
                onChange={(e) => handleChange('slogan', e.target.value)}
                placeholder="企業スローガン"
                className="h-10"
              />
              <p className="text-[11px] text-gray-500 mt-3 mb-1.5">説明文（任意）</p>
              <AutoResizeTextarea
                value={guidelines.slogan_description}
                onChange={(e) => handleChange('slogan_description', e.target.value)}
                placeholder="スローガンに込めた意味や補足（ポータルでスローガンの下に表示されます）"
                className="min-h-[72px]"
              />
            </div>

            <div>
              <h2 className="text-xs font-bold mb-3">コンセプトビジュアル</h2>
              <p className="text-xs text-muted-foreground mb-3">複数枚登録すると、ポータルでスライドショーとして表示されます（最大10枚・ドラッグで順序変更）</p>

              {guidelines.concept_visuals.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleConceptDragEnd}>
                  <SortableContext items={guidelines.concept_visuals.map((_, i) => `concept-${i}`)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 mb-3">
                      {guidelines.concept_visuals.map((url, idx) => (
                        <SortableConceptVisual
                          key={`concept-${idx}`}
                          id={`concept-${idx}`}
                          url={url}
                          index={idx}
                          onRemove={removeConceptVisual}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              {guidelines.concept_visuals.length < 10 && (
                <div>
                  <input
                    ref={conceptFileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleConceptVisualUpload(file)
                      e.target.value = ''
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploadingConcept}
                    onClick={() => conceptFileRef.current?.click()}
                    className="py-2 px-4 text-[13px]"
                  >
                    {uploadingConcept ? 'アップロード中...' : <><Plus size={16} />画像を追加</>}
                  </Button>
                </div>
              )}
            </div>

            <div>
              <h2 className="text-xs font-bold mb-3">ブランド動画URL</h2>
              <Input
                type="text"
                value={guidelines.brand_video_url}
                onChange={(e) => handleChange('brand_video_url', e.target.value)}
                placeholder="https://youtube.com/..."
                className="h-10"
              />
            </div>

            <div>
              <h2 className="text-xs font-bold mb-3">メッセージ</h2>
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
          <CardContent className="p-5 space-y-6">
            <div>
              <h2 className="text-xs font-bold mb-3">ミッション</h2>
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">コピー（キャッチコピー）</label>
                  <Input
                    value={guidelines.mission_copy}
                    onChange={(e) => handleChange('mission_copy', e.target.value)}
                    placeholder="例：まっすぐな仕事で、地域の信頼に応える。"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">説明文</label>
                  <AutoResizeTextarea
                    value={guidelines.mission_body}
                    onChange={(e) => handleChange('mission_body', e.target.value)}
                    placeholder="コピーを補足する説明文（改行可）"
                    className="min-h-[100px]"
                  />
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xs font-bold mb-3">ビジョン</h2>
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">コピー（キャッチコピー）</label>
                  <Input
                    value={guidelines.vision_copy}
                    onChange={(e) => handleChange('vision_copy', e.target.value)}
                    placeholder="例：誰もが挑戦できる社会をつくる。"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">説明文</label>
                  <AutoResizeTextarea
                    value={guidelines.vision_body}
                    onChange={(e) => handleChange('vision_body', e.target.value)}
                    placeholder="コピーを補足する説明文（改行可）"
                    className="min-h-[100px]"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold">バリュー（最大10個）</h2>
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
                          {/* 説明は改行可（複数行入力）。Enterで改行、内容に応じて高さが伸びる */}
                          <AutoResizeTextarea value={value.description} onChange={(e) => updateValue(realIndex, 'description', e.target.value)} placeholder="説明（改行可）" className="flex-[2] min-h-10" />
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

        {/* Card 3: 行動指針（旧 ブランド戦略 から移設。ブランドストーリーより上に表示） */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <h2 className="text-xs font-bold mb-3">行動指針</h2>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleActionDragEnd}>
              <SortableContext items={guidelines.action_guidelines.map((_, i) => `action-${i}`)} strategy={verticalListSortingStrategy}>
                {guidelines.action_guidelines.map((guideline, index) => (
                  <SortableActionItem key={`action-${index}`} id={`action-${index}`} item={guideline} index={index} onUpdate={updateGuideline} onRemove={removeGuideline} />
                ))}
              </SortableContext>
            </DndContext>
            {guidelines.action_guidelines.length < 10 && (
              <Button type="button" variant="outline" onClick={addGuideline} className="py-1.5 px-3 text-xs">
                <Plus size={16} />行動指針を追加
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Card 4: ブランドストーリー＋沿革＋事業内容 */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 space-y-8">
            <div>
              <h2 className="text-xs font-bold mb-3">ブランドストーリー</h2>
              <AutoResizeTextarea
                value={guidelines.brand_story}
                onChange={(e) => handleChange('brand_story', e.target.value)}
                placeholder="企業の成り立ちや想いを物語として..."
                className="min-h-[200px]"
              />
            </div>

            <div>
              <h2 className="text-xs font-bold mb-3">沿革</h2>
              <p className="text-xs text-muted-foreground mb-2">
                企業の歩みを年と出来事で記録します
              </p>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleHistoryDragEnd}>
                <SortableContext items={guidelines.history.map((_, i) => `history-${i}`)} strategy={verticalListSortingStrategy}>
                  {guidelines.history.map((item, index) => (
                    <SortableHistoryItem
                      key={`history-${index}`}
                      id={`history-${index}`}
                      item={item}
                      index={index}
                      onUpdate={updateHistory}
                      onRemove={removeHistory}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              <Button type="button" variant="outline" onClick={addHistory} className="py-2 px-4 text-[13px]">
                <Plus size={16} />沿革を追加
              </Button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold">事業内容</h2>
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

      </form>

      {/* 固定保存バー */}
      {/* FabBar との重なりを防ぐスペーサー */}
      <div className="h-24" />

      {/* 保存 FAB（右下固定・include-bz node の FabButton と同装飾） */}
      <Fab>
        <FabButton type="submit" form="guidelines-form" disabled={saving} icon={<Check size={16} />}>
          {saving ? '保存中...' : '保存'}
        </FabButton>
      </Fab>
    </div>
  )
}
