// ブランド理解度テスト（記名式）の型定義
// サーベイ（匿名・自己申告）とは別物。正誤のある設問で社員の「知識」を測る。
// 専用4テーブル（brand_quizzes / brand_quiz_questions / brand_quiz_attempts /
// brand_quiz_answers）に1対1で対応する。

export type QuizStatus = 'draft' | 'active' | 'closed' | 'archived';
export type QuizCategory = 'why' | 'how' | 'what';
export type QuizQuestionType = 'single_choice' | 'true_false';
export type QuizQuestionSource = 'template' | 'ai_generated' | 'custom';
export type RoleCategory = 'executive' | 'manager' | 'staff';

export interface QuizOption {
  id: string;        // 'a' | 'b' | 'c' | 'd' 等。◯×は 'true' | 'false'
  text: string;
}

export interface BrandQuiz {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  status: QuizStatus;
  starts_at: string | null;
  ends_at: string | null;
  total_members: number | null;
  pass_threshold: number;
  randomize_questions: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandQuizQuestion {
  id: string;
  quiz_id: string;
  category: QuizCategory;
  question_text: string;
  question_type: QuizQuestionType;
  options: QuizOption[];
  correct_option_id: string;
  explanation: string | null;
  source: QuizQuestionSource;
  sort_order: number;
  is_active: boolean;
  reference_data: Record<string, unknown> | null;
  created_at: string;
}

export interface BrandQuizAttempt {
  id: string;
  quiz_id: string;
  profile_id: string;
  company_id: string;
  department: string | null;
  role_category: RoleCategory | null;
  score: number | null;
  why_score: number | null;
  how_score: number | null;
  what_score: number | null;
  total_questions: number | null;
  correct_count: number | null;
  passed: boolean | null;
  started_at: string | null;
  submitted_at: string | null;
  created_at: string;
}

export interface BrandQuizAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option_id: string | null;
  is_correct: boolean;
  created_at: string;
}
