// 実行: npx tsx --conditions=react-server lib/tools/session-handlers.test.ts
//
// 構築ツール3つ（stp / persona / personality）のセッション API の共通ハンドラ。
// 以前は各 route に同じ処理が複製されていたので、レスポンスと DB への書き込み内容をここで固定する。
import assert from 'node:assert/strict'
import { NextRequest, NextResponse } from 'next/server'
import {
  createToolSessionPost,
  createToolSessionGet,
  createToolSessionPatch,
  type ToolSessionDeps,
} from './session-handlers'

type Op = { table: string; op: string; payload?: unknown; filters: [string, unknown][] }
type Resolver = (op: Op) => { data?: unknown; error?: { message: string } | null; count?: number }

/** 呼ばれた操作を記録し、resolver の結果を返す偽の supabase */
function fakeSupabase(resolve: Resolver) {
  const ops: Op[] = []
  const from = (table: string) => {
    const op: Op = { table, op: 'select', filters: [] }
    const done = () => {
      ops.push(op)
      const r = resolve(op)
      return Promise.resolve({ data: r.data ?? null, error: r.error ?? null, count: r.count })
    }
    const b: Record<string, unknown> = {
      select: () => b,
      insert: (payload: unknown) => { op.op = 'insert'; op.payload = payload; return b },
      update: (payload: unknown) => { op.op = 'update'; op.payload = payload; return b },
      eq: (k: string, v: unknown) => { op.filters.push([k, v]); return b },
      gte: () => b,
      order: () => b,
      limit: () => b,
      single: done,
      maybeSingle: done,
      then: (ok: (v: unknown) => unknown, ng: (e: unknown) => unknown) => done().then(ok, ng),
    }
    return b
  }
  return { client: { from }, ops }
}

function deps(supabase: ReturnType<typeof fakeSupabase>, opts: { completed?: number; unlimited?: boolean; selfError?: NextResponse } = {}): ToolSessionDeps {
  return {
    getSupabaseAdmin: (() => supabase.client) as unknown as ToolSessionDeps['getSupabaseAdmin'],
    requireSelf: (async () => (opts.selfError ? { error: opts.selfError } : { authId: 'user-1' })) as ToolSessionDeps['requireSelf'],
    requireOwnToolSession: (async () => ({ authId: 'user-1', session: { id: 's1', user_id: 'user-1', company_id: null, app_type: 'persona' } })) as ToolSessionDeps['requireOwnToolSession'],
    countCompletedThisMonth: (async () => opts.completed ?? 0) as ToolSessionDeps['countCompletedThisMonth'],
    fetchCompanyPlan: (async () => null) as ToolSessionDeps['fetchCompanyPlan'],
    can: (() => !!opts.unlimited) as ToolSessionDeps['can'],
  }
}

const req = (body?: unknown) =>
  new NextRequest('http://localhost/api/tools/persona/sessions', {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
const ctx = { params: Promise.resolve({ sessionId: 's1' }) }
const DEFAULT = { current_step: 1, completed: false }
const config = { appType: 'persona' as const, logTag: 'PersonaSessions', defaultSessionData: DEFAULT, createFailedLog: 'ステップ3失敗' }

async function main() {
  // --- POST: 進行中のセッションがあればそれを返す ---
  {
    const sb = fakeSupabase((op) => {
      if (op.table === 'admin_users') return { data: { company_id: 'c1' } }
      if (op.table === 'mini_app_sessions') return { data: { id: 'old', current_step: 3, session_data: { a: 1 } } }
      return {}
    })
    const res = await createToolSessionPost(config, deps(sb))(req({ userId: 'user-1' }))
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { sessionId: 'old', currentStep: 3, sessionData: { a: 1 }, isExisting: true })
    assert.ok(!sb.ops.some((o) => o.op === 'insert'))
    const lookup = sb.ops.find((o) => o.table === 'mini_app_sessions')!
    assert.deepEqual(lookup.filters, [['user_id', 'user-1'], ['app_type', 'persona'], ['status', 'in_progress']])
  }

  // --- POST: 無ければ新規作成（company_id は admin_users から） ---
  {
    const sb = fakeSupabase((op) => {
      if (op.table === 'admin_users') return { data: { company_id: 'c1' } }
      if (op.op === 'insert') return { data: { id: 'new' } }
      return { data: null }
    })
    const res = await createToolSessionPost(config, deps(sb))(req({ userId: 'user-1' }))
    assert.equal(res.status, 201)
    assert.deepEqual(await res.json(), { sessionId: 'new', currentStep: 1, sessionData: DEFAULT, isExisting: false })
    const ins = sb.ops.find((o) => o.op === 'insert')!
    assert.deepEqual(ins.payload, { user_id: 'user-1', app_type: 'persona', status: 'in_progress', current_step: 1, company_id: 'c1', session_data: DEFAULT })
  }

  // --- POST: forceNew なら進行中があっても新規作成 ---
  {
    const sb = fakeSupabase((op) => (op.op === 'insert' ? { data: { id: 'new2' } } : { data: { id: 'old' } }))
    const res = await createToolSessionPost(config, deps(sb))(req({ userId: 'user-1', forceNew: true }))
    assert.equal(res.status, 201)
    assert.equal((await res.json()).sessionId, 'new2')
  }

  // --- POST: 月の無料上限に達していて進行中も無ければ 429 ---
  {
    const sb = fakeSupabase(() => ({ data: null }))
    const res = await createToolSessionPost(config, deps(sb, { completed: 3 }))(req({ userId: 'user-1' }))
    assert.equal(res.status, 429)
    assert.equal((await res.json()).error, 'usage_limit_exceeded')
    assert.ok(!sb.ops.some((o) => o.op === 'insert'))
  }

  // --- POST: 上限に達していても進行中があれば復帰できる ---
  {
    const sb = fakeSupabase((op) => (op.table === 'mini_app_sessions' ? { data: { id: 'old', current_step: 2, session_data: {} } } : { data: null }))
    const res = await createToolSessionPost(config, deps(sb, { completed: 3 }))(req({ userId: 'user-1' }))
    assert.equal(res.status, 200)
    assert.equal((await res.json()).isExisting, true)
  }

  // --- POST: 上限なしのプランは数えない ---
  {
    const sb = fakeSupabase((op) => (op.op === 'insert' ? { data: { id: 'n' } } : { data: null }))
    const res = await createToolSessionPost(config, deps(sb, { completed: 99, unlimited: true }))(req({ userId: 'user-1' }))
    assert.equal(res.status, 201)
  }

  // --- POST: 本人確認に失敗したらそのまま返す ---
  {
    const sb = fakeSupabase(() => ({}))
    const denied = NextResponse.json({ error: '他のユーザーのデータにはアクセスできません' }, { status: 403 })
    const res = await createToolSessionPost(config, deps(sb, { selfError: denied }))(req({ userId: 'someone' }))
    assert.equal(res.status, 403)
    assert.equal(sb.ops.length, 0)
  }

  // --- POST: 作成失敗は 500 ---
  {
    const sb = fakeSupabase((op) => (op.op === 'insert' ? { error: { message: 'boom' } } : { data: null }))
    const orig = console.error; console.error = () => {}
    const res = await createToolSessionPost(config, deps(sb))(req({ userId: 'user-1' }))
    console.error = orig
    assert.equal(res.status, 500)
    assert.equal((await res.json()).error, 'セッション作成エラー: boom')
  }

  // --- GET: 取得（app_type で絞る）／無ければ 404 ---
  {
    const sb = fakeSupabase(() => ({ data: { id: 's1', session_data: {} } }))
    const res = await createToolSessionGet(config, deps(sb))(req(), ctx)
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { session: { id: 's1', session_data: {} } })
    assert.deepEqual(sb.ops[0].filters, [['id', 's1'], ['app_type', 'persona']])
    const sb2 = fakeSupabase(() => ({ error: { message: 'no rows' } }))
    const res2 = await createToolSessionGet(config, deps(sb2))(req(), ctx)
    assert.equal(res2.status, 404)
  }

  // --- PATCH: session_data は既存とマージ、completed で completed_at と completed フラグ ---
  {
    const sb = fakeSupabase((op) => (op.op === 'select' ? { data: { session_data: { a: 1, b: 1 } } } : {}))
    const res = await createToolSessionPatch(config, deps(sb))(req({ step: 5, sessionData: { b: 2 }, status: 'completed' }), ctx)
    assert.deepEqual(await res.json(), { sessionId: 's1', currentStep: 5, saved: true })
    const upd = sb.ops.find((o) => o.op === 'update')!
    const p = upd.payload as Record<string, unknown>
    assert.deepEqual(p.session_data, { a: 1, b: 2, completed: true })
    assert.equal(p.current_step, 5)
    assert.equal(p.status, 'completed')
    assert.equal(typeof p.completed_at, 'string')
    assert.deepEqual(upd.filters, [['id', 's1'], ['app_type', 'persona']])
  }

  // --- PATCH: 何も無ければ保存しない／更新失敗は 500 ---
  {
    const sb = fakeSupabase(() => ({}))
    const res = await createToolSessionPatch(config, deps(sb))(req({}), ctx)
    assert.deepEqual(await res.json(), { sessionId: 's1', saved: false, message: '更新するデータがありません' })
    assert.equal(sb.ops.length, 0)
    const sb2 = fakeSupabase((op) => (op.op === 'update' ? { error: { message: 'x' } } : {}))
    const orig = console.error; console.error = () => {}
    const res2 = await createToolSessionPatch(config, deps(sb2))(req({ step: 2 }), ctx)
    console.error = orig
    assert.equal(res2.status, 500)
    assert.equal((await res2.json()).error, 'データ保存エラー: x')
  }

  console.log('session-handlers: all tests passed')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
