// free-limits の単体テスト
// 実行: npx tsx lib/tools/free-limits.test.ts
import assert from 'node:assert/strict'
import {
  MONTHLY_FREE_LIMIT,
  getCurrentMonthStartUtcIso,
  pickCountScope,
  countCompletedThisMonth,
} from './free-limits'

// ── 定数 ──────────────────────────────────────────────────
assert.equal(MONTHLY_FREE_LIMIT, 3, 'Free 月3回は定数')

// ── getCurrentMonthStartUtcIso ────────────────────────────
{
  // JST 2026-07-14 12:00 = UTC 2026-07-14 03:00
  // → 当月初（JST）は 2026-07-01 00:00 = UTC 2026-06-30 15:00
  const iso = getCurrentMonthStartUtcIso(new Date('2026-07-14T03:00:00.000Z'))
  assert.equal(iso, '2026-06-30T15:00:00.000Z', '7月の月初（JST）は 6/30 15:00 UTC')

  // JST 2026-01-02 00:30 = UTC 2026-01-01 15:30 → 当月初 2026-01-01 00:00 JST = 2025-12-31 15:00 UTC
  const iso2 = getCurrentMonthStartUtcIso(new Date('2026-01-01T15:30:00.000Z'))
  assert.equal(iso2, '2025-12-31T15:00:00.000Z', '1月の月初（JST）は前年12/31 15:00 UTC')
}

// ── pickCountScope: 会社があれば会社単位、無ければユーザー単位、どちらも無ければ null ──
{
  assert.deepEqual(
    pickCountScope({ companyId: 'c1', authId: 'u1' }),
    { column: 'company_id', value: 'c1' },
    'companyId があれば会社単位',
  )
  assert.deepEqual(
    pickCountScope({ companyId: null, authId: 'u1' }),
    { column: 'user_id', value: 'u1' },
    'companyId なしなら user_id 単位',
  )
  assert.deepEqual(
    pickCountScope({ companyId: undefined, authId: 'u1' }),
    { column: 'user_id', value: 'u1' },
    'undefined も null と同じ扱い',
  )
  assert.equal(
    pickCountScope({ companyId: null, authId: null }),
    null,
    'どちらも無ければ null（通常は呼ばれない）',
  )
  // 空文字は会社として扱わない（falsy）
  assert.deepEqual(
    pickCountScope({ companyId: '', authId: 'u1' }),
    { column: 'user_id', value: 'u1' },
    '空文字の companyId は無視して user_id にフォールバック',
  )
}

// ── countCompletedThisMonth: filter が正しく組み立てられる ──
type Call = { table?: string; select?: unknown[]; eq?: [string, string][]; gte?: [string, string] }
function makeMock(returnedCount: number | null): { admin: Parameters<typeof countCompletedThisMonth>[0]; call: Call } {
  const call: Call = { eq: [] }
  const chain = {
    select(cols: string, opts: unknown) {
      call.select = [cols, opts]
      return this
    },
    eq(col: string, val: string) {
      call.eq!.push([col, val])
      return this
    },
    gte(col: string, val: string) {
      call.gte = [col, val]
      return this
    },
    // thenable: await したときに { count } を返す
    then(resolve: (v: { count: number | null }) => void) {
      resolve({ count: returnedCount })
    },
  }
  const admin = {
    from(table: string) {
      call.table = table
      return chain
    },
  }
  return { admin, call }
}

async function main() {
  // 会社ありのとき: company_id で絞り、app_type/status/updated_at も付く
  {
    const { admin, call } = makeMock(2)
    const n = await countCompletedThisMonth(admin, 'stp', { companyId: 'c1', authId: 'u1' })
    assert.equal(n, 2)
    assert.equal(call.table, 'mini_app_sessions')
    assert.ok(call.eq!.some(([c, v]) => c === 'app_type' && v === 'stp'), 'app_type で絞る')
    assert.ok(call.eq!.some(([c, v]) => c === 'status' && v === 'completed'), 'completed のみ')
    assert.ok(call.eq!.some(([c, v]) => c === 'company_id' && v === 'c1'), '会社単位')
    assert.ok(!call.eq!.some(([c]) => c === 'user_id'), 'user_id では絞らない')
    assert.equal(call.gte![0], 'updated_at', 'updated_at で月初以降')
  }

  // 会社なしのとき: user_id で絞る（フォールバック）
  {
    const { admin, call } = makeMock(0)
    const n = await countCompletedThisMonth(admin, 'brand_colors', { companyId: null, authId: 'u1' })
    assert.equal(n, 0)
    assert.ok(call.eq!.some(([c, v]) => c === 'user_id' && v === 'u1'), 'user_id にフォールバック')
    assert.ok(!call.eq!.some(([c]) => c === 'company_id'), '会社では絞らない')
  }

  // scope が全く無いときは DB アクセスせず 0 を返す
  {
    const { admin, call } = makeMock(99)
    const n = await countCompletedThisMonth(admin, 'persona', { companyId: null, authId: null as unknown as string })
    assert.equal(n, 0)
    assert.equal(call.table, undefined, 'DB は叩かない')
  }

  // count が null でも 0 を返す（Supabase の挙動対策）
  {
    const { admin } = makeMock(null)
    const n = await countCompletedThisMonth(admin, 'personality', { companyId: 'c1', authId: 'u1' })
    assert.equal(n, 0)
  }

  console.log('free-limits.test.ts: 全ケース pass')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
