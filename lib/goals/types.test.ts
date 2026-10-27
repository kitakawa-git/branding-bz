// lib/goals/types の単体テスト
// 実行: npx tsx lib/goals/types.test.ts
import assert from 'node:assert/strict'
import { pickCurrentPeriod, currentPeriodIds } from './types'

function p(id: string, type: string, is_current: boolean, status = 'active') {
  return { id, type, is_current, status }
}

// ── 期間が1つ（今の会社はすべてこれ）→ どの層も同じ期間 ─────────────
{
  const periods = [p('y', 'year', true), p('old', 'year', false, 'archived')]
  assert.equal(pickCurrentPeriod(periods, 'company')?.id, 'y')
  assert.equal(pickCurrentPeriod(periods, 'team')?.id, 'y')
  assert.equal(pickCurrentPeriod(periods, 'personal')?.id, 'y')
}

// ── 年度と半期が同時に今の期間 → 会社は年度、チーム・個人は半期 ─────────
{
  const periods = [p('h', 'half_year', true), p('y', 'year', true)]
  assert.equal(pickCurrentPeriod(periods, 'company')?.id, 'y')
  assert.equal(pickCurrentPeriod(periods, 'team')?.id, 'h')
  assert.equal(pickCurrentPeriod(periods, 'personal')?.id, 'h')
  assert.deepEqual(currentPeriodIds(periods).sort(), ['h', 'y'])
}

// ── 承認待ち・アーカイブは今の期間にしない ─────────────────────────
{
  const periods = [p('pending', 'year', false, 'pending_approval'), p('arch', 'year', false, 'archived')]
  assert.equal(pickCurrentPeriod(periods, 'personal'), null)
  assert.deepEqual(currentPeriodIds(periods), [])
}

console.log('lib/goals/types: ok')
