// ペルソナビルダー マルチペルソナ 共通型・定数（Step2/Step3/Step5/page で共有）
/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Demographics {
  persona_name: string
  age: number | string
  gender: string
  occupation: string
  description: string // このペルソナ（セグメント）の状況を1〜2文で。connect で brand_personas.description へ
  company_role: string
  company_size: string
  media_channels: string[]
  personality_traits: string[]
  avatar_emoji?: string // 任意：顔アイコン（絵文字）。確認画面のアバター表示に使用
}

// 顔アイコン候補（手動選択）。管理画面と共有するため lib に集約（再エクスポート）
export { AVATAR_EMOJIS } from '@/lib/persona/avatars'

export interface GoalsData {
  primary_goals: string[]
  pain_points: string[]
  buying_motivation: string
  buying_barriers: string[]
  decision_factors: string[]
  brand_expectations: string
}

// カスタマージャーニー（ペルソナごとに保持。タッチポイント候補の抽出元）
export interface JourneyStage {
  name: string
  description: string
  actions: string[]
  touchpoints: string[] // タッチポイントの実体（具体的接点・施策の適用先）
  emotions: string
  emotion_score: number // -2 〜 2
  pain_points: string[]
  opportunities: string[]
}
export interface JourneyMap { stages: JourneyStage[] }

// マルチの正：1ペルソナ（target_name でターゲットにグルーピング）
export interface Persona {
  target_name: string // 属するターゲットセグメント名（target_segments[i].name）。未分類は ''
  demographics: Demographics
  goals: GoalsData
  journey_map?: JourneyMap // ペルソナごとのジャーニー（任意）
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
  persona_name: '', age: '', gender: '', occupation: '', description: '', company_role: '',
  company_size: '',
  media_channels: [], personality_traits: [], avatar_emoji: '',
}

export const EMPTY_GOALS: GoalsData = {
  primary_goals: [], pain_points: [],
  buying_motivation: '', buying_barriers: [], decision_factors: [],
  brand_expectations: '',
}

export const emptyPersona = (target_name = ''): Persona => ({
  target_name,
  demographics: { ...EMPTY_DEMOGRAPHICS },
  goals: { ...EMPTY_GOALS },
  journey_map: { stages: [] },
})

// basic_info を「特定の1ターゲットだけ」に絞って AI に渡す（各ペルソナを1セグメントで生成するため）。
export function narrowBasicInfoToSegment(basicInfo: BasicInfo, segment?: { name: string; description?: string }): BasicInfo {
  if (!segment) return basicInfo
  return { ...basicInfo, target_segments: [segment] }
}

// 後方互換: 旧 goals.challenges（課題・悩み）を pain_points（課題・ペインポイント）へ統合。
// pain_points が空なら challenges を採用、両方あれば結合して重複除去。型から challenges を消してもデータが落ちない。
function normalizeGoals(raw: any): GoalsData {
  const g = { ...EMPTY_GOALS, ...(raw || {}) } as GoalsData & { challenges?: string[] }
  const challenges = Array.isArray(raw?.challenges) ? raw.challenges.filter((c: unknown): c is string => typeof c === 'string') : []
  if (challenges.length) {
    g.pain_points = g.pain_points?.length
      ? Array.from(new Set([...g.pain_points, ...challenges]))
      : challenges
  }
  delete g.challenges
  return g
}

// 旧単一セッション（demographics/goals 単体）→ personas[] へ正規化（後方互換）。
// target_name 欠落のペルソナには、配列インデックス対応の target_segments[i]?.name を割当て。
export function normalizePersonas(sd: any, segments?: Array<{ name?: string }>): Persona[] {
  const segName = (i: number) => (segments?.[i]?.name || '').trim()
  const journeyOf = (p: any): JourneyMap | undefined =>
    p?.journey_map?.stages?.length ? { stages: p.journey_map.stages } : undefined
  let personas: Persona[]
  if (Array.isArray(sd?.personas) && sd.personas.length > 0) {
    personas = sd.personas.map((p: any, i: number) => ({
      target_name: typeof p?.target_name === 'string' && p.target_name ? p.target_name : segName(i),
      demographics: { ...EMPTY_DEMOGRAPHICS, ...(p?.demographics || {}) },
      goals: normalizeGoals(p?.goals),
      journey_map: journeyOf(p),
    }))
  } else if (sd?.demographics || sd?.goals) {
    // 旧形式: 単一 demographics/goals があれば1ペルソナへ（第1セグメントに割当て）
    personas = [{
      target_name: segName(0),
      demographics: { ...EMPTY_DEMOGRAPHICS, ...(sd.demographics || {}) },
      goals: normalizeGoals(sd.goals),
      journey_map: undefined,
    }]
  } else {
    personas = []
  }
  // 後方互換: 旧・単一 sd.journey_map があり personas[0] にジャーニーが無ければ移送
  if (sd?.journey_map?.stages?.length && personas[0] && !personas[0].journey_map?.stages?.length) {
    personas[0] = { ...personas[0], journey_map: { stages: sd.journey_map.stages } }
  }
  return personas
}
