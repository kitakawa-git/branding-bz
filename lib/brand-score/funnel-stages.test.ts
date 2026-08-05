// funnel-stages の単体テスト
// 実行: npx tsx lib/brand-score/funnel-stages.test.ts
import assert from 'node:assert/strict'
import {
  resolveStage,
  calcFunnel,
  FUNNEL_STAGES,
  ALL_STAGES,
  type FunnelInputQuestion,
} from './funnel-stages'

// ── resolveStage: 32問構成の対応表 ────────────────
{
  assert.equal(resolveStage(9, 32), 'awareness')
  assert.equal(resolveStage(1, 32), 'understanding')
  assert.equal(resolveStage(24, 32), 'understanding', 'Q24（自部門の貢献を説明できる）は理解')
  assert.equal(resolveStage(2, 32), 'empathy')
  assert.equal(resolveStage(21, 32), 'behavior', 'Q21（社内の他部門との接点）は行動')
  assert.equal(resolveStage(31, 32), 'behavior', 'Q31（クライアントとの接点）も同じ構成概念で行動')
  assert.equal(resolveStage(32, 32), 'advocacy', 'Q32（名刺交換で強みを伝える）は推奨')
  assert.equal(resolveStage(5, 32), 'environment')
}

// ── resolveStage: 30問構成は 31・32 を持たない ──────
{
  assert.equal(resolveStage(4, 30), 'behavior')
  assert.equal(resolveStage(23, 30), 'advocacy')
  assert.equal(resolveStage(31, 30), null, '30問構成に31番は無い')
  assert.equal(resolveStage(32, 30), null)
}

// ── resolveStage: 対応表の無い設問数は null ─────────
{
  assert.equal(resolveStage(1, 15), null, '15問構成は対応表が無いので段階未設定')
  assert.equal(resolveStage(1, 0), null)
}

// ── resolveStage: reference_data.stage が最優先 ────
{
  assert.equal(
    resolveStage(24, 30, { stage: 'advocacy' }),
    'advocacy',
    '現場版単独取り込み時の Q24 上書き'
  )
  assert.equal(resolveStage(1, 15, { stage: 'empathy' }), 'empathy', '対応表が無くても上書きは効く')
  assert.equal(resolveStage(9, 32, { stage: 'invalid' }), 'awareness', '不正な値は無視して対応表を使う')
  assert.equal(resolveStage(9, 32, { stage: 123 }), 'awareness', '文字列以外も無視する')
}

// ── 32問構成が全段階を漏れなく覆っている ────────────
{
  const seen = new Set<string>()
  for (let i = 1; i <= 32; i++) {
    const s = resolveStage(i, 32)
    assert.ok(s !== null, `Q${i} に段階が割り当てられていない`)
    seen.add(s)
  }
  assert.deepEqual([...ALL_STAGES].sort(), [...seen].sort(), '32問で6区分すべてが使われる')
}

/** テスト用の設問を作る。avgScore は全設問共通の count を持つ */
function q(
  sortOrder: number,
  category: string,
  avgScore: number,
  count = 100
): FunnelInputQuestion {
  return {
    questionId: `q${sortOrder}`,
    questionText: `設問${sortOrder}`,
    sortOrder,
    category,
    avgScore,
    count,
  }
}

/** 32問ぶんを生成する。scoreByStage で段階ごとの値を指定する */
function build32(scoreByStage: Record<string, number>, overrides: Partial<Record<number, Partial<FunnelInputQuestion>>> = {}): FunnelInputQuestion[] {
  return Array.from({ length: 32 }, (_, i) => {
    const sortOrder = i + 1
    const stage = resolveStage(sortOrder, 32)!
    const base = q(sortOrder, 'why', scoreByStage[stage])
    return { ...base, ...(overrides[sortOrder] ?? {}) }
  })
}

// ── 段階スコアの正規化式 ────────────────────────
{
  // 全段階の平均を 3.0 にすると (3-1)/4*100 = 50
  const result = calcFunnel(build32({
    awareness: 3, understanding: 3, empathy: 3, behavior: 3, advocacy: 3, environment: 3,
  }))
  assert.ok(result)
  for (const s of result.stages) {
    assert.equal(s.score, 50, `${s.stage} は 50 になる`)
    assert.equal(s.avg, 3)
  }
  // 5 → 100、1 → 0
  const high = calcFunnel(build32({
    awareness: 5, understanding: 5, empathy: 5, behavior: 5, advocacy: 5, environment: 1,
  }))!
  assert.equal(high.stages.find((s) => s.stage === 'awareness')!.score, 100)
  assert.equal(high.stages.find((s) => s.stage === 'environment')!.score, 0)
}

// ── 回答数による重み付け ──────────────────────
{
  // 認知は Q9,14,15,18 の4問。1問だけ極端な値かつ回答数が少ないケース
  const input = build32(
    { awareness: 4, understanding: 3, empathy: 3, behavior: 3, advocacy: 3, environment: 3 },
    { 9: { avgScore: 1, count: 10 } } // 少数回答の外れ値
  )
  const result = calcFunnel(input)!
  const awareness = result.stages.find((s) => s.stage === 'awareness')!
  // 加重平均: (1*10 + 4*100*3) / (10 + 300) = 1210/310 = 3.9032...
  assert.equal(awareness.avg, 3.9, '回答数10の外れ値は寄与が小さい')

  // 単純平均だと (1+4+4+4)/4 = 3.25 になってしまう → そうなっていないこと
  assert.notEqual(awareness.avg, 3.25, '単純平均になっていないこと')
}

// ── 転換率・増減・ボトルネック・最弱段階 ──────────
{
  const result = calcFunnel(build32({
    awareness: 3, understanding: 3, empathy: 3, behavior: 2, advocacy: 3, environment: 3,
  }))!
  // awareness=50, understanding=50, empathy=50, behavior=25, advocacy=50
  assert.equal(result.transitions.length, 4)
  assert.equal(result.transitions[2].rate, 50, '共感50 → 行動25 は 50%')
  assert.equal(result.transitions[2].delta, -25)
  assert.equal(result.bottleneck.from, 'empathy')
  assert.equal(result.bottleneck.to, 'behavior')
  assert.equal(result.weakestStage, 'behavior')
}

// ── パターン判定（上流の異常から順に） ────────────
{
  const pattern = (s: Record<string, number>) => calcFunnel(build32(s))!.pattern

  // 共感(4.0→75) − 理解(3.0→50) = 25pt ≧ 5 → 共感先行型
  assert.equal(
    pattern({ awareness: 3, understanding: 3, empathy: 4, behavior: 3, advocacy: 3, environment: 3 }),
    'empathy_first'
  )
  // 共感先行に該当せず、行動 − 共感 ≧ 5 → 行動先行型
  assert.equal(
    pattern({ awareness: 3, understanding: 3, empathy: 3, behavior: 4, advocacy: 4, environment: 3 }),
    'behavior_first'
  )
  // 上2つに該当せず、行動 − 推奨 ≧ 10 → 内向き型
  assert.equal(
    pattern({ awareness: 4, understanding: 4, empathy: 4, behavior: 4, advocacy: 3, environment: 3 }),
    'inward'
  )
  // どれにも該当しない → 単調減衰型
  assert.equal(
    pattern({ awareness: 3, understanding: 3, empathy: 3, behavior: 3, advocacy: 3, environment: 3 }),
    'monotonic_decay'
  )
  // 判定順の確認: 共感先行と内向きが同時に成り立つとき、上流の共感先行を採る
  assert.equal(
    pattern({ awareness: 3, understanding: 3, empathy: 5, behavior: 5, advocacy: 3, environment: 3 }),
    'empathy_first'
  )
}

// ── 最下位設問 ────────────────────────────────
{
  const input = build32(
    { awareness: 4, understanding: 3, empathy: 3, behavior: 3, advocacy: 3, environment: 3 },
    { 14: { avgScore: 2.5, questionText: '一番低い設問' } }
  )
  const result = calcFunnel(input)!
  const awareness = result.stages.find((s) => s.stage === 'awareness')!
  assert.equal(awareness.weakest?.questionText, '一番低い設問')
  assert.equal(awareness.weakest?.avgScore, 2.5)
}

// ── マトリクス: 該当設問が無い組み合わせは undefined ──
{
  const input = build32({
    awareness: 3, understanding: 3, empathy: 3, behavior: 3, advocacy: 3, environment: 3,
  }).map((x) => ({ ...x, category: 'why' })) // 全部 why にする
  const result = calcFunnel(input)!
  assert.ok(result.matrix.why.awareness, 'why×認知 は存在する')
  assert.equal(result.matrix.how.awareness, undefined, 'how の設問が無いのでセルなし')
  assert.equal(result.matrix.what.behavior, undefined)
}

// ── 5段階が揃わなければ null ────────────────────
{
  // 推奨（6,22,23,32）のスコアを全部 null にする
  const input = build32({
    awareness: 3, understanding: 3, empathy: 3, behavior: 3, advocacy: 3, environment: 3,
  }).map((x) =>
    [6, 22, 23, 32].includes(x.sortOrder) ? { ...x, avgScore: null } : x
  )
  assert.equal(calcFunnel(input), null, '推奨が空なら描画しない')

  // 対応表の無い設問数（15問）も null
  const unmapped: FunnelInputQuestion[] = Array.from({ length: 15 }, (_, i) =>
    q(i + 1, 'why', 3)
  )
  assert.equal(calcFunnel(unmapped), null, '段階未設定のサーベイでは描画しない')

  assert.equal(calcFunnel([]), null, '空でも落ちない')
}

// ── 段階未設定の設問数を数える ──────────────────
{
  // 32問構成に1問足して33問にすると対応表が引けなくなる
  const input = [...build32({
    awareness: 3, understanding: 3, empathy: 3, behavior: 3, advocacy: 3, environment: 3,
  }), q(33, 'why', 3)]
  const result = calcFunnel(input)
  assert.equal(result, null, '33問は対応表が無いので null')
}

// ── environment はファネル5段階に含まれない ────────
{
  assert.equal(FUNNEL_STAGES.includes('environment' as never), false)
  assert.equal(FUNNEL_STAGES.length, 5)
  assert.equal(ALL_STAGES.length, 6)

  const result = calcFunnel(build32({
    awareness: 3, understanding: 3, empathy: 3, behavior: 3, advocacy: 3, environment: 1,
  }))!
  // environment が最低でも weakestStage には選ばれない
  assert.notEqual(result.weakestStage, 'environment')
  // 遷移にも登場しない
  assert.equal(result.transitions.some((t) => t.from === 'environment' || t.to === 'environment'), false)
}

console.log('✓ funnel-stages: 全テスト通過')
