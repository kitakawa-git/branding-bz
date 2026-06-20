// ペルソナビルダー マルチペルソナ 共通型・定数（Step2/Step3/Step5/page で共有）
/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Demographics {
  persona_name: string
  age: number | string
  gender: string
  occupation: string
  company_role: string
  company_size: string
  location: string
  hobbies: string[]
  media_channels: string[]
  personality_traits: string[]
  daily_routine: string
  quote: string
}

export interface GoalsData {
  primary_goals: string[]
  challenges: string[]
  pain_points: string[]
  buying_motivation: string
  buying_barriers: string[]
  decision_factors: string[]
  brand_expectations: string
  success_definition: string
}

// マルチの正：1ターゲット＝1ペルソナ（demographics＋goals）
export interface Persona {
  demographics: Demographics
  goals: GoalsData
}

export interface BasicInfo {
  company_name: string
  industry_category: string
  industry_subcategory: string
  products: string
  target_description: string
  target_segments?: Array<{ name: string; description?: string }>
  [key: string]: any
}

export const EMPTY_DEMOGRAPHICS: Demographics = {
  persona_name: '', age: '', gender: '', occupation: '', company_role: '',
  company_size: '', location: '',
  hobbies: [], media_channels: [], personality_traits: [], daily_routine: '', quote: '',
}

export const EMPTY_GOALS: GoalsData = {
  primary_goals: [], challenges: [], pain_points: [],
  buying_motivation: '', buying_barriers: [], decision_factors: [],
  brand_expectations: '', success_definition: '',
}

export const emptyPersona = (): Persona => ({
  demographics: { ...EMPTY_DEMOGRAPHICS },
  goals: { ...EMPTY_GOALS },
})

// basic_info を「特定の1ターゲットだけ」に絞って AI に渡す（各ペルソナを1セグメントで生成するため）。
export function narrowBasicInfoToSegment(basicInfo: BasicInfo, segment?: { name: string; description?: string }): BasicInfo {
  if (!segment) return basicInfo
  return { ...basicInfo, target_segments: [segment] }
}

// 旧単一セッション（demographics/goals 単体）→ personas[] へ正規化（後方互換）。
export function normalizePersonas(sd: any): Persona[] {
  if (Array.isArray(sd?.personas) && sd.personas.length > 0) {
    return sd.personas.map((p: any) => ({
      demographics: { ...EMPTY_DEMOGRAPHICS, ...(p?.demographics || {}) },
      goals: { ...EMPTY_GOALS, ...(p?.goals || {}) },
    }))
  }
  // 旧形式: 単一 demographics/goals があれば1ペルソナへ
  if (sd?.demographics || sd?.goals) {
    return [{
      demographics: { ...EMPTY_DEMOGRAPHICS, ...(sd.demographics || {}) },
      goals: { ...EMPTY_GOALS, ...(sd.goals || {}) },
    }]
  }
  return []
}
