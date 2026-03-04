// ブランドカラー定義ツール — 型定義

// ============================================
// カラー値
// ============================================

export interface ColorValue {
  hex: string       // "#1A73E8"
  rgb: { r: number; g: number; b: number }
  name: string      // 日本語の色名："深い青"
}

// ============================================
// パレット提案
// ============================================

export interface PaletteProposal {
  id: string                     // "proposal_1" etc
  name: string                   // 例："信頼のディープブルー"
  concept: string                // 50文字以内のコンセプト説明
  primary: ColorValue
  secondary: ColorValue[]        // 1〜2色
  accent: ColorValue
  neutrals: {
    light: ColorValue            // 背景用（明）
    dark: ColorValue             // テキスト用（暗）
  }
  reasoning: string              // 提案理由（3〜4行、150文字程度）
  accessibilityScore: AccessibilityScore
}

export interface AccessibilityScore {
  primaryOnLight: number         // コントラスト比
  primaryOnDark: number
  accentOnLight: number
  passes: boolean                // 全組み合わせがAA基準を満たすか
}

// ============================================
// Step 1: 基本情報
// ============================================

export type BrandStage = 'new' | 'rebrand' | 'refinement'

export interface CompetitorColor {
  name: string
  hex: string
}

export interface BasicInfo {
  brandName: string
  industryCategory: string
  industrySubcategory: string
  brandStage: BrandStage
  existingColors: string[]                // hex[]
  competitorColors: CompetitorColor[]
}

// ============================================
// Step 2: イメージ入力
// ============================================

export type ApproachType = 'keyword' | 'moodboard'

export interface KeywordSelection {
  word: string
  priority: number
}

export interface MoodboardChoice {
  pairId: string
  choice: 'A' | 'B'
}

export interface ImageInput {
  approachType: ApproachType
  keywords: KeywordSelection[]
  moodboardChoices: MoodboardChoice[]
  avoidColors: string[]             // hex[]
  referenceBrands: string[]
}

// ============================================
// API リクエスト/レスポンス
// ============================================

export interface GenerateRequest {
  sessionId: string
  basicInfo: BasicInfo
  imageInput: ImageInput
}

export interface GenerateResponse {
  proposals: PaletteProposal[]     // 必ず3件
}

// ============================================
// セッション / プロジェクト
// ============================================

export type SessionStatus = 'in_progress' | 'completed' | 'abandoned'

export interface MiniAppSession {
  id: string
  user_id: string
  app_type: string
  status: SessionStatus
  current_step: number
  started_at: string
  completed_at: string | null
  company_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface BrandColorProject {
  id: string
  session_id: string
  // Step 1
  brand_name: string | null
  industry_category: string | null
  industry_subcategory: string | null
  brand_stage: BrandStage | null
  existing_colors: { hex: string }[]
  competitor_colors: CompetitorColor[]
  // Step 2
  approach_type: ApproachType | null
  keywords: KeywordSelection[]
  moodboard_choices: MoodboardChoice[]
  avoid_colors: string[]
  reference_brands: string[]
  // Step 3
  proposals: PaletteProposal[]
  selected_proposal_id: string | null
  // Step 4
  current_palette: PaletteProposal | null
  adjustment_count: number
  // Step 5
  final_palette: PaletteProposal | null
  exported_formats: string[]
  linked_to_brandconnect: boolean
  created_at: string
  updated_at: string
}

export interface ConversationMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata: Record<string, unknown>
  created_at: string
}

// ============================================
// 業種リスト
// ============================================

export interface IndustryCategory {
  value: string
  label: string
  subcategories: string[]
}

export const INDUSTRY_CATEGORIES: IndustryCategory[] = [
  { value: 'it_tech', label: 'IT・テクノロジー', subcategories: [
    'SaaS', 'EC', 'フィンテック', 'AI・ロボティクス', 'Web制作・開発', 'その他',
  ]},
  { value: 'manufacturing', label: '製造業', subcategories: [
    '食品', '化学・素材', '機械・電機', '自動車', 'その他',
  ]},
  { value: 'service', label: 'サービス業', subcategories: [
    '飲食', '宿泊・観光', '教育', '美容・健康', 'コンサルティング', 'その他',
  ]},
  { value: 'retail', label: '小売・流通', subcategories: [
    'アパレル', '食品', '家電・雑貨', 'EC専業', 'その他',
  ]},
  { value: 'medical', label: '医療・ヘルスケア', subcategories: [
    '病院・クリニック', '医療機器', '製薬', '介護・福祉', 'その他',
  ]},
  { value: 'finance', label: '金融・保険', subcategories: [
    '銀行', '証券', '保険', '不動産', 'その他',
  ]},
  { value: 'creative', label: 'クリエイティブ', subcategories: [
    'デザイン', '広告', 'メディア', 'エンタメ', 'その他',
  ]},
  { value: 'construction', label: '建設・不動産', subcategories: [
    '建設', '不動産', '建築設計', 'インテリア', 'その他',
  ]},
  { value: 'other', label: 'その他', subcategories: [
    'NPO・公益法人', '行政', '農林水産', '物流', 'その他',
  ]},
] as const

// ============================================
// ブランドキーワード
// ============================================

export const BRAND_KEYWORDS = {
  trust: ['信頼', '安心', '誠実', '堅実', '安定'],
  innovation: ['革新', '先進', '挑戦', '未来', 'テクノロジー'],
  warmth: ['温かさ', '親しみ', 'やさしさ', 'ぬくもり', '共感'],
  sophistication: ['洗練', '上質', '高級', 'エレガント', '品格'],
  energy: ['活力', '情熱', '力強さ', '躍動', '成長'],
  playfulness: ['遊び心', '自由', 'クリエイティブ', '楽しさ', 'ユニーク'],
} as const

export type KeywordCategory = keyof typeof BRAND_KEYWORDS

export const KEYWORD_CATEGORY_LABELS: Record<KeywordCategory, string> = {
  trust: '信頼・安心',
  innovation: '革新・先進',
  warmth: '温かさ・親しみ',
  sophistication: '洗練・上質',
  energy: '活力・情熱',
  playfulness: '遊び心・自由',
}

// ============================================
// ムードボードペア
// ============================================

export interface MoodboardPairOption {
  label: string
  colors: [string, string]   // グラデーション用2色
  description: string
}

export interface MoodboardPairDef {
  id: string
  axis: string
  optionA: MoodboardPairOption
  optionB: MoodboardPairOption
}

export const MOODBOARD_PAIRS: MoodboardPairDef[] = [
  {
    id: 'pair_1',
    axis: 'innovative_traditional',
    optionA: { label: '革新的', colors: ['#6C63FF', '#00D2FF'], description: '最先端を切り拓く' },
    optionB: { label: '伝統的', colors: ['#8B4513', '#DAA520'], description: '積み重ねた信頼' },
  },
  {
    id: 'pair_2',
    axis: 'warm_cool',
    optionA: { label: '温かい', colors: ['#FF6B6B', '#FFA07A'], description: '人のぬくもり' },
    optionB: { label: 'クール', colors: ['#2C3E50', '#4CA1AF'], description: '洗練された知性' },
  },
  {
    id: 'pair_3',
    axis: 'bold_subtle',
    optionA: { label: '力強い', colors: ['#E74C3C', '#F39C12'], description: '大胆なインパクト' },
    optionB: { label: '繊細', colors: ['#D4AFC1', '#C9D6DF'], description: '丁寧な美しさ' },
  },
  {
    id: 'pair_4',
    axis: 'playful_serious',
    optionA: { label: '遊び心', colors: ['#FF6FD8', '#3813C2'], description: 'ワクワクする体験' },
    optionB: { label: '真剣', colors: ['#1A1A2E', '#16213E'], description: 'プロフェッショナル' },
  },
  {
    id: 'pair_5',
    axis: 'natural_urban',
    optionA: { label: 'ナチュラル', colors: ['#56AB2F', '#A8E6CF'], description: '自然との調和' },
    optionB: { label: 'アーバン', colors: ['#414345', '#232526'], description: '都会的な洗練' },
  },
  {
    id: 'pair_6',
    axis: 'luxury_accessible',
    optionA: { label: 'ラグジュアリー', colors: ['#B8860B', '#1A1A1A'], description: '特別な価値' },
    optionB: { label: '親しみやすい', colors: ['#4ECDC4', '#F7FFF7'], description: '誰でもウェルカム' },
  },
  {
    id: 'pair_7',
    axis: 'minimal_decorative',
    optionA: { label: 'ミニマル', colors: ['#FAFAFA', '#333333'], description: '削ぎ落とした美' },
    optionB: { label: '装飾的', colors: ['#FF8C94', '#FFD700'], description: '豊かな彩り' },
  },
  {
    id: 'pair_8',
    axis: 'dynamic_calm',
    optionA: { label: 'ダイナミック', colors: ['#F7971E', '#FFD200'], description: '勢いとスピード' },
    optionB: { label: '穏やか', colors: ['#667eea', '#764ba2'], description: '落ち着いた安心感' },
  },
  {
    id: 'pair_9',
    axis: 'masculine_feminine',
    optionA: { label: 'マスキュリン', colors: ['#2C3E50', '#34495E'], description: '力強く堅実' },
    optionB: { label: 'フェミニン', colors: ['#FCCDE2', '#A855F7'], description: 'しなやかで華やか' },
  },
]

// ============================================
// フリーミアム制限
// ============================================

export const FREE_LIMITS = {
  monthlyGenerations: 3,       // 月間パレット生成回数
  proposalsPerGeneration: 3,   // 1回あたりの提案数
  chatTurnsPerSession: 5,      // セッションあたりのチャット回数
  pdfWatermark: true,          // PDF透かし
  cmykValues: false,           // CMYK値表示
  designTokens: false,         // デザイントークンJSON出力
} as const
