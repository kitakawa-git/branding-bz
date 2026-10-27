// 実行: npx tsx lib/tools/shared-profile-writes.test.ts
//
// 共通プロフィール書き戻しの service 同期（id 保持）と、先頭ペルソナへの target 書き込みを固定する。
// service 同期は「既存行の id を保つ」ことが要（全削除→全INSERT にすると element_relations が消える）。
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { syncServiceElements, saveTargetToFirstPersona, type ServiceRow } from './shared-profile-writes'

type Op = { table: string; op: string; payload?: unknown; filters: [string, string, unknown][] }
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
      delete: () => { op.op = 'delete'; return b },
      eq: (k: string, v: unknown) => { op.filters.push(['eq', k, v]); return b },
      in: (k: string, v: unknown) => { op.filters.push(['in', k, v]); return b },
      order: () => b,
      limit: () => b,
      maybeSingle: done,
      then: (ok: (v: unknown) => unknown, ng: (e: unknown) => unknown) => done().then(ok, ng),
    }
    return b
  }
  return { client: { from } as unknown as SupabaseClient, ops }
}

const row = (title: string, i: number): ServiceRow => ({
  company_id: 'c1', element_type: 'service', title, body: `${title}の説明`, sort_order: i, status: 'published',
})

async function main() {
  const quiet = console.error
  console.error = () => {}

  // --- 既存2行・新3行: 先頭2行は id を保って update、3行目は insert、delete なし ---
  {
    const sb = fakeSupabase((op) => (op.op === 'select' ? { data: [{ id: 'e1' }, { id: 'e2' }] } : {}))
    await syncServiceElements(sb.client, 'c1', [row('A', 0), row('B', 1), row('C', 2)])
    assert.deepEqual(sb.ops.map((o) => o.op), ['select', 'update', 'update', 'insert'])
    assert.deepEqual(sb.ops[0].filters, [['eq', 'company_id', 'c1'], ['eq', 'element_type', 'service']])
    assert.deepEqual(sb.ops[1], { table: 'philosophy_elements', op: 'update', payload: { title: 'A', body: 'Aの説明', sort_order: 0, status: 'published' }, filters: [['eq', 'id', 'e1']] })
    assert.deepEqual(sb.ops[2].filters, [['eq', 'id', 'e2']])
    assert.deepEqual(sb.ops[3].payload, row('C', 2))
  }

  // --- 既存3行・新1行: 1行目を update、末尾2行だけ delete ---
  {
    const sb = fakeSupabase((op) => (op.op === 'select' ? { data: [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }] } : {}))
    await syncServiceElements(sb.client, 'c1', [row('A', 0)])
    assert.deepEqual(sb.ops.map((o) => o.op), ['select', 'update', 'delete'])
    assert.deepEqual(sb.ops[2].filters, [['in', 'id', ['e2', 'e3']]])
  }

  // --- 既存の取得に失敗したら何も書かない（以前と同じ） ---
  {
    const sb = fakeSupabase((op) => (op.op === 'select' ? { error: { message: 'x' } } : {}))
    await syncServiceElements(sb.client, 'c1', [row('A', 0)])
    assert.deepEqual(sb.ops.map((o) => o.op), ['select'])
  }

  // --- 個々の書き込みエラーはログだけで続ける ---
  {
    const sb = fakeSupabase((op) => (op.op === 'select' ? { data: [{ id: 'e1' }] } : { error: { message: 'w' } }))
    await syncServiceElements(sb.client, 'c1', [row('A', 0), row('B', 1)])
    assert.deepEqual(sb.ops.map((o) => o.op), ['select', 'update', 'insert'])
  }

  // --- saveTargetToFirstPersona: 既存ペルソナは更新（空なら null）、無ければテキストがあるときだけ作成 ---
  {
    const sb = fakeSupabase((op) => (op.op === 'select' ? { data: { id: 'p1' } } : {}))
    await saveTargetToFirstPersona(sb.client, 'c1', '')
    assert.deepEqual(sb.ops[1], { table: 'brand_personas', op: 'update', payload: { target: null }, filters: [['eq', 'id', 'p1']] })
    const sb2 = fakeSupabase(() => ({ data: null }))
    await saveTargetToFirstPersona(sb2.client, 'c1', '・中小企業')
    assert.deepEqual(sb2.ops[1].payload, { company_id: 'c1', name: '', sort_order: 0, target: '・中小企業' })
    const sb3 = fakeSupabase(() => ({ data: null }))
    await saveTargetToFirstPersona(sb3.client, 'c1', '')
    assert.deepEqual(sb3.ops.map((o) => o.op), ['select'])
  }

  console.error = quiet
  console.log('shared-profile-writes: all tests passed')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
