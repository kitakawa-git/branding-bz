// Googleフォーム取り込みの回帰テスト（決定論・期待値固定）。
// 実行: npx tsx lib/brand-score/import-google-form.test.ts
//
// ラベル一覧は実データ（リィツメディカル ブランドスコア調査・243件回答）から
// 抽出した全64種。変換ルールを変えたらこのテストが壊れることを期待している。
import assert from 'node:assert/strict'
import {
  labelToScore,
  parseQuestionHeader,
  categoryForIndex,
  parseGoogleFormRows,
} from './import-google-form'

// ────────────────────────────────────────────
// 1. labelToScore: 実データ64ラベルの全網羅
// ────────────────────────────────────────────

const LABELS_1: string[] = [
  '全くそう思わない', '全くそう感じない', '全くない', '全く伝えられない',
  '全く明確ではない', '全く理解していない', '全く紹介できない',
  '全く落とし込まれていない', '全く覚えない', '全く認識していない', '全く説明できない',
]

const LABELS_2: string[] = [
  'あまりそう思わない', 'あまりそう感じない', 'あまりない', 'あまり伝えられない',
  'あまり共感していない', 'あまり共有されていない', 'あまり取り入れていない',
  'あまり意識していない', 'あまり持っていない', 'あまり明確ではない',
  'あまり理解していない', 'あまり納得していない', 'あまり紹介できない',
  'あまり落とし込まれていない', 'あまり覚えない', 'あまり認識していない', 'あまり説明できない',
]

const LABELS_3: string[] = ['どちらとも言えない']

const LABELS_4: string[] = [
  'ある', 'そう思う', 'そう感じる', ' 伝えられる', '共感している', '共有されている',
  '取り入れている', '少し説明できる', '意識している', '持っている', '明確である',
  '理解している', '納得している', '紹介できる', '落とし込まれている', '覚える', '認識している',
]

const LABELS_5: string[] = [
  'とても明確である', '十分にある', '十分に共有されている', '十分に落とし込まれている',
  '完璧に伝えられる', '完璧に説明できる', '強くそう思う', '強くそう感じる',
  '強く伝えられる', '強く共感している', '強く意識している', '強く持っている',
  '強く理解している', '強く納得している', '強く紹介できる', '強く覚える',
  '強く認識している', '積極的に取り入れている',
]

for (const [expected, labels] of [
  [1, LABELS_1], [2, LABELS_2], [3, LABELS_3], [4, LABELS_4], [5, LABELS_5],
] as const) {
  for (const l of labels) {
    assert.equal(labelToScore(l), expected, `"${l}" は ${expected} 点であるべき`)
  }
}

const totalLabels =
  LABELS_1.length + LABELS_2.length + LABELS_3.length + LABELS_4.length + LABELS_5.length
assert.equal(totalLabels, 64, '実データのラベル種類は64種')

// 数値・空欄・異常値
assert.equal(labelToScore(3), 3, '数値はそのまま採用')
assert.equal(labelToScore('5'), 5, '数値文字列も採用')
assert.equal(labelToScore(0), null, '範囲外の数値は null')
assert.equal(labelToScore(6), null, '範囲外の数値は null')
assert.equal(labelToScore(2.5), null, '非整数は null')
assert.equal(labelToScore(''), null, '空文字は null')
assert.equal(labelToScore('   '), null, '空白のみは null')
assert.equal(labelToScore(null), null, 'null は null')
assert.equal(labelToScore(undefined), null, 'undefined は null')

// 「全く」「あまり」は「強く」より優先される（接頭辞の評価順の固定）
assert.equal(labelToScore('全く強く感じない'), 1, '「全く」が最優先')

// ────────────────────────────────────────────
// 2. parseQuestionHeader
// ────────────────────────────────────────────

assert.deepEqual(
  parseQuestionHeader('1.会社のミッションを自分の言葉で説明できるか。'),
  { sortOrder: 1, text: '会社のミッションを自分の言葉で説明できるか。' }
)
assert.deepEqual(
  parseQuestionHeader('30.1年前と比べてブランドが社内に浸透してきたと感じるか。'),
  { sortOrder: 30, text: '1年前と比べてブランドが社内に浸透してきたと感じるか。' }
)
// 全角ピリオド・Qプレフィックス・コロン
assert.deepEqual(parseQuestionHeader('12．設問文'), { sortOrder: 12, text: '設問文' })
assert.deepEqual(parseQuestionHeader('Q7: 設問文'), { sortOrder: 7, text: '設問文' })
// 番号なし
assert.deepEqual(
  parseQuestionHeader('会社の理念に誇りを持っているか。'),
  { sortOrder: null, text: '会社の理念に誇りを持っているか。' }
)
// 番号のみで本文が無い場合は番号扱いしない（設問文が "5" のケースを壊さない）
assert.deepEqual(parseQuestionHeader('5'), { sortOrder: null, text: '5' })

// ────────────────────────────────────────────
// 3. categoryForIndex: 30問は 10/10/10
// ────────────────────────────────────────────

const cats30 = Array.from({ length: 30 }, (_, i) => categoryForIndex(i, 30))
assert.equal(cats30.filter((c) => c === 'why').length, 10, 'WHY は 10 問')
assert.equal(cats30.filter((c) => c === 'how').length, 10, 'HOW は 10 問')
assert.equal(cats30.filter((c) => c === 'what').length, 10, 'WHAT は 10 問')
assert.equal(cats30[0], 'why')
assert.equal(cats30[9], 'why')
assert.equal(cats30[10], 'how')
assert.equal(cats30[19], 'how')
assert.equal(cats30[20], 'what')
assert.equal(cats30[29], 'what')

// 30問でない場合も3ブロックに分かれる
const cats9 = Array.from({ length: 9 }, (_, i) => categoryForIndex(i, 9))
assert.deepEqual(cats9, ['why', 'why', 'why', 'how', 'how', 'how', 'what', 'what', 'what'])

// ────────────────────────────────────────────
// 4. parseGoogleFormRows: 実ファイルと同じ形の最小シート
// ────────────────────────────────────────────

const sheet: unknown[][] = [
  ['タイムスタンプ', '1.ミッションを説明できるか。', '2.ビジョンに共感しているか。', '3.そう感じるか。'],
  [new Date('2026-07-06T05:02:43.711Z'), '少し説明できる', '強く共感している', 'あまりそう感じない'],
  [new Date('2026-07-06T05:14:32.112Z'), '全く説明できない', 'どちらとも言えない', 'そう感じる'],
]

const parsed = parseGoogleFormRows(sheet)

assert.equal(parsed.stats.questionCount, 3)
assert.equal(parsed.stats.respondentCount, 2)
assert.equal(parsed.stats.blankCells, 0)
assert.deepEqual(parsed.unmappedLabels, [], '未変換ラベルは無い')

assert.deepEqual(parsed.questions, [
  { sortOrder: 1, category: 'why', questionText: 'ミッションを説明できるか。' },
  { sortOrder: 2, category: 'how', questionText: 'ビジョンに共感しているか。' },
  { sortOrder: 3, category: 'what', questionText: 'そう感じるか。' },
])

assert.deepEqual(parsed.respondents[0].scores, [4, 5, 2])
assert.deepEqual(parsed.respondents[1].scores, [1, 3, 4])
assert.equal(parsed.respondents[0].submittedAt, '2026-07-06T05:02:43.711Z')

// タイムスタンプ列が無いシート
const noTs = parseGoogleFormRows([
  ['1.設問A', '2.設問B'],
  ['そう思う', '全くそう思わない'],
])
assert.equal(noTs.stats.questionCount, 2)
assert.equal(noTs.respondents[0].submittedAt, null)
assert.deepEqual(noTs.respondents[0].scores, [4, 1])

// 空欄・未変換ラベルの扱い
const withGaps = parseGoogleFormRows([
  ['タイムスタンプ', '1.設問A', '2.設問B'],
  ['2026-07-06T05:02:43Z', '', 'よくわからん語彙'],
])
assert.equal(withGaps.stats.blankCells, 1, '空欄は blankCells に計上')
assert.deepEqual(withGaps.respondents[0].scores, [null, 4], '未知の肯定形は4点扱い')

// 末尾の空行はスキップされる
const withBlankRow = parseGoogleFormRows([
  ['タイムスタンプ', '1.設問A'],
  ['2026-07-06T05:02:43Z', 'そう思う'],
  [null, null],
  ['', ''],
])
assert.equal(withBlankRow.stats.respondentCount, 1, '空行はスキップ')

// 異常系
assert.throws(() => parseGoogleFormRows([]), /シートが空です/)
assert.throws(() => parseGoogleFormRows([['タイムスタンプ']]), /設問列が見つかりません/)
assert.throws(
  () => parseGoogleFormRows([['タイムスタンプ', '1.設問A']]),
  /回答行が1件もありません/
)

console.log('✓ import-google-form: 全テスト通過')
