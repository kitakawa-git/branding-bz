// ラーニングの一覧（構造）と動画の保存（lib/page-cache.ts の persist）。
// 再読込（引っ張り更新を含む）後もすぐ表示し、裏で取り直す。一覧の保存分は、一覧から動画を開いたときの
// 詳細ページの初期表示にも使う（動画の情報は一覧と同じ LearningVideoWithProgress）
import type { LearningVideoWithProgress } from '@/lib/types/learning'

export type ThemeNode = {
  id: string
  name: string
  description: string | null
  video_count: number
  videos: LearningVideoWithProgress[]
}
export type CategoryNode = {
  id: string
  name: string
  direct_videos: LearningVideoWithProgress[]
  themes: ThemeNode[]
}
export type Structure = { categories: CategoryNode[]; uncategorized: LearningVideoWithProgress[] }

export const learningStructureKey = (companyId: string) => `portal-learning-structure-${companyId}`
export const learningVideoKey = (videoId: string) => `portal-learning-video-${videoId}`

export function findVideoInStructure(structure: Structure | null, videoId: string) {
  if (!structure) return null
  for (const c of structure.categories) {
    const direct = c.direct_videos.find((v) => v.id === videoId)
    if (direct) return direct
    for (const t of c.themes) {
      const v = t.videos.find((x) => x.id === videoId)
      if (v) return v
    }
  }
  return structure.uncategorized.find((v) => v.id === videoId) ?? null
}
