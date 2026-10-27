'use client'

// ビジュアルアイデンティティ 編集ページ（1企業1レコード、upsert方式）
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/supabase-fetch'
import { useAuth } from '../../components/AdminDataProvider'
import { setPageCache, getPageCache, clearPageCache } from '@/lib/page-cache'
import { Button } from '@/components/ui/button'
import { type PortalSubtitles } from '@/lib/portal-subtitles'
import { DEFAULT_FONT_ROLE, parseFontsFromDB } from '@/lib/brand-fonts'
import { Check } from 'lucide-react'
import { Fab, FabButton } from '@/components/ui/fab'
import {
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { supabasePatch, supabaseInsert } from '@/lib/admin/supabase-rest'
import { DEFAULT_PALETTE, type ColorPalette, type Visuals, type VisualsCache } from './_components/types'
import { createVisualsEditHandlers } from './_components/visuals-edit-handlers'
import { useVisualsImageUpload } from './_components/useVisualsImageUpload'
import { VisualsSkeleton } from './_components/VisualsSkeleton'
import { LogoCard } from './_components/LogoCard'
import { ColorPaletteCard } from './_components/ColorPaletteCard'
import { FontCard } from './_components/FontCard'
import { GuidelineCard } from './_components/GuidelineCard'

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
    logo_images: [],
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
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const {
    uploadingMap,
    handleImageUpload,
    removeImage,
    handleLogoImageUpload,
    removeLogoImage,
    handleGuidelineImageUpload,
    removeGuidelineImage,
  } = useVisualsImageUpload(companyId, visuals, setVisuals)

  const fetchVisuals = async () => {
    if (!companyId) return
    setLoading(true)
    setFetchError('')

    try {
      const { data, error: fetchErr } = await fetchWithRetry(() =>
        // 新規企業は brand_visuals 行が未作成のため maybeSingle（0件でもエラーにせず空フォーム表示）
        supabase.from('brand_visuals').select('*').eq('company_id', companyId).maybeSingle()
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
          logo_images: ((result.logo_images as unknown[]) || []).map((item) =>
            typeof item === 'string'
              ? { url: item, caption: '' }
              : { url: ((item as Record<string, unknown>).url as string) || '', caption: ((item as Record<string, unknown>).caption as string) || '' }
          ),
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

  const {
    handleGuidelineDragEnd,
    handleLogoDragEnd,
    handleLogoBaseDragEnd,
    handleSectionDragEnd,
    handleChange,
    handleFontChange,
    addColor,
    removeColor,
    updateColor,
    addSection,
    removeSection,
    updateSectionTitle,
    updateLogoImageCaption,
    updateCaption,
    updateGuidelineCaption,
    setGuidelineSort,
  } = createVisualsEditHandlers(visuals, setVisuals)

  // Supabase REST APIに直接fetchで保存

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
        logo_images: visuals.logo_images,
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
        // 保存内容でページキャッシュを更新（他ページへ移動→戻ると消える問題の防止）
        const savedVisuals = { ...visuals, logo_sections: cleanedSections }
        setVisuals(savedVisuals)
        setPageCache(cacheKey, {
          visualsId: (result.data?.id as string) ?? visualsId,
          visuals: savedVisuals,
          portalSubtitle: portalSubtitle.trim(),
          portalSubtitlesData: updatedSubtitles,
        })
        // ポータル側の同データキャッシュを無効化（同一ブラウザで管理画面→ポータル遷移時の反映漏れ防止）
        clearPageCache(`portal-visuals-${companyId}`)
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
    return <VisualsSkeleton />
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
      <form id="visuals-form" onSubmit={handleSubmit} className="space-y-4">
        {/* カード1: ロゴ基本形＆ロゴコンセプト＆ロゴガイドライン */}
        <LogoCard
          logoImages={visuals.logo_images}
          logoConcept={visuals.logo_concept}
          logoSections={visuals.logo_sections}
          sensors={sensors}
          uploadingMap={uploadingMap}
          onLogoBaseDragEnd={handleLogoBaseDragEnd}
          onLogoImageCaptionChange={updateLogoImageCaption}
          onLogoImageRemove={removeLogoImage}
          onLogoImageUpload={handleLogoImageUpload}
          onLogoConceptChange={(value) => handleChange('logo_concept', value)}
          onSectionDragEnd={handleSectionDragEnd}
          onSectionTitleChange={updateSectionTitle}
          onSectionRemove={removeSection}
          onLogoDragEnd={handleLogoDragEnd}
          onCaptionChange={updateCaption}
          onImageRemove={removeImage}
          onImageUpload={handleImageUpload}
          onAddSection={addSection}
        />

        {/* カード2: ブランドカラー */}
        <ColorPaletteCard
          colorPalette={visuals.color_palette}
          onAddColor={addColor}
          onRemoveColor={removeColor}
          onUpdateColor={updateColor}
        />

        {/* カード3: フォント設定 */}
        <FontCard fonts={visuals.fonts} onFontChange={handleFontChange} />

        {/* カード4: ビジュアルガイドライン */}
        <GuidelineCard
          visualGuidelines={visuals.visual_guidelines}
          images={visuals.visual_guidelines_images}
          sort={visuals.visual_guidelines_sort}
          sensors={sensors}
          uploadingMap={uploadingMap}
          onGuidelinesChange={(value) => handleChange('visual_guidelines', value)}
          onSortChange={setGuidelineSort}
          onDragEnd={handleGuidelineDragEnd}
          onCaptionChange={updateGuidelineCaption}
          onRemove={removeGuidelineImage}
          onUpload={handleGuidelineImageUpload}
        />

      </form>

      {/* 固定保存バー */}
      {/* FabBar との重なりを防ぐスペーサー */}
      <div className="h-24" />

      {/* 保存 FAB（右下固定・include-bz node の FabButton と同装飾） */}
      <Fab>
        <FabButton type="submit" form="visuals-form" disabled={saving} icon={<Check size={16} />}>
          {saving ? '保存中...' : '保存'}
        </FabButton>
      </Fab>
    </div>
  )
}
