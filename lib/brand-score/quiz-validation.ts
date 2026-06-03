// ブランド理解度テスト 設問のサーバ側バリデーション
// ============================================================
// 手動追加（custom POST）・手動編集（PATCH）・AI生成（generate-questions）の
// 3経路から共通で呼ぶ。正誤判定の根幹である「correct_option_id が
// options[].id に必ず存在すること」をサーバ側で担保する。
//
// enforceTypeShape:
//   - false（手動 custom / PATCH）: 最低限の整合（id 一意・correct 存在・
//     true_false は true/false の2択）のみ。管理者の柔軟な作問を許容。
//   - true（AI生成）: 上記に加え、single_choice は a,b,c,d の4択、
//     true_false は true,false の2択であることを厳格に要求。
//     不整合な生成結果は INSERT せずスキップ報告に回す。
// ============================================================
import type { QuizCategory, QuizOption, QuizQuestionType } from '@/lib/types/brand-quiz'

const QUESTION_TYPES: readonly QuizQuestionType[] = ['single_choice', 'true_false']

// 検証対象（API入力 / AI生成結果いずれも未検証の生データ）
export interface QuizQuestionShape {
  category?: unknown
  question_text?: unknown
  question_type?: unknown
  options?: unknown
  correct_option_id?: unknown
}

export type QuizValidationResult =
  | {
      ok: true
      category: QuizCategory
      question_text: string
      question_type: QuizQuestionType
      options: QuizOption[]
      correct_option_id: string
    }
  | { ok: false; error: string }

export function validateQuizQuestion(
  input: QuizQuestionShape,
  opts: { allowedCategories: readonly QuizCategory[]; enforceTypeShape: boolean }
): QuizValidationResult {
  const { allowedCategories, enforceTypeShape } = opts

  // category
  if (
    typeof input.category !== 'string' ||
    !allowedCategories.includes(input.category as QuizCategory)
  ) {
    return {
      ok: false,
      error: `category は ${allowedCategories.join(' / ')} のいずれかである必要があります`,
    }
  }
  const category = input.category as QuizCategory

  // question_text
  if (typeof input.question_text !== 'string' || input.question_text.trim() === '') {
    return { ok: false, error: 'question_text は必須です' }
  }
  const question_text = input.question_text

  // question_type
  if (
    typeof input.question_type !== 'string' ||
    !QUESTION_TYPES.includes(input.question_type as QuizQuestionType)
  ) {
    return {
      ok: false,
      error: 'question_type は single_choice か true_false である必要があります',
    }
  }
  const question_type = input.question_type as QuizQuestionType

  // options（{ id, text } の配列）
  if (!Array.isArray(input.options)) {
    return { ok: false, error: 'options は配列である必要があります' }
  }
  const options: QuizOption[] = []
  for (const raw of input.options) {
    if (!raw || typeof raw !== 'object') {
      return { ok: false, error: 'options の各要素は { id, text } である必要があります' }
    }
    const o = raw as Record<string, unknown>
    if (typeof o.id !== 'string' || o.id.trim() === '' || typeof o.text !== 'string') {
      return { ok: false, error: 'options の各要素は文字列の id と text を持つ必要があります' }
    }
    options.push({ id: o.id, text: o.text })
  }
  const ids = options.map((o) => o.id)
  if (options.length < 2) {
    return { ok: false, error: 'options は2つ以上必要です' }
  }
  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: 'options の id が重複しています' }
  }

  // correct_option_id は必ず options[].id のいずれか
  if (typeof input.correct_option_id !== 'string' || !ids.includes(input.correct_option_id)) {
    return {
      ok: false,
      error: 'correct_option_id は options の id のいずれかである必要があります',
    }
  }
  const correct_option_id = input.correct_option_id

  // 型ごとの選択肢形状
  if (question_type === 'true_false') {
    // ◯× は手動・AI問わず id が true/false の2択であることを担保
    if (options.length !== 2 || !['true', 'false'].every((e) => ids.includes(e))) {
      return {
        ok: false,
        error: 'true_false の options は id が true,false の2つである必要があります',
      }
    }
  } else if (enforceTypeShape) {
    // single_choice（AI生成時のみ厳格化）: a,b,c,d の4択
    if (options.length !== 4 || !['a', 'b', 'c', 'd'].every((e) => ids.includes(e))) {
      return {
        ok: false,
        error: 'single_choice の options は id が a,b,c,d の4つである必要があります',
      }
    }
  }

  return { ok: true, category, question_text, question_type, options, correct_option_id }
}
