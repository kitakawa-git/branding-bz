// 表現ルール（governance_rules）の表示定義。スーパー管理・診断ツールなど複数箇所で共有する。
// 純データ＋純関数のみ（React・DOM・DBに依存しない）。
// ※ scope はUIから撤去済み（注入絞り込みが未接続のため）。ここでも扱わない。

export const RULE_TYPES: { value: string; label: string }[] = [
  { value: 'banned_word', label: '禁止ワード' },
  { value: 'discouraged_expression', label: '非推奨表現' },
  { value: 'tone_rule', label: 'トーンルール' },
  { value: 'claim_rule', label: '主張ルール' },
  { value: 'compliance_rule', label: 'コンプラルール' },
]

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

/** 表示順: severity（絶対遵守→原則遵守→参考）→ sort_order */
const SEVERITY_ORDER: Record<string, number> = { block: 0, warn: 1, info: 2 }
export function compareRulesForDisplay(
  a: { severity: string; sort_order: number },
  b: { severity: string; sort_order: number },
): number {
  return (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) || a.sort_order - b.sort_order
}
