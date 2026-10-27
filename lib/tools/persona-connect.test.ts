// 実行: npx tsx lib/tools/persona-connect.test.ts
//
// ペルソナ本体連携の brand_personas 同期（位置で対応づけて update / insert / 余剰 delete）を固定する。
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { syncPersonaRows } from './persona-connect'

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
      then: (ok: (v: unknown) => unknown, ng: (e: unknown) => unknown) => done().then(ok, ng),
    }
    return b
  }
  return { client: { from } as unknown as SupabaseClient, ops }
}

async function main() {
  const quiet = console.error
  console.error = () => {}
  const existing2 = (op: Op) => (op.op === 'select' ? { data: [{ id: 'p1', sort_order: 0 }, { id: 'p2', sort_order: 1 }] } : {})

  // 既存2・新3: update×2（id 保持）→ insert（company_id 付き）、delete なし
  {
    const sb = fakeSupabase(existing2)
    assert.deepEqual(await syncPersonaRows(sb.client, 'c1', [{ a: 0 }, { a: 1 }, { a: 2 }]), {})
    assert.deepEqual(sb.ops.map((o) => o.op), ['select', 'update', 'update', 'insert'])
    assert.deepEqual(sb.ops[1].filters, [['eq', 'id', 'p1']])
    assert.deepEqual(sb.ops[3].payload, { company_id: 'c1', a: 2 })
  }
  // 既存2・新1: update×1 → 余剰1件を delete
  {
    const sb = fakeSupabase(existing2)
    await syncPersonaRows(sb.client, 'c1', [{ a: 0 }])
    assert.deepEqual(sb.ops.map((o) => o.op), ['select', 'update', 'delete'])
    assert.deepEqual(sb.ops[2].filters, [['in', 'id', ['p2']]])
  }
  // 空なら既存に触らない（全消しガード）
  {
    const sb = fakeSupabase(existing2)
    assert.deepEqual(await syncPersonaRows(sb.client, 'c1', []), {})
    assert.deepEqual(sb.ops.map((o) => o.op), ['select'])
  }
  // 失敗したらその場で止めて、route が 500 で返す文言を返す
  {
    const fail = (kind: string) => (op: Op) => (op.op === 'select' ? existing2(op) : op.op === kind ? { error: { message: 'x' } } : {})
    assert.deepEqual(await syncPersonaRows(fakeSupabase(fail('update')).client, 'c1', [{ a: 0 }, { a: 1 }]), { error: 'ペルソナの更新に失敗しました' })
    assert.deepEqual(await syncPersonaRows(fakeSupabase(fail('insert')).client, 'c1', [{}, {}, {}]), { error: 'ペルソナの作成に失敗しました' })
    assert.deepEqual(await syncPersonaRows(fakeSupabase(fail('delete')).client, 'c1', [{}]), { error: 'ペルソナの整理に失敗しました' })
    const sb = fakeSupabase(fail('update'))
    await syncPersonaRows(sb.client, 'c1', [{ a: 0 }, { a: 1 }])
    assert.deepEqual(sb.ops.map((o) => o.op), ['select', 'update']) // 最初の失敗で止まる
  }

  console.error = quiet
  console.log('persona-connect: all tests passed')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
