// ペルソナビルダー → brand_personas 離散カラム 写像（純関数・ユニットテスト可能）。
//
// ビルダーの suggest-goals は discrete 配列（pain_points / primary_goals / challenges ...）を
// session_data.goals に保存する。connect は従来 rich な persona_data に丸ごと埋めるだけで、
// brand_personas の離散カラム pain_points / needs を空のままにしていた。
// → コピーAI（pain_points 起点でインサイト抽出）が回らない。本写像で離散カラムへ落とす。
// rich な persona_data / journey_map_data / name は connect 側で従来どおり別途書き込む（不変）。

// 文字列配列への安全化: string はそのまま、object は title/text/label/name を拾う、その他は除外。
function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  for (const x of v) {
    if (typeof x === 'string') {
      const t = x.trim()
      if (t) out.push(t)
    } else if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>
      const cand = o.title ?? o.text ?? o.label ?? o.name
      if (typeof cand === 'string' && cand.trim()) out.push(cand.trim())
    }
    // 数値・null等は除外（pain_points/needs は文章想定）
  }
  return out
}

const str = (v: unknown): string => {
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return String(v)
  return ''
}

export type MappedPersonaColumns = {
  pain_points: string[] // 必須・コピーAIの起点（discrete のまま）
  needs: string[]
  decision_factors: string[] // Tier1: 意思決定要因（goals.decision_factors の離散化・常に出力）
  buying_barriers: string[]  // Tier1: 購買障壁（goals.buying_barriers の離散化・常に出力）
  age_range?: string // 任意（空なら出力に含めず既存値を維持）
  occupation?: string
  description?: string
  brand_expectations?: string // Tier1: ブランドへの期待（任意・空なら既存値維持）
}

/**
 * session_data（mini_app_sessions.session_data）から brand_personas の離散カラムを写像する。
 * - pain_points: goals.pain_points → 無ければ goals.challenges → 無ければ []
 * - needs:       goals.primary_goals → 無ければ []
 * - decision_factors: goals.decision_factors → 無ければ []（常に出力）
 * - buying_barriers:  goals.buying_barriers  → 無ければ []（常に出力）
 * - age_range / occupation / description / brand_expectations: 空なら出力に含めない＝既存維持
 * goals 未設定・配列でない異常系でも例外を出さず空配列を返す。
 */
export function mapSessionToPersonaColumns(sessionData: unknown): MappedPersonaColumns {
  const sd = (sessionData && typeof sessionData === 'object' ? sessionData : {}) as Record<string, unknown>
  const goals = (sd.goals && typeof sd.goals === 'object' ? sd.goals : {}) as Record<string, unknown>
  const demo = (sd.demographics && typeof sd.demographics === 'object' ? sd.demographics : {}) as Record<string, unknown>

  const pain = (() => {
    const p = toStringArray(goals.pain_points)
    return p.length > 0 ? p : toStringArray(goals.challenges)
  })()
  const needs = toStringArray(goals.primary_goals)

  const cols: MappedPersonaColumns = {
    pain_points: pain,
    needs,
    decision_factors: toStringArray(goals.decision_factors),
    buying_barriers: toStringArray(goals.buying_barriers),
  }

  // 任意カラムは値があるときだけ含める（空で既存を上書きしない）
  const age = str(demo.age)
  if (age) cols.age_range = age
  const occupation = str(demo.occupation) || str(demo.company_role)
  if (occupation) cols.occupation = occupation
  const description = [occupation, str(demo.company_size)].filter(Boolean).join('・')
  if (description) cols.description = description
  const brandExpectations = str(goals.brand_expectations)
  if (brandExpectations) cols.brand_expectations = brandExpectations

  return cols
}
