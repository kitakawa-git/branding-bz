// entitlements の単体テスト
// 実行: npx tsx lib/billing/entitlements.test.ts
import assert from 'node:assert/strict'
import {
  getEffectivePlan,
  can,
  requirePlan,
  minimumPlanFor,
  getBuildToolMonthlyLimit,
  getMaxMembers,
  fitsWithinMemberLimit,
  PlanRequiredError,
  SELLABLE_PLANS,
  SELF_SERVE_PLANS,
  type Plan,
} from './entitlements'

const NOW = new Date('2026-08-14T12:00:00+09:00')
const past = '2026-08-13T12:00:00+09:00'
const future = '2026-09-13T12:00:00+09:00'

// ── getEffectivePlan: 期限内 / 期限切れ / NULL ──────────────
{
  assert.equal(
    getEffectivePlan({ plan: 'premium', plan_expires_at: null }, NOW), 'premium',
    'NULL は無期限なので契約プランのまま',
  )
  assert.equal(
    getEffectivePlan({ plan: 'premium', plan_expires_at: future }, NOW), 'premium',
    '期限内は契約プランのまま',
  )
  assert.equal(
    getEffectivePlan({ plan: 'premium', plan_expires_at: past }, NOW), 'free',
    '期限切れは free に落ちる',
  )
  assert.equal(
    getEffectivePlan({ plan: 'enterprise', plan_expires_at: past }, NOW), 'free',
    'enterprise でも期限切れなら free',
  )
}

// ── getEffectivePlan: 境界と壊れた入力 ──────────────────────
{
  // 期限ちょうどは「切れている」側に倒す（<= で判定）
  assert.equal(
    getEffectivePlan({ plan: 'premium', plan_expires_at: NOW.toISOString() }, NOW), 'free',
    '期限ちょうどは期限切れ扱い',
  )
  assert.equal(getEffectivePlan(null, NOW), 'free', 'company が無ければ free')
  assert.equal(getEffectivePlan({}, NOW), 'free', 'plan が無ければ free')
  assert.equal(
    getEffectivePlan({ plan: 'ghost', plan_expires_at: null }, NOW), 'free',
    '未知のプラン名は free（安全側）',
  )
  assert.equal(
    getEffectivePlan({ plan: 'premium', plan_expires_at: 'not-a-date' }, NOW), 'premium',
    '日付が壊れているだけで機能を止めない',
  )
}

// ── can(): プラン × 機能の境界 ─────────────────────────────
{
  const at = (plan: Plan) => ({ plan, plan_expires_at: null })

  // 掲示編集は v3 で free まで降りた
  assert.equal(can(at('free'), 'brandGuidelinesEdit', NOW), true)

  // 構築ツールは free でも使える（上限つき）
  assert.equal(can(at('free'), 'buildTools', NOW), true)
  assert.equal(can(at('free'), 'buildToolsUnlimited', NOW), false)
  assert.equal(can(at('standard'), 'buildToolsUnlimited', NOW), true)

  // スマート名刺系は standard から（Card 削除に伴う v1.1）
  assert.equal(can(at('free'), 'smartCard', NOW), false)
  assert.equal(can(at('standard'), 'smartCard', NOW), true)
  assert.equal(can(at('standard'), 'cardAnalytics', NOW), true)

  // timeline / announcements は v1.3 で premium → standard に降格
  assert.equal(can(at('free'), 'timeline', NOW), false)
  assert.equal(can(at('standard'), 'timeline', NOW), true)
  assert.equal(can(at('standard'), 'announcements', NOW), true)

  // 浸透系は premium から。KPI は premium 据え置き
  assert.equal(can(at('standard'), 'videoLearning', NOW), false)
  assert.equal(can(at('premium'), 'videoLearning', NOW), true)
  assert.equal(can(at('standard'), 'kpi', NOW), false)
  assert.equal(can(at('premium'), 'kpi', NOW), true)
  assert.equal(can(at('premium'), 'brandQuiz', NOW), true)

  // 計測は v3 で分割。basic は premium、full と innerSurvey は enterprise のみ
  assert.equal(can(at('premium'), 'brandScoreBasic', NOW), true)
  assert.equal(can(at('premium'), 'brandScoreFull', NOW), false)
  assert.equal(can(at('premium'), 'innerSurvey', NOW), false)
  assert.equal(can(at('enterprise'), 'brandScoreFull', NOW), true)
  assert.equal(can(at('enterprise'), 'innerSurvey', NOW), true)
}

// ── can(): 期限切れは実効プランで判定される ─────────────────
{
  const expiredEnterprise = { plan: 'enterprise', plan_expires_at: past }
  assert.equal(
    can(expiredEnterprise, 'innerSurvey', NOW), false,
    '期限切れの enterprise は enterprise 機能を使えない',
  )
  assert.equal(
    can(expiredEnterprise, 'brandGuidelinesEdit', NOW), true,
    '期限切れでも free の機能は使える',
  )
}

// ── requirePlan / PlanRequiredError ────────────────────────
{
  assert.doesNotThrow(() => requirePlan({ plan: 'enterprise' }, 'innerSurvey', NOW))

  assert.throws(
    () => requirePlan({ plan: 'premium' }, 'innerSurvey', NOW),
    (err: unknown) => {
      assert.ok(err instanceof PlanRequiredError)
      assert.equal(err.feature, 'innerSurvey')
      assert.equal(err.requiredPlan, 'enterprise')
      return true
    },
  )

  assert.throws(
    () => requirePlan({ plan: 'free' }, 'smartCard', NOW),
    (err: unknown) => {
      assert.ok(err instanceof PlanRequiredError)
      // card は販売終了なので、案内する最小プランは standard になる
      assert.equal(err.requiredPlan, 'standard')
      return true
    },
  )
}

// ── minimumPlanFor: 販売終了の card を案内しない ─────────────
{
  assert.equal(minimumPlanFor('brandGuidelinesEdit'), 'free')
  assert.equal(minimumPlanFor('pdfExport'), 'standard')
  assert.equal(minimumPlanFor('smartCard'), 'standard', 'card は候補から外す')
  assert.equal(minimumPlanFor('microFeedback'), 'standard', 'card は候補から外す')
  assert.equal(minimumPlanFor('kpi'), 'premium')
  assert.equal(minimumPlanFor('brandScoreFull'), 'enterprise')
}

// ── getBuildToolMonthlyLimit ───────────────────────────────
{
  assert.equal(getBuildToolMonthlyLimit('free'), 3, 'free は各ツール月3回')
  assert.equal(getBuildToolMonthlyLimit('card'), 3, 'card（温存）も月3回')
  assert.equal(getBuildToolMonthlyLimit('standard'), null, 'standard 以上は無制限')
  assert.equal(getBuildToolMonthlyLimit('premium'), null)
  assert.equal(getBuildToolMonthlyLimit('enterprise'), null)
}

// ── getMaxMembers ──────────────────────────────────────────
{
  assert.equal(getMaxMembers('free'), 5)
  assert.equal(getMaxMembers('card'), 30)
  assert.equal(getMaxMembers('standard'), 50)
  assert.equal(getMaxMembers('premium'), 300)
  assert.equal(getMaxMembers('enterprise'), null, 'enterprise は無制限')
}

// ── fitsWithinMemberLimit ──────────────────────────────────
{
  // free は5名。オーナー含めて5人まで
  assert.equal(fitsWithinMemberLimit(5, 4, 1), true, 'free の5人目は入る')
  assert.equal(fitsWithinMemberLimit(5, 5, 1), false, 'free で6人目は入らない')
  // ちょうど上限ぴったりは収まる側
  assert.equal(fitsWithinMemberLimit(50, 49, 1), true)
  assert.equal(fitsWithinMemberLimit(50, 50, 1), false)
  // CSV一括のようにまとめて足す場合、全部入らなければ false
  assert.equal(fitsWithinMemberLimit(50, 40, 10), true)
  assert.equal(fitsWithinMemberLimit(50, 40, 11), false, '1人でもはみ出したら通さない')
  // enterprise は無制限
  assert.equal(fitsWithinMemberLimit(null, 100000, 500), true)
  // すでに上限を超えている会社（プランを下げた等）でも0人追加なら通す
  assert.equal(fitsWithinMemberLimit(5, 9, 0), false, '既に超過なら追加0でも通さない')
}

// ── 販売中プランの定義 ──────────────────────────────────────
{
  assert.deepEqual([...SELLABLE_PLANS], ['free', 'standard', 'premium', 'enterprise'])
  assert.ok(!SELLABLE_PLANS.includes('card'), 'card は販売終了')
  assert.ok(!SELF_SERVE_PLANS.includes('enterprise'), 'enterprise は商談経由')
}

console.log('entitlements.test.ts: 全ケース pass')
