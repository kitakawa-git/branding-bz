// CIマニュアル用データ一括取得
import { supabase } from '@/lib/supabase'
import { parseFontsFromDB } from '@/lib/brand-fonts'
import type {
  CIManualData,
  ValueItem,
  HistoryItem,
  BusinessItem,
  TraitItem,
  ColorPalette,
  LogoSection,
  GuidelineImage,
  TermItem,
  PersonaItem,
  ActionGuideline,
  PositioningMapData,
} from './types'

const DEFAULT_PALETTE: ColorPalette = {
  brand_colors: [],
  secondary_colors: [],
  accent_colors: [],
  utility_colors: [],
}

/** Supabase Storage URL からバケット名とパスを抽出 */
function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
  if (match) return { bucket: match[1], path: match[2] }
  return null
}

/** Blob を Canvas 経由で PNG data URL に変換（WebP等すべての形式に対応） */
function blobToPngDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob)
    const img = new window.Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(null)
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(null)
    }
    img.src = objectUrl
  })
}

/** 画像URLをPNG data URLに変換（fetch → Supabase download fallback） */
async function toDataUrl(url: string): Promise<string | null> {
  // 1. まず通常の fetch → Canvas PNG 変換を試す
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`fetch ${res.status}`)
    const blob = await res.blob()
    const result = await blobToPngDataUrl(blob)
    if (result) return result
  } catch (e) {
    console.warn('[CI Manual] fetch failed:', url, e)
  }
  // 2. Supabase Storage client 経由でダウンロード（CORS回避）→ Canvas PNG 変換
  try {
    const parsed = parseStorageUrl(url)
    if (parsed) {
      const { data, error } = await supabase.storage.from(parsed.bucket).download(parsed.path)
      if (!error && data) {
        const result = await blobToPngDataUrl(data)
        if (result) {
          console.log('[CI Manual] Supabase download fallback succeeded:', url)
          return result
        }
      }
    }
  } catch (e) {
    console.warn('[CI Manual] Supabase download fallback failed:', url, e)
  }
  return null
}

/** CIManualData内の全画像URLをdata URLに変換（PDF生成前に呼ぶ） */
export async function resolveImages(
  data: CIManualData,
  onProgress?: (step: string, progress: number) => void,
): Promise<CIManualData> {
  const tasks: { path: string; url: string }[] = []

  if (data.company.logo_url) {
    tasks.push({ path: 'company.logo_url', url: data.company.logo_url })
  }
  if (data.guidelines?.concept_visual_url) {
    tasks.push({ path: 'guidelines.concept_visual_url', url: data.guidelines.concept_visual_url })
  }
  if (data.visuals?.logo_sections) {
    data.visuals.logo_sections.forEach((section, si) => {
      section.items.forEach((item, ii) => {
        if (item.url) {
          tasks.push({ path: `visuals.logo_sections.${si}.items.${ii}.url`, url: item.url })
        }
      })
    })
  }
  if (data.visuals?.visual_guidelines_images) {
    data.visuals.visual_guidelines_images.forEach((img, i) => {
      if (img.url) {
        tasks.push({ path: `visuals.visual_guidelines_images.${i}.url`, url: img.url })
      }
    })
  }

  if (tasks.length === 0) return data

  onProgress?.('画像を読み込み中...', 20)
  console.log(`[CI Manual] Resolving ${tasks.length} images...`)

  const results = await Promise.all(tasks.map((t) => toDataUrl(t.url)))

  // 結果をログ
  tasks.forEach((t, i) => {
    if (results[i]) {
      console.log(`[CI Manual] Image OK: ${t.path} (${results[i]!.substring(0, 50)}...)`)
    } else {
      console.warn(`[CI Manual] Image FAILED: ${t.path} → ${t.url}`)
    }
  })

  // deep clone してdata URLを反映
  const resolved = JSON.parse(JSON.stringify(data)) as CIManualData

  // 変換成功した画像は data URL に置換、失敗した画像は空文字にして
  // @react-pdf/renderer が CORS エラーの外部 URL を fetch しないようにする
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function setNested(obj: any, path: string, value: string) {
    const parts = path.split('.')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = obj
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i]
      const next = current?.[key]
      if (next === undefined || next === null) {
        console.warn(`[CI Manual] setNested: path broken at "${key}" in "${path}"`)
        return
      }
      current = next
    }
    const lastKey = parts[parts.length - 1]
    current[lastKey] = value
  }

  tasks.forEach((t, i) => {
    // 成功: data URL を設定、失敗: 空文字にして Image レンダリングをスキップさせる
    setNested(resolved, t.path, results[i] || '')
  })

  const successCount = results.filter(Boolean).length
  console.log(`[CI Manual] Images resolved: ${successCount}/${tasks.length}`)
  onProgress?.('画像読み込み完了', 35)
  return resolved
}

export async function fetchCIManualData(companyId: string): Promise<CIManualData> {
  const [companyResult, guidelinesResult, visualsResult, personalityResult, termsResult, personasResult] =
    await Promise.all([
      supabase.from('companies').select('name, logo_url, brand_color_primary').eq('id', companyId).single(),
      supabase.from('brand_guidelines').select('*').eq('company_id', companyId).single(),
      supabase.from('brand_visuals').select('*').eq('company_id', companyId).single(),
      supabase.from('brand_personalities').select('*').eq('company_id', companyId).single(),
      supabase.from('brand_terms').select('*').eq('company_id', companyId).order('sort_order'),
      supabase.from('brand_personas').select('*').eq('company_id', companyId).order('sort_order'),
    ])

  const company = companyResult.data
  const gl = guidelinesResult.data
  const vis = visualsResult.data
  const pers = personalityResult.data
  const termsData = termsResult.data || []
  const personasData = personasResult.data || []

  // ブランドカラー取得
  const palette = (vis?.color_palette as ColorPalette) || DEFAULT_PALETTE
  const brandColor =
    palette.brand_colors?.[0]?.hex ||
    company?.brand_color_primary ||
    '#1a1a1a'

  // ペルソナデータから戦略情報を分離
  const firstPersona = personasData[0]
  const target = (firstPersona as Record<string, unknown>)?.target as string | null ?? null
  const positioningMapData = (firstPersona as Record<string, unknown>)?.positioning_map_data as PositioningMapData | null ?? null
  const actionGuidelines = ((firstPersona as Record<string, unknown>)?.action_guidelines as ActionGuideline[]) || []

  const personas: PersonaItem[] = personasData.map((p: Record<string, unknown>) => ({
    name: (p.name as string) || '',
    age_range: (p.age_range as string) || '',
    occupation: (p.occupation as string) || '',
    description: (p.description as string) || '',
    needs: (p.needs as string[]) || [],
    pain_points: (p.pain_points as string[]) || [],
  }))

  return {
    company: {
      name: company?.name || '',
      logo_url: company?.logo_url || null,
    },
    guidelines: gl
      ? {
          slogan: gl.slogan || null,
          concept_visual_url: gl.concept_visual_url || null,
          brand_statement: gl.brand_statement || null,
          mission: gl.mission || null,
          vision: gl.vision || null,
          values: ((gl.values as ValueItem[]) || []).filter((v) => v.name),
          brand_story: gl.brand_story || null,
          history: ((gl.history as HistoryItem[]) || []).filter((h) => h.year || h.event),
          business_content: ((gl.business_content as BusinessItem[]) || []).filter((b) => b.title),
          traits: ((gl.traits as TraitItem[]) || []).filter((t) => t.name),
        }
      : null,
    visuals: vis
      ? {
          color_palette: {
            brand_colors: palette.brand_colors || [],
            secondary_colors: palette.secondary_colors || [],
            accent_colors: palette.accent_colors || [],
            utility_colors: palette.utility_colors || [],
          },
          fonts: parseFontsFromDB(vis.fonts),
          logo_concept: vis.logo_concept || null,
          logo_sections: ((vis.logo_sections as LogoSection[]) || []).filter(
            (s) => s.title || s.items?.length,
          ),
          visual_guidelines: vis.visual_guidelines || null,
          visual_guidelines_images: ((vis.visual_guidelines_images as GuidelineImage[]) || []).filter(
            (img) => img.url,
          ),
        }
      : null,
    verbal: pers || termsData.length > 0
      ? {
          tone_of_voice: pers?.tone_of_voice || null,
          terms: termsData.map((t: Record<string, unknown>) => ({
            preferred_term: (t.preferred_term as string) || '',
            avoided_term: (t.avoided_term as string) || '',
            context: (t.context as string) || '',
            category: (t.category as string) || '',
          })),
        }
      : null,
    strategy:
      personas.length > 0 || target || positioningMapData || actionGuidelines.length > 0
        ? { target, personas, positioning_map_data: positioningMapData, action_guidelines: actionGuidelines }
        : null,
    brandColor,
  }
}
