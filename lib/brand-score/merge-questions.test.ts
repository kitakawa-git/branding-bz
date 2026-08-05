// merge-questions の単体テスト
// 実行: npx tsx lib/brand-score/merge-questions.test.ts
import assert from 'node:assert/strict'
import { mergeQuestions, buildIndexMap } from './merge-questions'
import type { ParsedImport, SurveyCategory } from './import-google-form'

/** テスト用の ParsedImport を設問文の配列から作る */
function fake(texts: string[], categories?: SurveyCategory[]): ParsedImport {
  return {
    questions: texts.map((questionText, i) => ({
      sortOrder: i + 1,
      category: categories?.[i] ?? 'why',
      questionText,
    })),
    respondents: [],
    unmappedLabels: [],
    stats: { questionCount: texts.length, respondentCount: 0, blankCells: 0 },
  }
}

// ── 単一ファイルはそのまま通る ────────────────────
{
  const merged = mergeQuestions([fake(['Q1', 'Q2', 'Q3'])])
  assert.equal(merged.length, 3)
  assert.deepEqual(merged.map((m) => m.sortOrder), [1, 2, 3])
  assert.deepEqual(merged.map((m) => m.fileIndexes), [[0], [0], [0]])
}

// ── 完全一致の2ファイルは重複しない ──────────────
{
  const merged = mergeQuestions([fake(['Q1', 'Q2']), fake(['Q1', 'Q2'])])
  assert.equal(merged.length, 2)
  assert.deepEqual(merged.map((m) => m.fileIndexes), [[0, 1], [0, 1]])
}

// ── 一部だけ違う設問は末尾に追加される（リィツのSP/BO想定） ──
{
  const sp = fake(['共通1', '共通2', 'SP固有', '共通3', 'SP固有2'])
  const bo = fake(['共通1', '共通2', 'BO固有', '共通3', 'BO固有2'])
  const merged = mergeQuestions([sp, bo])

  assert.equal(merged.length, 7, '共通3 + SP固有2 + BO固有2 = 7問')
  assert.deepEqual(
    merged.map((m) => m.questionText),
    ['共通1', '共通2', 'SP固有', '共通3', 'SP固有2', 'BO固有', 'BO固有2'],
    '1ファイル目の並びを保ち、BO固有が末尾に付く'
  )
  // 共通設問は両ファイルに属する
  assert.deepEqual(merged[0].fileIndexes, [0, 1])
  assert.deepEqual(merged[3].fileIndexes, [0, 1])
  // 固有設問は片方だけ
  assert.deepEqual(merged[2].fileIndexes, [0], 'SP固有はファイル0のみ')
  assert.deepEqual(merged[5].fileIndexes, [1], 'BO固有はファイル1のみ')
  // sortOrder は 1..7 の連番
  assert.deepEqual(merged.map((m) => m.sortOrder), [1, 2, 3, 4, 5, 6, 7])
}

// ── buildIndexMap がファイル内index→マージ後indexを正しく写像する ──
{
  const sp = fake(['共通1', '共通2', 'SP固有', '共通3', 'SP固有2'])
  const bo = fake(['共通1', '共通2', 'BO固有', '共通3', 'BO固有2'])
  const merged = mergeQuestions([sp, bo])

  assert.deepEqual(buildIndexMap(sp, merged), [0, 1, 2, 3, 4], 'SPは先頭5問にそのまま対応')
  assert.deepEqual(
    buildIndexMap(bo, merged),
    [0, 1, 5, 3, 6],
    'BOの3問目→index5、5問目→index6 に飛ぶ（共通設問は同じindexを共有）'
  )
  // 写像は必ずマージ後の範囲に収まる
  for (const idx of [...buildIndexMap(sp, merged), ...buildIndexMap(bo, merged)]) {
    assert.ok(idx >= 0 && idx < merged.length)
  }
}

// ── 設問の並び順がファイル間で違っても対応づけできる ──
{
  const a = fake(['Q1', 'Q2', 'Q3'])
  const b = fake(['Q3', 'Q1', 'Q2'])
  const merged = mergeQuestions([a, b])
  assert.equal(merged.length, 3, '並びが違っても同じ設問は1つにまとまる')
  assert.deepEqual(buildIndexMap(b, merged), [2, 0, 1])
}

// ── 空白・全角空白の違いは同一設問とみなす ──────────
{
  const merged = mergeQuestions([fake(['会社の理念を説明できるか。']), fake(['会社の理念を説明できるか。 '])])
  assert.equal(merged.length, 1, '末尾空白の違いで別設問にしない')
}

// ── カテゴリは最初に登場したファイルの判定を採用する ──
{
  const a = fake(['Q1'], ['what'])
  const b = fake(['Q1'], ['why'])
  const merged = mergeQuestions([a, b])
  assert.equal(merged[0].category, 'what')
}

// ── 3ファイル以上でも動く ────────────────────────
{
  const merged = mergeQuestions([fake(['Q1', 'Q2']), fake(['Q1', 'Q3']), fake(['Q4'])])
  assert.deepEqual(merged.map((m) => m.questionText), ['Q1', 'Q2', 'Q3', 'Q4'])
  assert.deepEqual(merged[0].fileIndexes, [0, 1])
  assert.deepEqual(merged[3].fileIndexes, [2])
}

console.log('✓ merge-questions: 全テスト通過')
