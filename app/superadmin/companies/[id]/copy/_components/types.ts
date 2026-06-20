// コピーAI ワークベンチ 共通型・ラベル（client読み取り用）
import type { CopyRole } from '@/lib/copy/role-matrix'

export type CopyProject = {
  id: string
  company_id: string
  persona_id: string | null
  name: string
  brief: string | null
  status: string
  created_at: string
}

export type CopyInsight = {
  id: string
  project_id: string
  body: string
  psych_type: string
  rationale: string
  source_ref: { kind?: string; ref?: string } | null
  is_selected: boolean
  created_at: string
}

export type CopyAngle = {
  id: string
  project_id: string
  insight_id: string
  angle_type: string
  stance: string
  premise: string | null
  is_selected: boolean
  created_at: string
}

export type CopyDraft = {
  id: string
  project_id: string
  angle_id: string | null
  parent_draft_id: string | null
  copy_role: CopyRole
  register: string
  body: string
  generation_meta: Record<string, unknown> | null
  status: string
  created_at: string
}

export type CopyReview = {
  id: string
  draft_id: string
  craft_score: number
  brand_fit_score: number
  axis_scores: Record<string, number> | null
  red_flag: boolean
  critique: string | null
  suggestions: { quote: string; problem: string; rewrite_direction: string }[] | null
  reviewer_model: string | null
  created_at: string
}

export type Persona = { id: string; name: string; painPointCount: number }

export const PSYCH_LABELS: Record<string, string> = {
  hidden_anxiety: '隠れた不安',
  vanity: '見栄',
  self_image: '自己像',
  social_fear: '社会的恐れ',
  aspiration: '願望',
  frustration: '不満',
}

export const ANGLE_LABELS: Record<string, string> = {
  contrarian: '対立軸',
  identity_first: '自己像起点',
  villain_first: '共通の敵',
  reframe: '再定義',
  secret: '隠れた真実',
}

export const REGISTER_LABELS: Record<string, string> = {
  casual: 'カジュアル',
  neutral: '標準',
  formal: 'フォーマル',
  reverent: '荘厳',
}
