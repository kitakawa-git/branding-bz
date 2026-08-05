// 市場調査の自動割り当てのテスト
// 実行: npx tsx lib/brand-score/market-auto-map.test.ts
import assert from 'node:assert/strict'
import {
  autoMapStages,
  normalizeCompanyName,
  type AutoMapBlock,
  type AutoMapCell,
} from './market-auto-map'

// ────────────────────────────────────────────
// 1. 社名の表記ゆれ
//    実データに「リィツメディカル」と「リッツメディカル」が併存する
// ────────────────────────────────────────────
{
  assert.equal(normalizeCompanyName('リィツメディカル'), normalizeCompanyName('リッツメディカル'))
  // 小書き仮名は一律で落とす（メディカル→メデカル）。両辺に同じ処理がかかるので
  // 比較には影響しない
  assert.equal(normalizeCompanyName('株式会社リィツメディカル'), 'リツメデカル')
  assert.equal(normalizeCompanyName('リィツ メディカル'), 'リツメデカル')
  // 別会社は一致しない
  assert.notEqual(normalizeCompanyName('はんだや'), normalizeCompanyName('リィツメディカル'))
}

// ────────────────────────────────────────────
// フィクスチャ（2026年GT表の構造）
// ────────────────────────────────────────────
function build(): { blocks: AutoMapBlock[]; cells: AutoMapCell[] } {
  const blocks: AutoMapBlock[] = [
    {
      id: 'b-q107', questionCode: 'q107', questionText: '先生の性別を教えてください。',
      isAttribute: true, columns: null,
    },
    {
      id: 'b-q1', questionCode: 'q1_AC',
      questionText: '「眼科の医療機器の販売・メンテナンスを行う企業」と聞いて思い浮かべる企業名を… 【第1想起】',
      isAttribute: false, columns: null,
    },
    {
      id: 'b-nq1', questionCode: 'Nq1AC_ALL',
      questionText: '「眼科の医療機器の販売・メンテナンスを行う企業」と聞いて思い浮かべる企業名を… 【全体想起】',
      isAttribute: false, columns: null,
    },
    {
      id: 'b-q3', questionCode: 'q3', questionText: 'どの程度ご存じですか。',
      isAttribute: false,
      columns: [
        { code: '1', label: '確かに知っている' },
        { code: null, label: '認知・計' },
      ],
    },
    {
      id: 'b-q4', questionCode: 'q4', questionText: '導入・購入の状況として、あてはまるものを',
      isAttribute: false,
      columns: [
        { code: '1', label: '現在、導入・購入している' },
        { code: null, label: '導入・購入経験あり・計' },
      ],
    },
    {
      id: 'b-q7', questionCode: 'q7', questionText: '製品やサービスを選定して導入・購入をするとしたら',
      isAttribute: false,
      columns: [
        { code: '1', label: 'この企業を絶対に選びたい' },
        { code: null, label: 'ロイヤリティあり・計' },
      ],
    },
    {
      id: 'b-q8', questionCode: 'q8', questionText: '同業のドクターにどの程度おすすめしたいと思いますか',
      isAttribute: false,
      columns: [
        { code: '1', label: '非常に勧めたいと思う' },
        { code: null, label: '推奨意向あり・計' },
      ],
    },
  ]

  const cells: AutoMapCell[] = [
    // 第1想起（非マトリクス）。表記が「リッツ」で揺れている
    { id: 'c-q1-self', blockId: 'b-q1', rowLabel: 'リッツメディカル', colLabel: null, value: 16.8, baseN: 220, kind: 'option' },
    { id: 'c-q1-riv', blockId: 'b-q1', rowLabel: 'はんだや', colLabel: null, value: 0, baseN: 220, kind: 'option' },
    // 全体想起（こちらは採らない）
    { id: 'c-nq1-self', blockId: 'b-nq1', rowLabel: 'リィツメディカル', colLabel: null, value: 24.5, baseN: 220, kind: 'option' },
    // 認知
    { id: 'c-q3-self-1', blockId: 'b-q3', rowLabel: 'リィツメディカル', colLabel: '確かに知っている', value: 63.6, baseN: 220, kind: 'option' },
    { id: 'c-q3-self', blockId: 'b-q3', rowLabel: 'リィツメディカル', colLabel: '認知・計', value: 82.7, baseN: 220, kind: 'option' },
    { id: 'c-q3-riv1', blockId: 'b-q3', rowLabel: 'はんだや', colLabel: '認知・計', value: 85.9, baseN: 220, kind: 'option' },
    { id: 'c-q3-riv2', blockId: 'b-q3', rowLabel: 'キシヤ', colLabel: '認知・計', value: 12.3, baseN: 220, kind: 'option' },
    { id: 'c-q3-na', blockId: 'b-q3', rowLabel: '無回答', colLabel: '認知・計', value: 4.5, baseN: 220, kind: 'no_answer' },
    // 利用（ベースNが220ではない）
    { id: 'c-q4-self', blockId: 'b-q4', rowLabel: 'リィツメディカル', colLabel: '導入・購入経験あり・計', value: 73.1, baseN: 182, kind: 'option' },
    { id: 'c-q4-riv', blockId: 'b-q4', rowLabel: 'はんだや', colLabel: '導入・購入経験あり・計', value: 63.5, baseN: 189, kind: 'option' },
    // 評価
    { id: 'c-q7-self', blockId: 'b-q7', rowLabel: 'リィツメディカル', colLabel: 'ロイヤリティあり・計', value: 78.0, baseN: 182, kind: 'option' },
    // 推奨
    { id: 'c-q8-self', blockId: 'b-q8', rowLabel: 'リィツメディカル', colLabel: '推奨意向あり・計', value: 65.4, baseN: 182, kind: 'option' },
  ]
  return { blocks, cells }
}

// ────────────────────────────────────────────
// 2. 5段階すべてに候補が当たる（2026年相当）
// ────────────────────────────────────────────
{
  const { blocks, cells } = build()
  const r = autoMapStages(blocks, cells, ['株式会社リィツメディカル'])

  assert.equal(r.missing.length, 0, '5段階すべて候補が出る')
  assert.deepEqual(
    r.proposals.map((p) => p.stage),
    ['awareness', 'recall', 'evaluation', 'usage', 'advocacy'],
    '表示順に並ぶ'
  )

  const byStage = Object.fromEntries(r.proposals.map((p) => [p.stage, p]))
  assert.equal(byStage.awareness.value, 82.7)
  assert.equal(byStage.awareness.colLabel, '認知・計')
  assert.equal(byStage.awareness.confidence, 'exact')
  assert.equal(byStage.usage.value, 73.1)
  assert.equal(byStage.usage.baseN, 182, '母数が220でないことを拾える')
  assert.equal(byStage.evaluation.value, 78.0)
  assert.equal(byStage.advocacy.value, 65.4)

  // 想起は【第1想起】を採り、全体想起は採らない
  assert.equal(byStage.recall.value, 16.8)
  assert.equal(byStage.recall.questionCode, 'q1_AC')

  // 表記ゆれのある行も自社として拾えている
  assert.ok(r.matchedSelfLabels.includes('リッツメディカル'))
  assert.ok(r.matchedSelfLabels.includes('リィツメディカル'))
}

// ────────────────────────────────────────────
// 3. 競合が同じ列から拾える。無回答は競合に混ぜない
// ────────────────────────────────────────────
{
  const { blocks, cells } = build()
  const r = autoMapStages(blocks, cells, ['リィツメディカル'])
  const aw = r.proposals.find((p) => p.stage === 'awareness')!

  assert.equal(aw.competitorCellIds.length, 2, 'はんだや・キシヤの2社')
  assert.deepEqual(
    aw.competitorCellIds.map((c) => c.name).sort(),
    ['はんだや', 'キシヤ'].sort()
  )
  assert.ok(
    !aw.competitorCellIds.some((c) => c.name === '無回答'),
    '無回答行を競合として登録しない'
  )
  // 別の列（確かに知っている）のセルは混ざらない
  assert.ok(!aw.competitorCellIds.some((c) => c.cellId === 'c-q3-self-1'))
}

// ────────────────────────────────────────────
// 4. 推奨の設問が無い調査（2025年相当）では missing になる
//    勝手に「未計測」にはしない
// ────────────────────────────────────────────
{
  const { blocks, cells } = build()
  const without = blocks.filter((b) => b.id !== 'b-q8')
  const r = autoMapStages(without, cells, ['リィツメディカル'])

  assert.deepEqual(r.missing, ['advocacy'])
  assert.equal(r.proposals.length, 4)
  assert.ok(
    !r.proposals.some((p) => p.stage === 'advocacy'),
    '見つからない段階は提案しない'
  )
}

// ────────────────────────────────────────────
// 5. 規約に当たらない調査では提案0件（誤った候補を出さない）
// ────────────────────────────────────────────
{
  const blocks: AutoMapBlock[] = [
    {
      id: 'b1', questionCode: 'Q1', questionText: '当社をご存知ですか',
      isAttribute: false,
      columns: [{ code: '1', label: 'はい' }, { code: '2', label: 'いいえ' }],
    },
  ]
  const cells: AutoMapCell[] = [
    { id: 'c1', blockId: 'b1', rowLabel: '全体', colLabel: 'はい', value: 60, baseN: 100, kind: 'option' },
  ]
  const r = autoMapStages(blocks, cells, ['リィツメディカル'])
  assert.equal(r.proposals.length, 0, '当たらなければ提案しない')
  assert.equal(r.missing.length, 5)
}

// ────────────────────────────────────────────
// 6. 属性設問は候補にしない
// ────────────────────────────────────────────
{
  const blocks: AutoMapBlock[] = [
    {
      id: 'b1', questionCode: 'BD7', questionText: 'リィツメディカル認知別',
      isAttribute: true,
      columns: [{ code: null, label: '認知・計' }],
    },
  ]
  const cells: AutoMapCell[] = [
    { id: 'c1', blockId: 'b1', rowLabel: 'リィツメディカル', colLabel: '認知・計', value: 77, baseN: 220, kind: 'option' },
  ]
  const r = autoMapStages(blocks, cells, ['リィツメディカル'])
  assert.equal(r.proposals.length, 0, '属性設問（集計軸）は候補から外す')
}

// ────────────────────────────────────────────
// 7. 自社行が見つからなければ提案しない
// ────────────────────────────────────────────
{
  const { blocks, cells } = build()
  const r = autoMapStages(blocks, cells, ['まったく別の会社'])
  assert.equal(r.proposals.length, 0, '自社が特定できなければ何も提案しない')
}

console.log('✓ market-auto-map: 全テスト通過')
