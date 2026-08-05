// GT表からの読みどころ抽出のテスト
// 実行: npx tsx lib/brand-score/market-extras.test.ts
import assert from 'node:assert/strict'
import {
  IMPRESSION_TOP_N,
  computeImpressionFit,
  extractMarketExtras,
  type ExtraBlock,
  type ExtraCell,
} from './market-extras'

const SELF = 'リィツメディカル'

// 2026年 眼科医調査の実データを縮めたもの
const blocks: ExtraBlock[] = [
  { id: 'b5', question_code: 'q5', question_text: 'どのような点を重視しますか。１）重視する点をすべて ２）最も重視する点をひとつ', is_attribute: false },
  { id: 'b6', question_code: 'q6', question_text: '以下に挙げる企業について、どのようなイメージをお持ちですか。', is_attribute: false },
  { id: 'b9', question_code: 'q9', question_text: 'どのようなところから見聞きしていますか。情報源としてあてはまるもの', is_attribute: false },
  { id: 'b12', question_code: 'q12', question_text: '「リィツメディカル」社の提供するサービスについて、導入・購入状況をお知らせください', is_attribute: false },
  { id: 'b13', question_code: 'q13', question_text: '「リィツメディカル」について、以下の項目にそれぞれあてはまるもの', is_attribute: false },
  { id: 'b14', question_code: 'q14', question_text: '企業「リィツメディカル」のイメージに最も近いもの', is_attribute: false },
  { id: 'b4', question_code: 'q4', question_text: '以下に挙げる企業について、導入・購入の状況として、あてはまるもの', is_attribute: false },
  { id: 'bd', question_code: 'BD1', question_text: '医師区分', is_attribute: true },
]

const cells: ExtraCell[] = [
  // Q5 重視点。複数回答の行だけを使う（単一回答の行に引っぱられない）
  { block_id: 'b5', row_label: '重視する点（いくつでも）', col_label: '信頼できる', value: 70.9, base_n: 220 },
  { block_id: 'b5', row_label: '重視する点（いくつでも）', col_label: '製品・サービスの質がよい', value: 64.5, base_n: 220 },
  { block_id: 'b5', row_label: '重視する点（いくつでも）', col_label: '営業担当者の対応がよい', value: 62.7, base_n: 220 },
  { block_id: 'b5', row_label: '重視する点（いくつでも）', col_label: '安定性がある', value: 54.5, base_n: 220 },
  { block_id: 'b5', row_label: '重視する点（いくつでも）', col_label: '顧客ニーズの対応力が高い', value: 54.1, base_n: 220 },
  { block_id: 'b5', row_label: '重視する点（いくつでも）', col_label: '実績がある', value: 46.8, base_n: 220 },
  { block_id: 'b5', row_label: '重視する点（いくつでも）', col_label: '親しみがある', value: 33.6, base_n: 220 },
  { block_id: 'b5', row_label: '重視する点（いくつでも）', col_label: '回答個数平均', value: 6.2, base_n: 220 },
  { block_id: 'b5', row_label: '最も重視する点（ひとつだけ）', col_label: '信頼できる', value: 36.4, base_n: 220 },
  // Q6 イメージ。自社行だけを使う
  { block_id: 'b6', row_label: 'リィツメディカル', col_label: '実績がある', value: 31.9, base_n: 182 },
  { block_id: 'b6', row_label: 'リィツメディカル', col_label: '信頼できる', value: 25.3, base_n: 182 },
  { block_id: 'b6', row_label: 'リィツメディカル', col_label: '安定性がある', value: 23.1, base_n: 182 },
  { block_id: 'b6', row_label: 'リィツメディカル', col_label: '営業担当者の対応がよい', value: 21.4, base_n: 182 },
  { block_id: 'b6', row_label: 'リィツメディカル', col_label: '親しみがある', value: 18.7, base_n: 182 },
  { block_id: 'b6', row_label: 'リィツメディカル', col_label: '製品・サービスの質がよい', value: 15.9, base_n: 182 },
  { block_id: 'b6', row_label: 'リィツメディカル', col_label: '顧客ニーズの対応力が高い', value: 15.8, base_n: 182 },
  { block_id: 'b6', row_label: 'リィツメディカル', col_label: 'あてはまるものはひとつもない', value: 17.6, base_n: 182 },
  { block_id: 'b6', row_label: 'はんだや', col_label: '信頼できる', value: 40, base_n: 189 },
  // Q9 認知経路
  { block_id: 'b9', row_label: 'リィツメディカル', col_label: '同業者の口コミ', value: 28.6, base_n: 182 },
  { block_id: 'b9', row_label: 'リィツメディカル', col_label: '医療機器メーカーのイベント', value: 22.5, base_n: 182 },
  { block_id: 'b9', row_label: 'リィツメディカル', col_label: 'あてはまるものはない', value: 22.0, base_n: 182 },
  { block_id: 'b9', row_label: 'はんだや', col_label: '同業者の口コミ', value: 30, base_n: 189 },
  // Q12 事業浸透度
  { block_id: 'b12', row_label: '眼科医療機器の販売', col_label: '導入・購入経験あり・計', value: 86.5, base_n: 133 },
  { block_id: 'b12', row_label: '眼科医の開業サポート', col_label: '導入・購入経験あり・計', value: 26.3, base_n: 133 },
  // Q4 は全社の導入率。設問文が自社について聞いていないので事業浸透度には混ぜない
  { block_id: 'b4', row_label: 'リィツメディカル', col_label: '導入・購入経験あり・計', value: 73.1, base_n: 182 },
  { block_id: 'b4', row_label: 'はんだや', col_label: '導入・購入経験あり・計', value: 63.5, base_n: 189 },
  // Q13 サービス評価
  { block_id: 'b13', row_label: '製品・サービスの品質がよい', col_label: 'あてはまる・計', value: 58.8, base_n: 182 },
  { block_id: 'b13', row_label: '営業担当者の対応がよい', col_label: 'あてはまる・計', value: 54.4, base_n: 182 },
  { block_id: 'b13', row_label: '製品・サービスの品質がよい', col_label: 'ややあてはまる', value: 33.5, base_n: 182 },
  // Q14 パーソナリティ（SD法）
  { block_id: 'b14', row_label: '行動力のある:受け身な', col_label: 'Aに近い・計', value: 52.2, base_n: 182 },
  { block_id: 'b14', row_label: '誠実な:いい加減な', col_label: 'Aに近い・計', value: 47.8, base_n: 182 },
  { block_id: 'b14', row_label: '革新的な:古くさい', col_label: 'Aに近い・計', value: 22.0, base_n: 182 },
  { block_id: 'b14', row_label: '誠実な:いい加減な', col_label: 'ややAに近い', value: 36.8, base_n: 182 },
]

// ────────────────────────────────────────────
// 1. 5つとも取れる
// ────────────────────────────────────────────
{
  const e = extractMarketExtras(blocks, cells, SELF)

  assert.ok(e.impression, '印象一致度が取れる')
  assert.equal(e.impression!.importance[0].label, '信頼できる')
  assert.equal(e.impression!.image[0].label, '実績がある')
  assert.equal(e.impression!.importanceBaseN, 220)
  assert.equal(e.impression!.imageBaseN, 182, '母数が違うので差分は取れない。順位で比べる')
  assert.deepEqual(e.impression!.misses, ['製品・サービスの質がよい', '顧客ニーズの対応力が高い'])
  assert.deepEqual(e.impression!.overs, ['実績がある', '親しみがある'])
  assert.equal(e.impression!.score, 60, '市場トップ5のうち3つが自社イメージのトップ5に入る')

  assert.equal(e.personality!.items.length, 3, '「Aに近い・計」だけを拾う')
  assert.equal(e.personality!.items[0].positive, '行動力のある')
  assert.equal(e.personality!.items[0].negative, '受け身な')

  assert.equal(e.contactPoints!.items.length, 2, '「あてはまるものはない」は項目にしない')
  assert.equal(e.contactPoints!.items[0].label, '同業者の口コミ')

  assert.equal(e.services!.items.length, 2, 'Q4（全社の導入率）を混ぜない')
  assert.equal(e.services!.items[0].value, 86.5)

  assert.equal(e.serviceEvaluation!.items.length, 2, '「あてはまる・計」以外の選択肢は拾わない')
  assert.equal(e.serviceEvaluation!.items[0].label, '製品・サービスの品質がよい')
}

// ────────────────────────────────────────────
// 2. 自社が決まっていなければ何も出さない（推測しない）
// ────────────────────────────────────────────
{
  const e = extractMarketExtras(blocks, cells, null)
  assert.equal(e.impression, null)
  assert.equal(e.personality, null)
  assert.equal(e.contactPoints, null)
  assert.equal(e.services, null)
  assert.equal(e.serviceEvaluation, null)
}

// ────────────────────────────────────────────
// 3. 項目が足りなければ点は出さない（0にしない）
// ────────────────────────────────────────────
{
  const fit = computeImpressionFit(
    [
      { label: 'A', value: 50 },
      { label: 'B', value: 40 },
    ],
    [
      { label: 'A', value: 30 },
      { label: 'B', value: 20 },
    ],
    220,
    182
  )
  assert.equal(fit.score, null, `上位${IMPRESSION_TOP_N}件に満たなければ null`)
  assert.equal(fit.matches.length, 2, '突き合わせ自体はできる')
}

// ────────────────────────────────────────────
// 4. 完全一致は100点
// ────────────────────────────────────────────
{
  const items = ['A', 'B', 'C', 'D', 'E'].map((l, i) => ({ label: l, value: 50 - i }))
  const fit = computeImpressionFit(items, items, 220, 182)
  assert.equal(fit.score, 100)
  assert.deepEqual(fit.misses, [])
  assert.deepEqual(fit.overs, [])
}

console.log('✓ market-extras: 全テスト通過')
