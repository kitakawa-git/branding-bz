// 関係の意味制約（RELATION_RULES）と relation-scan 検証の回帰テスト。
// 実行: nvm use 22 && npx tsx lib/brand/relation-rules.test.ts
// RELATION_RULES は DBトリガ validate_element_relation_semantics（20260721163054）と
// 同内容を保つ契約。ここが変わるときはマイグレーションも揃えること。
import assert from 'node:assert/strict'
import {
  CREATABLE_RELATION_TYPES,
  isValidRelationShape,
  RELATION_RULES,
  type ElementRef,
} from './elements-catalog'
import { filterToFocus, validateCandidates, type RelationCandidate } from './relation-scan'

// ---- RELATION_RULES の基本形 ----

// 本番データに実在する組み合わせ（2026-07-21時点の全型組）はすべて適合する
assert.ok(isValidRelationShape('guides', 'philosophy_element', 'philosophy_element'))
assert.ok(isValidRelationShape('guides', 'philosophy_element', 'value_proposition'))
assert.ok(isValidRelationShape('evidencedBy', 'philosophy_element', 'proof_point'))
assert.ok(isValidRelationShape('evidencedBy', 'value_proposition', 'proof_point'))
assert.ok(isValidRelationShape('constrainedBy', 'philosophy_element', 'governance_rule'))
assert.ok(isValidRelationShape('constrainedBy', 'value_proposition', 'governance_rule'))

// 未来設計4種は読み取り側（integrity/fetch）が期待する形と一致
assert.ok(isValidRelationShape('aspiresTo', 'value_proposition', 'philosophy_element'))
assert.ok(isValidRelationShape('requires', 'philosophy_element', 'desired_evidence'))
assert.ok(isValidRelationShape('toBeEvidencedBy', 'value_proposition', 'desired_evidence'))
assert.ok(isValidRelationShape('verifies', 'proof_point', 'desired_evidence'))

// 意味的に無効な組は拒否される
assert.ok(!isValidRelationShape('evidencedBy', 'persona', 'governance_rule'))
assert.ok(!isValidRelationShape('guides', 'proof_point', 'philosophy_element'))
assert.ok(!isValidRelationShape('promisedTo', 'persona', 'value_proposition')) // 向きが逆
assert.ok(!isValidRelationShape('verifies', 'value_proposition', 'desired_evidence'))

// communicatedAs は廃止＝どの組も作れない
assert.ok(!isValidRelationShape('communicatedAs', 'philosophy_element', 'governance_rule'))
assert.ok(!CREATABLE_RELATION_TYPES.some((r) => r.value === 'communicatedAs'))
assert.ok(!('communicatedAs' in RELATION_RULES))

// ---- validateCandidates がドメイン/レンジ違反を落とす ----

const catalog: ElementRef[] = [
  { kind: 'philosophy_element', id: 'ph1', label: 'ミッション' },
  { kind: 'value_proposition', id: 'vp1', label: '提供価値A' },
  { kind: 'proof_point', id: 'pp1', label: '実績A' },
  { kind: 'persona', id: 'pe1', label: 'ペルソナA' },
]
const mk = (rt: string, sk: string, sid: string, tk: string, tid: string) => ({
  source_kind: sk,
  source_id: sid,
  target_kind: tk,
  target_id: tid,
  relation_type: rt,
  confidence: 'high',
  rationale: 'テスト用の理由',
})

const validated = validateCandidates(
  [
    mk('guides', 'philosophy_element', 'ph1', 'value_proposition', 'vp1'), // 適合
    mk('promisedTo', 'value_proposition', 'vp1', 'persona', 'pe1'), // 適合
    mk('guides', 'philosophy_element', 'ph1', 'persona', 'pe1'), // レンジ違反（persona は guides の対象外）
    mk('aspiresTo', 'philosophy_element', 'ph1', 'philosophy_element', 'ph1'), // スキャン対象外＋自己参照
    mk('evidencedBy', 'persona', 'pe1', 'proof_point', 'pp1'), // ドメイン違反
    mk('communicatedAs', 'philosophy_element', 'ph1', 'value_proposition', 'vp1'), // 廃止種別
  ],
  catalog,
  [],
)
assert.equal(validated.length, 2)
assert.deepEqual(
  validated.map((c) => c.relation_type).sort(),
  ['guides', 'promisedTo'],
)

// ---- filterToFocus は焦点要素を端点に含む候補だけ・上限つき ----

const cands: RelationCandidate[] = [
  {
    source_kind: 'philosophy_element', source_id: 'ph1', source_label: 'ミッション',
    target_kind: 'value_proposition', target_id: 'vp1', target_label: '提供価値A',
    relation_type: 'guides', confidence: 'high', rationale: 'r',
  },
  {
    source_kind: 'value_proposition', source_id: 'vp1', source_label: '提供価値A',
    target_kind: 'proof_point', target_id: 'pp1', target_label: '実績A',
    relation_type: 'evidencedBy', confidence: 'high', rationale: 'r',
  },
]
const focused = filterToFocus(cands, { kind: 'philosophy_element', id: 'ph1' })
assert.equal(focused.length, 1)
assert.equal(focused[0].relation_type, 'guides')
assert.equal(filterToFocus(cands, { kind: 'philosophy_element', id: 'ph1' }, 0).length, 0)

console.log('relation-rules.test.ts: all assertions passed')
