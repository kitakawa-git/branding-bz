// 表現ルール（governance_rules）の表示定義。スーパー管理・診断ツールなど複数箇所で共有する。
// 純データ＋純関数のみ（React・DOM・DBに依存しない）。
// ※ scope はUIから撤去済み（注入絞り込みが未接続のため）。ここでも扱わない。

// 区分は3つ（DBの CHECK 制約と一致・20260721113654 で5→3に統合）。
// 旧 claim_rule / discouraged_expression は compliance_rule へ統合済み。
export const RULE_TYPES: { value: string; label: string; hint: string }[] = [
  { value: 'banned_word', label: '禁止ワード', hint: '使ってはいけない語そのもの（例：「必ず」「絶対」）' },
  { value: 'tone_rule', label: 'トーンルール', hint: '話し方・語り口（例：専門用語を避ける、問いかけで締める）' },
  {
    value: 'compliance_rule',
    label: 'コンプラルール',
    hint: '法令や自社方針として、根拠なく言い切ってはいけないこと（例：業界No.1、必ず成果が出ます、地域最安値）',
  },
]
/** AI分類が判定に迷ったときの寄せ先 */
export const FALLBACK_RULE_TYPE = 'compliance_rule'

export const SEVERITIES: { value: string; label: string; cls: string }[] = [
  { value: 'block', label: '絶対遵守', cls: 'bg-red-100 text-red-700' },
  { value: 'warn', label: '原則遵守', cls: 'bg-amber-100 text-amber-800' },
  { value: 'info', label: '参考', cls: 'bg-gray-100 text-gray-600' },
]

// governance_rules.source → 表示名。DBの CHECK 制約が 'manual' | 'personality_diagnosis' に
// 限定しているため、この2種類しか入らない（AI草案から登録した分も 'manual' に含まれ区別できない）。
// 未知の値はそのまま出す（勝手に「手入力」に丸めない＝出所を偽らない）。
const SOURCE_LABELS: Record<string, string> = {
  manual: '手入力',
  personality_diagnosis: '診断由来',
}

export const ruleTypeLabel = (v: string | null) =>
  RULE_TYPES.find((x) => x.value === v)?.label ?? v ?? '—'
export const severityMeta = (v: string) => SEVERITIES.find((s) => s.value === v)
export const sourceLabel = (v: string | null) => (v ? SOURCE_LABELS[v] ?? v : '手入力')

// 診断の severity（low/medium/high）→ governance_rules の語彙（info/warn/block）。
// connect API と同じ対応表（表示でも同じ見え方にする）。
export const diagnosisSeverityToRule = (v: string): string =>
  v === 'high' ? 'block' : v === 'low' ? 'info' : 'warn'

/**
 * ルール本文の照合用の正規化。trim＋空白（全角含む）の圧縮のみ。
 * 表記ゆれの吸収はしない＝完全一致のみで判定する（過剰な曖昧マッチで別ルールを同一視しない）。
 */
export const normalizeRuleText = (s: string | null | undefined): string =>
  (s || '').replace(/[\s　]+/g, ' ').trim()

/**
 * 診断の提案のうち「まだDBに登録されていないもの」だけを返す。
 * 既に登録済み（＝同じ本文が governance_rules にある）ものは重複表示しないため除く。
 */
export function unregisteredProposals<T extends { rule_text: string }>(
  registeredTexts: (string | null | undefined)[],
  proposals: T[],
): T[] {
  const known = new Set(registeredTexts.map(normalizeRuleText).filter(Boolean))
  const seen = new Set<string>()
  return proposals.filter((p) => {
    const key = normalizeRuleText(p.rule_text)
    if (!key || known.has(key) || seen.has(key)) return false
    seen.add(key) // 提案側の重複も1回だけ
    return true
  })
}

/** 表示順: severity（絶対遵守→原則遵守→参考）→ sort_order */
const SEVERITY_ORDER: Record<string, number> = { block: 0, warn: 1, info: 2 }
export function compareRulesForDisplay(
  a: { severity: string; sort_order: number },
  b: { severity: string; sort_order: number },
): number {
  return (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) || a.sort_order - b.sort_order
}
