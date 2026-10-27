// ビジュアル編集のローカル状態更新ハンドラ（並べ替え・テキスト・フォント・カラー・ロゴセクション・キャプション）
import { type DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { type FontSource } from '@/lib/brand-fonts'
import { type ColorCategory, type SetVisuals, type Visuals } from './types'

export function createVisualsEditHandlers(visuals: Visuals, setVisuals: SetVisuals) {
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

  const handleLogoBaseDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setVisuals(prev => {
      const oldIndex = prev.logo_images.findIndex((_, i) => `logobase-${i}` === active.id)
      const newIndex = prev.logo_images.findIndex((_, i) => `logobase-${i}` === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      return { ...prev, logo_images: arrayMove(prev.logo_images, oldIndex, newIndex) }
    })
  }

  // ロゴガイドラインのセクション自体の並べ替え
  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setVisuals(prev => {
      const oldIndex = prev.logo_sections.findIndex((_, i) => `section-${i}` === active.id)
      const newIndex = prev.logo_sections.findIndex((_, i) => `section-${i}` === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      return { ...prev, logo_sections: arrayMove(prev.logo_sections, oldIndex, newIndex) }
    })
  }

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

  const updateLogoImageCaption = (index: number, caption: string) => {
    setVisuals(prev => {
      const images = [...prev.logo_images]
      images[index] = { ...images[index], caption }
      return { ...prev, logo_images: images }
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

  // --- ビジュアルガイドライン ---
  const updateGuidelineCaption = (index: number, caption: string) => {
    setVisuals(prev => {
      const images = [...prev.visual_guidelines_images]
      images[index] = { ...images[index], caption }
      return { ...prev, visual_guidelines_images: images }
    })
  }

  const setGuidelineSort = (sort: 'registered' | 'custom') => {
    setVisuals(prev => ({ ...prev, visual_guidelines_sort: sort }))
  }

  return {
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
  }
}
