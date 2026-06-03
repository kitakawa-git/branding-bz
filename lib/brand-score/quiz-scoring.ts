// ブランド理解度テスト 採点・集計の共通ロジック
// ============================================================
// 受験採点（attempt）と管理者集計（results）の双方から再利用する純関数群。
// 採点方針: 単純正答率。全体 score = correct/total×100、カテゴリ別も同様。
//           加重平均は使わない。
// ============================================================
import type { QuizCategory } from '@/lib/types/brand-quiz'

// k匿名のしきい値。部署・役職グループの母数がこれ未満なら集計を抑制する。
export const K_ANONYMITY_THRESHOLD = 3

// 正答率(%) を小数1桁で返す。母数0以下なら null（カテゴリ0問など）。
export function ratePercent(correct: number, total: number): number | null {
  if (total <= 0) return null
  return Math.round((correct / total) * 1000) / 10
}

// null/undefined を除いた平均を小数1桁で返す。対象が無ければ null。
export function meanScore(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number')
  if (nums.length === 0) return null
  const sum = nums.reduce((a, b) => a + b, 0)
  return Math.round((sum / nums.length) * 10) / 10
}

// 採点に必要な設問の最小形（クイズの有効設問）
export interface ScoringQuestion {
  id: string
  category: QuizCategory
  correct_option_id: string
}

// 受験者が送る回答の最小形
export interface SubmittedAnswer {
  question_id: string
  selected_option_id: string | null
}

// 採点後の設問別結果（brand_quiz_answers へ保存する単位）
export interface GradedAnswer {
  question_id: string
  category: QuizCategory
  selected_option_id: string | null
  is_correct: boolean
}

// 1受験ぶんの採点結果
export interface AttemptScore {
  graded: GradedAnswer[]
  total_questions: number
  correct_count: number
  score: number // 全体正答率（有効設問が1問以上ある前提で常に数値）
  why_score: number | null
  how_score: number | null
  what_score: number | null
}

// クイズの「有効設問」を母数として採点する。
// ・total_questions = 有効設問数（受験者が回答を省いても母数は減らない）
// ・未回答（選択肢なし）や誤答は不正解として扱う
// ・カテゴリ別はそのカテゴリの設問が0問なら null
export function gradeAttempt(
  questions: ScoringQuestion[],
  answers: SubmittedAnswer[]
): AttemptScore {
  const selectedByQuestion = new Map<string, string | null>()
  for (const a of answers) {
    selectedByQuestion.set(a.question_id, a.selected_option_id ?? null)
  }

  const graded: GradedAnswer[] = questions.map((q) => {
    const selected = selectedByQuestion.has(q.id)
      ? (selectedByQuestion.get(q.id) ?? null)
      : null
    return {
      question_id: q.id,
      category: q.category,
      selected_option_id: selected,
      is_correct: selected !== null && selected === q.correct_option_id,
    }
  })

  const total_questions = questions.length
  const correct_count = graded.filter((g) => g.is_correct).length
  const score = ratePercent(correct_count, total_questions) ?? 0

  const categoryRate = (cat: QuizCategory): number | null => {
    const inCat = graded.filter((g) => g.category === cat)
    if (inCat.length === 0) return null
    return ratePercent(inCat.filter((g) => g.is_correct).length, inCat.length)
  }

  return {
    graded,
    total_questions,
    correct_count,
    score,
    why_score: categoryRate('why'),
    how_score: categoryRate('how'),
    what_score: categoryRate('what'),
  }
}
