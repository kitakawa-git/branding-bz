// buildOnboardingView / getOnboardingConfig の単体テスト
// 実行: npx tsx lib/onboarding/steps.test.ts
import assert from 'node:assert/strict'
import {
  buildOnboardingView,
  getOnboardingConfig,
  type OnboardingStatus,
} from './steps'

const none: OnboardingStatus = {}

// ---- standard 以上は v2 でも v1 のまま（回帰させない） ----
for (const plan of ['standard', 'premium', 'enterprise'] as const) {
  const v = buildOnboardingView({ plan }, none)
  assert.deepEqual(
    v.steps.map((s) => s.id),
    ['philosophy', 'post', 'announcement', 'invite'],
    `${plan} のステップは v1 のまま`,
  )
  assert.equal(v.total, 4)
  assert.equal(v.config.heading, 'ようこそ、branding.bz へ')
  assert.equal(v.config.showPlanBadge, false, 'standard 以上にプランバッジは出さない')
  assert.equal(v.config.upsell, undefined, 'standard 以上に下部の案内は出さない')
  // 下書き支援リンクは free 専用
  assert.equal(v.steps.every((s) => !s.assist), true)
}

// standard の招待の待機ラベルも v1 のまま
{
  const v = buildOnboardingView({ plan: 'standard' }, none)
  assert.equal(
    v.steps.find((s) => s.id === 'invite')?.ctaLabelWaiting,
    'ステップ2・3のあとで',
  )
}

// ---- free は専用の5ステップ ----
{
  const v = buildOnboardingView({ plan: 'free' }, none)
  assert.deepEqual(
    v.steps.map((s) => s.id),
    ['basics', 'philosophy', 'visuals', 'verbal', 'invite'],
  )
  assert.equal(v.total, 5, 'free は5ステップ。実行できないステップは持たない')
  assert.equal(v.doneCount, 0)
  assert.equal(v.config.showPlanBadge, true)
  assert.equal(v.config.upsell?.href, '/plan')
  // 下書き支援は F2 / F3 だけ
  assert.deepEqual(
    v.steps.filter((s) => s.assist).map((s) => s.id),
    ['philosophy', 'visuals'],
  )
  // 招待の上限表記は MAX_MEMBERS から引く（直書きしない）
  assert.equal(v.steps.find((s) => s.id === 'invite')?.duration, '5名まで無料')
  assert.equal(
    v.steps.find((s) => s.id === 'invite')?.ctaLabelWaiting,
    'ステップ1〜4のあとで',
  )
}

// 遷移先は管理画面の分類そのまま（着いた先で迷わせない）
{
  const v = buildOnboardingView({ plan: 'free' }, none)
  assert.deepEqual(
    v.steps.map((s) => s.href),
    [
      '/admin/company',
      '/admin/brand/guidelines',
      '/admin/brand/visuals',
      '/admin/brand/verbal',
      '/admin/members-portal',
    ],
  )
}

// 現在ステップは未完了の最初の1つ
{
  const v = buildOnboardingView({ plan: 'free' }, { basics: true })
  assert.equal(v.doneCount, 1)
  assert.deepEqual(
    v.steps.filter((s) => s.current).map((s) => s.id),
    ['philosophy'],
  )
}

// free の全完了
{
  const v = buildOnboardingView(
    { plan: 'free' },
    { basics: true, philosophy: true, visuals: true, verbal: true, invite: true },
  )
  assert.equal(v.allDone, true)
  assert.equal(v.steps.filter((s) => s.current).length, 0)
}

// standard 側の完了判定に free 用のキーは効かない（列が違う）
{
  const v = buildOnboardingView(
    { plan: 'standard' },
    { basics: true, visuals: true, verbal: true, philosophy: true, invite: true },
  )
  assert.equal(v.allDone, false, 'post / announcement が残るので未完了')
  assert.equal(v.doneCount, 2)
}

// 期限切れは free 扱い（getEffectivePlan 経由の遅延評価）
{
  const v = buildOnboardingView(
    { plan: 'premium', plan_expires_at: '2020-01-01T00:00:00Z' },
    none,
  )
  assert.deepEqual(
    v.steps.map((s) => s.id),
    ['basics', 'philosophy', 'visuals', 'verbal', 'invite'],
    '期限切れの premium は free の列になる',
  )
}

// card は販売終了だが timeline / announcements を持たないので free と同じ列
{
  const c = getOnboardingConfig('card')
  assert.deepEqual(
    c.steps.map((s) => s.id),
    ['basics', 'philosophy', 'visuals', 'verbal', 'invite'],
  )
  assert.equal(c.steps.find((s) => s.id === 'invite')?.duration, '30名まで無料')
}

console.log('✓ lib/onboarding/steps.test.ts 全ケース pass')
