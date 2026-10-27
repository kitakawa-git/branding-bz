// ロゴ基本形・ロゴガイドライン・ビジュアルガイドライン画像のアップロード／削除（Storage）とアップロード中状態
import { useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { type SetVisuals, type Visuals } from './types'

export function useVisualsImageUpload(companyId: string | null | undefined, visuals: Visuals, setVisuals: SetVisuals) {
  const [uploadingMap, setUploadingMap] = useState<Record<string, boolean>>({})

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

  // --- ロゴ基本形画像 ---
  const handleLogoImageUpload = async (file: File) => {
    if (!companyId) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('ファイルサイズは5MB以下にしてください')
      return
    }
    setUploadingMap(prev => ({ ...prev, 'logo-base': true }))
    try {
      const ext = file.name.split('.').pop()
      const fileName = `${companyId}/logos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('brand-assets').upload(fileName, file, { upsert: true })
      if (error) {
        toast.error('アップロードに失敗しました: ' + error.message)
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('brand-assets').getPublicUrl(fileName)
      setVisuals(prev => ({ ...prev, logo_images: [...prev.logo_images, { url: publicUrl, caption: '' }] }))
    } catch {
      toast.error('アップロード中にエラーが発生しました')
    } finally {
      setUploadingMap(prev => ({ ...prev, 'logo-base': false }))
    }
  }

  const removeLogoImage = async (index: number) => {
    const url = visuals.logo_images[index]?.url
    try {
      const pathMatch = url?.match(/brand-assets\/(.+)$/)
      if (pathMatch) await supabase.storage.from('brand-assets').remove([pathMatch[1]])
    } catch {
      // Storage削除失敗は無視（UIからは消す）
    }
    setVisuals(prev => ({ ...prev, logo_images: prev.logo_images.filter((_, i) => i !== index) }))
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

  return {
    uploadingMap,
    handleImageUpload,
    removeImage,
    handleLogoImageUpload,
    removeLogoImage,
    handleGuidelineImageUpload,
    removeGuidelineImage,
  }
}
