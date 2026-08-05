// GT集計表パーサの単体テスト
// 実行: npx tsx lib/brand-score/import-gt-table.test.ts
//
// フィクスチャは実ファイル（電通マクロミルインサイト／眼科医220名・2025年）の
// 該当行をそのまま写したもの。実ファイルはリポジトリに含められないため、
// 検証済みの行配列をここに固定している。
import assert from 'node:assert/strict'
import {
  parseGtTable,
  splitBlocks,
  splitQuestionCode,
  guessIsAttribute,
  pickGtSheet,
} from './import-gt-table'

// ────────────────────────────────────────────
// フィクスチャ（実データから抽出）
// ────────────────────────────────────────────

/** PTable0011 第1想起（単一回答・非マトリクス）／シート %表 167-175行 */
const FIX_RECALL: unknown[][] = [
  [null, 'PTable0011'],
  [null, 'q1_ac 「眼科の医療機器の販売・メンテナンスを行う企業」と聞いて思い浮かべる企業名を、思い出した順にお知らせください。 \n【第1想起】'],
  [],
  [null, null, '単一回答', null, '％'],
  [null, null, '全体', null, 220],
  [null, 1, 'リッツメディカル', null, 16.8181818181818],
  [null, 2, 'はんだや', null, 0],
  [null, 3, 'ユニハイト', null, 0.909090909090909],
  [null, 4, 'ジャメックス', null, 1.36363636363636],
]

/** PTable0015 認知（単一回答マトリクス）／シート %表 315-330行 */
const FIX_AWARENESS: unknown[][] = [
  [null, 'PTable0015'],
  [null, 'q3 以下に挙げる「眼科医にサービスを提供する企業」についてどの程度ご存じですか。それぞれについて当てはまるものをお知らせください。'],
  [],
  [null, null, '単一回答マトリクス', null, null, 1, 2, 3],
  [null, null, null, null, '全体', '確かに知っている', '名前を聞いたことがある程度', '知らない', '認知・計'],
  [],
  [null, 1, 'リィツメディカル', null, 220, 56.8181818181818, 20.4545454545455, 22.7272727272727, 77.2727272727273],
  [null, 2, 'はんだや', null, 220, 53.6363636363636, 31.3636363636364, 15, 85],
  [null, 3, 'ユニハイト', null, 220, 6.36363636363636, 9.54545454545454, 84.0909090909091, 15.9090909090909],
]

/** PTable0020 導入状況（マトリクス・行ごとにベースNが違う）／%表 389-396行 */
const FIX_USAGE: unknown[][] = [
  [null, 'PTable0020'],
  [null, 'q4 以下に挙げる「眼科医にサービスを提供する企業」について、あなたの勤務先での導入・購入の状況として、あてはまるものをお知らせください。'],
  [],
  [null, null, '単一回答マトリクス', null, null, 1, 2, 3, 4],
  [null, null, null, null, '全体', '現在、導入・購入している', '過去に、導入・購入していた（現在はしていない）', '現在も過去も、導入・購入はしていない', 'まったくわからない', '導入・購入経験あり・計'],
  [],
  [null, 1, 'リィツメディカル', null, 170, 47.0588235294118, 23.5294117647059, 20, 9.41176470588235, 70.5882352941177],
  [null, 2, 'はんだや', null, 187, 25.668449197861, 28.3422459893048, 32.0855614973262, 13.903743315508, 54.0106951871658],
]

/** PTable0016 認知T2B（複数回答・無回答行あり）／%表 332-348行 */
const FIX_T2B: unknown[][] = [
  [null, 'PTable0016'],
  [null, 'Nq3_T2B 以下に挙げる「眼科医にサービスを提供する企業」についてどの程度ご存じですか。 \n【認知（TOP2）・計一覧】'],
  [],
  [null, null, '複数回答', null, '％'],
  [null, null, '全体', null, 220],
  [null, 1, 'リィツメディカル', null, 77.2727272727273],
  [null, 2, 'はんだや', null, 85],
  [null, null, '無回答', null, 4.54545454545455],
]

function concat(...blocks: unknown[][][]): unknown[][] {
  return blocks.flat()
}

// ────────────────────────────────────────────
// 1. 非マトリクス（第1想起）
// ────────────────────────────────────────────
{
  const { blocks } = parseGtTable('%表', FIX_RECALL)
  assert.equal(blocks.length, 1)
  const b = blocks[0]

  assert.equal(b.blockKey, 'PTable0011')
  assert.equal(b.questionCode, 'q1_ac')
  assert.ok(b.questionText.startsWith('「眼科の医療機器の販売'))
  assert.equal(b.answerType, 'single')
  assert.equal(b.blockBaseN, 220)
  assert.equal(b.columns, null)
  assert.equal(b.cells.length, 4)

  const ritz = b.cells[0]
  assert.equal(ritz.rowLabel, 'リッツメディカル')
  assert.equal(ritz.rowCode, '1')
  assert.equal(ritz.colCode, null)
  assert.ok(Math.abs((ritz.value ?? 0) - 16.8181818181818) < 1e-9, '第1想起 16.8%')
  assert.equal(ritz.baseN, 220)
  assert.equal(ritz.kind, 'option')
  // レポートの「第1想起16.8%」と一致する
  assert.equal(Math.round((ritz.value ?? 0) * 10) / 10, 16.8)

  assert.equal(b.warnings.length, 0)
}

// ────────────────────────────────────────────
// 2. マトリクス（認知）— 行×列に展開されること
// ────────────────────────────────────────────
{
  const { blocks } = parseGtTable('%表', FIX_AWARENESS)
  const b = blocks[0]

  assert.equal(b.questionCode, 'q3')
  assert.equal(b.answerType, 'single_matrix')
  assert.equal(b.columns?.length, 4, '3選択肢 + NET列（認知・計）')
  assert.deepEqual(
    b.columns?.map((c) => c.label),
    ['確かに知っている', '名前を聞いたことがある程度', '知らない', '認知・計']
  )
  // NET列は回答形式行にコードが無い
  assert.equal(b.columns?.[3].code, null)
  assert.equal(b.columns?.[0].code, '1')

  // 3社 × 4列 = 12セル
  assert.equal(b.cells.length, 12)

  const awareness = b.cells.find(
    (c) => c.rowLabel === 'リィツメディカル' && c.colLabel === '認知・計'
  )
  assert.ok(awareness, 'リィツ × 認知・計 のセルがある')
  // レポートの「基本認知度77.3%」と一致する
  assert.equal(Math.round((awareness!.value ?? 0) * 10) / 10, 77.3)
  assert.equal(awareness!.baseN, 220)

  // 競合が同じ列に並ぶ（相対比較の材料になる）
  const handaya = b.cells.find(
    (c) => c.rowLabel === 'はんだや' && c.colLabel === '認知・計'
  )
  assert.equal(handaya?.value, 85)

  assert.equal(b.blockBaseN, 220, '全行同じNならブロック共通Nとして持てる')
  assert.equal(b.warnings.length, 0)
}

// ────────────────────────────────────────────
// 3. 行ごとにベースNが違うマトリクス
// ────────────────────────────────────────────
{
  const { blocks } = parseGtTable('%表', FIX_USAGE)
  const b = blocks[0]

  const ritz = b.cells.find(
    (c) => c.rowLabel === 'リィツメディカル' && c.colLabel === '導入・購入経験あり・計'
  )
  const handaya = b.cells.find(
    (c) => c.rowLabel === 'はんだや' && c.colLabel === '導入・購入経験あり・計'
  )

  assert.equal(ritz?.baseN, 170, 'リィツ行は認知者ベース170')
  assert.equal(handaya?.baseN, 187, 'はんだや行は187')
  assert.equal(Math.round((ritz?.value ?? 0) * 10) / 10, 70.6)

  // 行ごとに違うのでブロック共通Nは持てない
  assert.equal(b.blockBaseN, null, 'Nが揃わないブロックでは blockBaseN は null')
}

// ────────────────────────────────────────────
// 4. NET行・無回答行を捨てないこと
// ────────────────────────────────────────────
{
  const { blocks } = parseGtTable('%表', FIX_T2B)
  const b = blocks[0]

  assert.equal(b.questionCode, 'Nq3_T2B', '集計済みバリアントも1ブロックとして残る')
  assert.equal(b.cells.length, 3)

  const noAnswer = b.cells.find((c) => c.rowLabel === '無回答')
  assert.ok(noAnswer, '無回答行が残っている')
  assert.equal(noAnswer!.kind, 'no_answer')
  assert.equal(noAnswer!.rowCode, null)

  const ritz = b.cells.find((c) => c.rowLabel === 'リィツメディカル')
  assert.equal(ritz?.kind, 'option')
}

// ────────────────────────────────────────────
// 5. 集計済みバリアントと原設問が併存しても両方残ること
// ────────────────────────────────────────────
{
  const { blocks } = parseGtTable('%表', concat(FIX_AWARENESS, FIX_T2B))
  assert.equal(blocks.length, 2, '自動で重複排除しない')
  assert.deepEqual(
    blocks.map((b) => b.questionCode),
    ['q3', 'Nq3_T2B']
  )
  assert.deepEqual(
    blocks.map((b) => b.blockIndex),
    [0, 1]
  )
}

// ────────────────────────────────────────────
// 6. 数値に変換できない値は null にして error を積む（0 にしない）
// ────────────────────────────────────────────
{
  const broken: unknown[][] = [
    [null, 'PTable0099'],
    [null, 'q99 テスト設問'],
    [],
    [null, null, '単一回答', null, '％'],
    [null, null, '全体', null, 100],
    [null, 1, 'A社', null, '―'],
    [null, 2, 'B社', null, '12.5%'],
  ]
  const { blocks } = parseGtTable('%表', broken)
  const b = blocks[0]

  const a = b.cells.find((c) => c.rowLabel === 'A社')
  assert.equal(a?.value, null, '変換できない値は null（0 にしない）')
  assert.equal(a?.valueRaw, '―', '原文は保持する')

  const bb = b.cells.find((c) => c.rowLabel === 'B社')
  assert.equal(bb?.value, 12.5, '末尾の%は落として数値化する')

  const errs = b.warnings.filter((w) => w.severity === 'error')
  assert.equal(errs.length, 1)
  assert.equal(errs[0].code, 'UNPARSEABLE_VALUE')
  assert.equal(errs[0].row, 6, 'シート上の行番号を持つ')
  assert.ok(errs[0].detail.includes('―'))
}

// ────────────────────────────────────────────
// 7. 100%を超える値は error（0-1スケールを推測して勝手に補正しない）
// ────────────────────────────────────────────
{
  const odd: unknown[][] = [
    [null, 'PTable0098'],
    [null, 'q98 テスト'],
    [],
    [null, null, '単一回答', null, '％'],
    [null, null, '全体', null, 100],
    [null, 1, 'A社', null, 143.2],
  ]
  const { blocks } = parseGtTable('%表', odd)
  assert.equal(blocks[0].cells[0].value, 143.2, '値は書き換えない')
  const errs = blocks[0].warnings.filter((w) => w.code === 'PERCENT_OUT_OF_RANGE')
  assert.equal(errs.length, 1)
  assert.equal(errs[0].severity, 'error')
}

// ────────────────────────────────────────────
// 8. 回答形式行が無いブロックは throw せず warn で返す
// ────────────────────────────────────────────
{
  const noType: unknown[][] = [
    [null, 'PTable0097'],
    [null, 'q97 形式行が無い設問'],
    [],
    [null, 1, 'A社', null, 10],
  ]
  const { blocks } = parseGtTable('%表', noType)
  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].answerType, 'unknown')
  assert.equal(blocks[0].cells.length, 0)
  const w = blocks[0].warnings.find((x) => x.code === 'UNKNOWN_ANSWER_TYPE')
  assert.ok(w, '警告は出す')
  assert.equal(w!.severity, 'warn', 'ブロック1つの欠落では取り込みを止めない')
}

// ────────────────────────────────────────────
// 9. 構造的全損は throw する
// ────────────────────────────────────────────
{
  assert.throws(
    () => parseGtTable('Sheet1', [[null, 'これはGT表ではない'], [null, 'ただの表']]),
    /GT集計表の形式ではありません/
  )
  assert.throws(() => parseGtTable('Sheet1', []), /GT集計表の形式ではありません/)
}

// ────────────────────────────────────────────
// 8b. 実数の行・列に範囲チェックをかけないこと
//     （実ファイルで11件の誤検知が出たケースを固定）
// ────────────────────────────────────────────
{
  // 複数回答の末尾に付く「回答個数有効ケース数」は%ではなく実数
  const multiWithCount: unknown[][] = [
    [null, 'PTable0028'],
    [null, 'q10 「リィツメディカル」について、あてはまるものをお知らせください。'],
    [],
    [null, null, '複数回答', null, '％'],
    [null, null, '全体', null, 120],
    [null, 1, '眼科医療機器の販売', null, 89.1666666666667],
    [null, null, '回答個数有効ケース数', null, 120],
    [null, null, '回答個数平均', null, 1.04166666666667],
  ]
  const { blocks } = parseGtTable('%表', multiWithCount)
  assert.equal(
    blocks[0].warnings.filter((w) => w.severity === 'error').length,
    0,
    '実数行に100%超の警告を出さない'
  )
  const caseRow = blocks[0].cells.find((c) => c.rowLabel === '回答個数有効ケース数')
  assert.equal(caseRow?.value, 120, '値自体は保持する')
  assert.equal(caseRow?.kind, 'net')
}
{
  // 数値回答は回答形式行が列ラベル行を兼ねる特殊な形
  const numeric: unknown[][] = [
    [null, 'PTable0019'],
    [null, 'Nq3_T2B_N 以下に挙げる企業について 【認知社数】'],
    [],
    [null, null, '数値回答', null, '全体', '有効ケース数', '合計', '平均', '標準偏差', '最小値'],
    [null, 1, 'Nq3_T2B_N', null, 220, 220, 757, 3.44090909090909, 2.28, 0],
  ]
  const { blocks } = parseGtTable('%表', numeric)
  const b = blocks[0]
  assert.equal(b.answerType, 'numeric')
  assert.equal(b.warnings.length, 0, '数値回答でも警告を出さない')
  const avg = b.cells.find((c) => c.colLabel === '平均')
  assert.ok(avg && Math.abs((avg.value ?? 0) - 3.4409090909) < 1e-6, '平均値を読める')
  const sum = b.cells.find((c) => c.colLabel === '合計')
  assert.equal(sum?.value, 757, '100超の実数でも error にしない')
}

// ────────────────────────────────────────────
// 10. 設問コードの切り出し
// ────────────────────────────────────────────
{
  assert.deepEqual(splitQuestionCode('q3 以下に挙げる企業について'), {
    code: 'q3',
    text: '以下に挙げる企業について',
  })
  assert.deepEqual(splitQuestionCode('Nq3_T2B 認知（TOP2）'), {
    code: 'Nq3_T2B',
    text: '認知（TOP2）',
  })
  assert.equal(splitQuestionCode('BD11 リィツメディカル認知別').code, 'BD11')
  assert.deepEqual(splitQuestionCode(''), { code: '', text: '' })
  assert.deepEqual(splitQuestionCode('コードのみ'), { code: 'コードのみ', text: '' })
}

// ────────────────────────────────────────────
// 11. 属性設問の判定（除外はせずフラグだけ）
// ────────────────────────────────────────────
{
  assert.equal(guessIsAttribute('BD7', 'リィツメディカル認知別'), true)
  assert.equal(guessIsAttribute('q103', '先生の診療科を教えてください。'), true)
  assert.equal(guessIsAttribute('q107', '先生の性別を教えてください。'), true)
  assert.equal(guessIsAttribute('q3', '以下に挙げる企業についてどの程度ご存じですか。'), false)
  assert.equal(guessIsAttribute('q1_ac', '思い浮かべる企業名をお知らせください。'), false)
}

// ────────────────────────────────────────────
// 12. シート選択
// ────────────────────────────────────────────
{
  assert.equal(pickGtSheet(['INDEX', 'N%表', 'N表', '%表', 'グラフ']), '%表')
  assert.equal(pickGtSheet(['INDEX', 'N%表', 'グラフ']), 'N%表')
  assert.equal(pickGtSheet(['Sheet1']), null)
}

// ────────────────────────────────────────────
// 13. ブロック分割
// ────────────────────────────────────────────
{
  const ranges = splitBlocks(concat(FIX_RECALL, FIX_AWARENESS, FIX_T2B))
  assert.equal(ranges.length, 3)
  assert.deepEqual(
    ranges.map((r) => r.key),
    ['PTable0011', 'PTable0015', 'PTable0016']
  )
  // 隣のブロックの開始が自分の終端になる
  assert.equal(ranges[0].end, ranges[1].start)
}

console.log('✓ import-gt-table: 全テスト通過')
