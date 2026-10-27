// 実行: npx tsx lib/tools/personality-connect.test.ts
//
// パーソナリティ診断の本体連携で、どのテーブルに・どの順で・何を書くかを固定する。
// （他社データへの書き込み経路なので、整理しても書き込み内容が変わらないことを保証する）
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildTraits,
  saveGuidelines,
  savePersonalities,
  syncExpectedTags,
  pickToneRules,
  replaceToneRules,
} from './personality-connect'

type Op = { table: string; op: string; payload?: unknown; filters: [string, string, unknown][]; options?: unknown }
type Resolver = (op: Op) => { data?: unknown; error?: { message: string } | null }

function fakeSupabase(resolve: Resolver = () => ({})) {
  const ops: Op[] = []
  const from = (table: string) => {
    const op: Op = { table, op: 'select', filters: [] }
    const done = () => {
      ops.push(op)
      const r = resolve(op)
      return Promise.resolve({ data: r.data ?? null, error: r.error ?? null })
    }
    const b: Record<string, unknown> = {
      select: () => b,
      insert: (p: unknown) => { op.op = 'insert'; op.payload = p; return b },
      update: (p: unknown) => { op.op = 'update'; op.payload = p; return b },
      upsert: (p: unknown, o: unknown) => { op.op = 'upsert'; op.payload = p; op.options = o; return b },
      delete: () => { op.op = 'delete'; return b },
      eq: (k: string, v: unknown) => { op.filters.push(['eq', k, v]); return b },
      in: (k: string, v: unknown) => { op.filters.push(['in', k, v]); return b },
      maybeSingle: done,
      single: done,
      then: (ok: (v: unknown) => unknown, ng: (e: unknown) => unknown) => done().then(ok, ng),
    }
    return b
  }
  return { client: { from } as unknown as SupabaseClient, ops }
}

const diagnosis = {
  aaker_scores: [
    { dimension: 'sincerity', label: '古いラベル', score: 4, copy: 'c1', description: '' },
    { dimension: 'unknown_dim', label: '残すラベル', score: 3, copy: '', description: 'd2' },
  ],
  archetype_traits: [{ name: '探究', score: 5, copy: '', description: 'x' }],
  tone_rules: [
    { rule_text: 'r0', ng_example: 'n0', ok_example: 'o0', severity: 'high' },
    { rule_text: 'r1', ng_example: 'n1', ok_example: 'o1', severity: 'low' },
    { rule_text: 'r2', ng_example: 'n2', ok_example: 'o2', severity: 'odd' },
  ],
} as unknown as Parameters<typeof buildTraits>[1]

async function main() {
  // --- buildTraits ---
  const aaker = buildTraits('aaker', diagnosis)
  assert.equal(aaker.length, 2)
  assert.notEqual(aaker[0].name, '古いラベル') // dimension key から現行ラベルへ正規化
  assert.equal(aaker[1].name, '残すラベル') // 未知の dimension はセッションのラベルのまま
  assert.deepEqual(aaker[1], { name: '残すラベル', score: 3, copy: '', description: 'd2', added_index: 1 })
  assert.deepEqual(buildTraits('archetype', diagnosis), [{ name: '探究', score: 5, copy: '', description: 'x', added_index: 0 }])

  // --- saveGuidelines: 既存行は id で update、無ければ company_id 付きで insert ---
  {
    const sb = fakeSupabase()
    await saveGuidelines(sb.client, 'c1', 'g1', { personality_summary: 's' })
    assert.deepEqual(sb.ops, [{ table: 'brand_guidelines', op: 'update', payload: { personality_summary: 's' }, filters: [['eq', 'id', 'g1']] }])
    const sb2 = fakeSupabase()
    await saveGuidelines(sb2.client, 'c1', undefined, { personality_summary: 's' })
    assert.deepEqual(sb2.ops[0].payload, { company_id: 'c1', personality_summary: 's' })
    assert.equal(sb2.ops[0].op, 'insert')
    const sb3 = fakeSupabase(() => ({ error: { message: 'x' } }))
    await assert.rejects(saveGuidelines(sb3.client, 'c1', 'g1', {}), /brand_guidelines 更新エラー: x/)
  }

  // --- savePersonalities: 既存行を探してから update / insert ---
  {
    const sb = fakeSupabase((op) => (op.op === 'select' ? { data: { id: 'p1' } } : {}))
    await savePersonalities(sb.client, 'c1', { communication_style: 'cs' })
    assert.deepEqual(sb.ops.map((o) => o.op), ['select', 'update'])
    assert.deepEqual(sb.ops[1].filters, [['eq', 'id', 'p1']])
    const sb2 = fakeSupabase(() => ({ data: null }))
    await savePersonalities(sb2.client, 'c1', { communication_style: 'cs' })
    assert.deepEqual(sb2.ops[1], { table: 'brand_personalities', op: 'insert', payload: { company_id: 'c1', communication_style: 'cs' }, filters: [] })
  }

  // --- syncExpectedTags: 新セットを upsert、外れた旧期待タグは降格（削除はしない） ---
  {
    const sb = fakeSupabase((op) => (op.op === 'select' ? { data: [{ tag: '誠実' }, { tag: '旧タグ' }] } : {}))
    await syncExpectedTags(sb.client, 'c1', ['誠実', '革新'])
    assert.deepEqual(sb.ops.map((o) => o.op), ['upsert', 'select', 'update'])
    assert.deepEqual(sb.ops[0].payload, [
      { company_id: 'c1', tag: '誠実', is_expected: true },
      { company_id: 'c1', tag: '革新', is_expected: true },
    ])
    assert.deepEqual(sb.ops[0].options, { onConflict: 'company_id,tag' })
    assert.deepEqual(sb.ops[2].payload, { is_expected: false })
    assert.deepEqual(sb.ops[2].filters, [['eq', 'company_id', 'c1'], ['in', 'tag', ['旧タグ']]])
    assert.ok(!sb.ops.some((o) => o.op === 'delete'))
    // 新セットが空なら upsert しない。降格対象が無ければ update しない
    const sb2 = fakeSupabase(() => ({ data: [] }))
    await syncExpectedTags(sb2.client, 'c1', [])
    assert.deepEqual(sb2.ops.map((o) => o.op), ['select'])
  }

  // --- pickToneRules: 範囲外・非整数は捨てる ---
  assert.deepEqual(pickToneRules(diagnosis, [2, 0, 5, -1, 1.5]).map((r) => r.rule_text), ['r2', 'r0'])

  // --- replaceToneRules: 診断由来だけ削除→残りの末尾に連番で insert、severity を変換 ---
  {
    const sb = fakeSupabase((op) => (op.op === 'select' ? { data: [{ sort_order: 3 }, { sort_order: 7 }] } : {}))
    await replaceToneRules(sb.client, 'c1', pickToneRules(diagnosis, [0, 1, 2]))
    assert.deepEqual(sb.ops.map((o) => o.op), ['delete', 'select', 'insert'])
    assert.deepEqual(sb.ops[0].filters, [['eq', 'company_id', 'c1'], ['eq', 'rule_type', 'tone_rule'], ['eq', 'source', 'personality_diagnosis']])
    const rows = sb.ops[2].payload as Record<string, unknown>[]
    assert.deepEqual(rows.map((r) => [r.rule_text, r.severity, r.sort_order]), [['r0', 'block', 8], ['r1', 'info', 9], ['r2', 'warn', 10]])
    assert.deepEqual(Object.keys(rows[0]), ['company_id', 'rule_type', 'scope', 'source', 'rule_text', 'ng_example', 'ok_example', 'severity', 'sort_order'])
    assert.equal(rows[0].scope, 'global')
    const sb2 = fakeSupabase((op) => (op.op === 'delete' ? { error: { message: 'no' } } : {}))
    await assert.rejects(replaceToneRules(sb2.client, 'c1', []), /旧 personality tone_rule 削除エラー: no/)
  }

  console.log('personality-connect: all tests passed')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
