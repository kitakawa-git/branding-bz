// バリュー評価レイヤー（評価軸マスター）の共有型
// API Route / 管理画面の双方が参照する。既存 lib/types/brand-quiz.ts に倣う。

export type EvaluationSheetStatus = 'draft' | 'active' | 'archived'
export type CriterionSourceType = 'value' | 'action_guideline' | 'custom'

// 5段階の行動記述の1段（常に level 1..5 の5要素で持つ）
export interface CriterionLevel {
  level: number
  description: string
}

// 評価軸マスターの親（≒ BrandQuiz）
export interface EvaluationSheet {
  id: string
  company_id: string
  title: string
  status: EvaluationSheetStatus
  version: number
  created_by: string | null
  created_at: string
  updated_at: string
}

// 評価項目（≒ BrandQuizQuestion）
export interface EvaluationCriterion {
  id: string
  sheet_id: string
  company_id: string
  source_type: CriterionSourceType
  source_id: string | null
  title: string
  description: string | null
  levels: CriterionLevel[]
  weight: number
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}
