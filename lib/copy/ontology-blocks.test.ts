// §9 FACT/ASPIRATION 物理分離の単体テスト（DB非依存）。
// 実行: npx tsx lib/copy/ontology-blocks.test.ts
import assert from 'node:assert/strict'
import { buildAspirationBlock, isCurrentVp, isAspirationVp, extractBannedTerms } from './ontology-blocks'
import { buildCopySystemPrompt } from './role-matrix'

// --- 禁止語の抽出（rule_type 未取得で常に空だった回帰の防止） ---
const banned = extractBannedTerms([
  { rule_type: 'banned_word', rule_text: '業界No.1', ng_example: '当社は業界No.1です' },
  { rule_type: 'tone_rule', rule_text: '断定口調を避ける' },
  { rule_type: 'claim_rule', rule_text: '効果を保証しない' },
  { rule_type: 'compliance_rule', rule_text: '薬機法に配慮' },
])
assert.deepEqual(banned, ['業界No.1', '当社は業界No.1です'], 'banned_word の rule_text と ng_example だけを拾う')
assert.equal(extractBannedTerms([{ rule_type: 'tone_rule', rule_text: 'x' }]).length, 0, 'banned_word が無ければ空')
assert.equal(extractBannedTerms([{ rule_text: 'rule_type 未取得' }]).length, 0, 'rule_type が無い行は対象外')

// --- lifecycle_state の振り分け ---
assert.equal(isCurrentVp({ lifecycle_state: 'current' }), true)
assert.equal(isCurrentVp({ lifecycle_state: null }), true, 'null は current 扱い（後方互換）')
assert.equal(isCurrentVp({}), true, '未指定も current 扱い')
assert.equal(isCurrentVp({ lifecycle_state: 'target' }), false)
assert.equal(isAspirationVp({ lifecycle_state: 'target' }), true)
assert.equal(isAspirationVp({ lifecycle_state: 'transition_candidate' }), true, '移行候補は保守的に未来側')
assert.equal(isAspirationVp({ lifecycle_state: 'current' }), false)
assert.equal(isAspirationVp({ lifecycle_state: 'retired' }), false, '廃止は未来でも事実でもない')

// --- ASPIRATION の組み立て ---
const full = buildAspirationBlock({
  vps: [
    { title: '現在の約束', description: 'いま提供している', lifecycle_state: 'current' },
    { title: '未来の約束', description: 'これから', lifecycle_state: 'target' },
    { title: '移行中の約束', description: '昇格待ち', lifecycle_state: 'transition_candidate' },
    { title: '廃止した約束', lifecycle_state: 'retired' },
  ],
  desiredEvidence: [
    { title: '達成済みの獲得目標', state: 'met' },
    { title: '未達の獲得目標', state: 'unmet' },
    { title: '一部達成の獲得目標', state: 'partially_met' },
    { title: '判定不能の獲得目標', state: 'indeterminate' },
  ],
  vision: '10年後の理想',
})
assert.ok(full.block.includes('10年後の理想'), 'ビジョンは ASPIRATION に入る')
assert.ok(full.block.includes('未来の約束'), 'target VP は ASPIRATION')
assert.ok(full.block.includes('移行中の約束'), 'transition_candidate は ASPIRATION')
assert.ok(!full.block.includes('現在の約束'), 'current VP は ASPIRATION に入らない（FACT側）')
assert.ok(!full.block.includes('廃止した約束'), 'retired は ASPIRATION に入らない')
assert.ok(full.block.includes('未達の獲得目標'), '未達 DE は ASPIRATION')
assert.ok(full.block.includes('一部達成の獲得目標'), '一部達成 DE は ASPIRATION')
assert.ok(full.block.includes('判定不能の獲得目標'), '判定不能 DE は ASPIRATION')
assert.ok(!full.block.includes('達成済みの獲得目標'), '達成済み DE 自体は引用対象にしない（§14.5）')

// --- 0件フォールバック ---
const none = buildAspirationBlock({
  vps: [{ title: '現在の約束', lifecycle_state: 'current' }],
  desiredEvidence: [{ title: '達成済み', state: 'met' }],
  vision: null,
})
assert.equal(none.block, '', 'ASPIRATION 素材が0件ならブロックは空')
assert.deepEqual(none.strings, [])

// --- プロンプト注入: 0件なら従来出力と完全一致 ---
const base = {
  role: 'hero_h1' as const,
  register: 'neutral' as const,
  intentBlock: 'INTENT本文',
  factBlock: 'FACT本文',
  rulesBlock: 'RULES本文',
  personaBlock: 'PERSONA本文',
  clicheList: 'クリシェ',
}
const withoutAspiration = buildCopySystemPrompt(base)
const withEmptyAspiration = buildCopySystemPrompt({ ...base, aspirationBlock: '' })
assert.equal(withEmptyAspiration, withoutAspiration, 'ASPIRATION 0件なら従来プロンプトと完全一致')

const withAspiration = buildCopySystemPrompt({ ...base, aspirationBlock: 'ASPIRATION本文' })
assert.ok(withAspiration.includes('# 目指す姿（ASPIRATION・まだ事実ではない）'), '別セクションとして注入される')
assert.ok(withAspiration.includes('ASPIRATION本文'))
assert.ok(withAspiration.includes('引用してよい事実は FACT ブロックのみ'), '断定・引用禁止の明示ルールが付く')
assert.ok(
  withAspiration.indexOf('# 引用してよい事実（FACT') < withAspiration.indexOf('# 目指す姿（ASPIRATION'),
  'FACT と ASPIRATION は別セクションで並ぶ',
)

console.log('✓ ontology-blocks §9 FACT/ASPIRATION 分離テスト 全パス')
