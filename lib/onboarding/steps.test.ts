// buildOnboardingView の単体テスト
// 実行: npx tsx lib/onboarding/steps.test.ts
import assert from 'node:assert/strict'
import { buildOnboardingView, type OnboardingStatus } from './steps'

const none: OnboardingStatus = {
  philosophy: false,
  post: false,
  announcement: false,
  invite: false,
}

// standard 以上は4ステップすべてが対象
{
  const v = buildOnboardingView({ plan: 'standard' }, none)
  assert.equal(v.total, 4)
  assert.equal(v.doneCount, 0)
  assert.equal(v.allDone, false)
  assert.equal(v.steps.filter((s) => s.locked).length, 0)
  // 現在のステップは最初の未完了1つだけ
  assert.deepEqual(
    v.steps.filter((s) => s.current).map((s) => s.id),
    ['philosophy'],
  )
}

// free は timeline / announcements がプラン外。分母から外す
{
  const v = buildOnboardingView({ plan: 'free' }, none)
  assert.equal(v.total, 2, 'free の分母は実行できる2ステップ')
  assert.deepEqual(
    v.steps.filter((s) => s.locked).map((s) => s.id),
    ['post', 'announcement'],
  )
  // ロックされたステップも番号は詰めない（招待は4のまま）
  assert.equal(v.steps.find((s) => s.id === 'invite')?.index, 4)
}

// free は ①④ が済めば完了。🔒 の②③が永久に完了をブロックしない
{
  const v = buildOnboardingView(
    { plan: 'free' },
    { philosophy: true, post: false, announcement: false, invite: true },
  )
  assert.equal(v.doneCount, 2)
  assert.equal(v.total, 2)
  assert.equal(v.allDone, true, 'free は①④完了で通常ダッシュボードへ')
}

// standard で同じ状態なら、まだ完了ではない
{
  const v = buildOnboardingView(
    { plan: 'standard' },
    { philosophy: true, post: false, announcement: false, invite: true },
  )
  assert.equal(v.doneCount, 2)
  assert.equal(v.total, 4)
  assert.equal(v.allDone, false)
  assert.deepEqual(
    v.steps.filter((s) => s.current).map((s) => s.id),
    ['post'],
    '完了済みは飛ばして次の未完了が現在ステップ',
  )
}

// 全完了
{
  const v = buildOnboardingView(
    { plan: 'premium' },
    { philosophy: true, post: true, announcement: true, invite: true },
  )
  assert.equal(v.allDone, true)
  assert.equal(v.steps.filter((s) => s.current).length, 0)
}

// 期限切れは free 扱い（getEffectivePlan 経由の遅延評価が効いているか）
{
  const v = buildOnboardingView(
    { plan: 'premium', plan_expires_at: '2020-01-01T00:00:00Z' },
    none,
  )
  assert.equal(v.total, 2, '期限切れの premium は free と同じ扱い')
}

console.log('✓ lib/onboarding/steps.test.ts 全ケース pass')
