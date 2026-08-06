// メンバー区分（経営層/管理職/従業員）の唯一の定義源。
// profiles.role_category に保存し、管理画面のセレクトとポータルの表示出し分けの両方から参照する。
// サーベイの role_category（executive/manager/staff）と同じ語彙にそろえてある。

export type MemberRole = 'executive' | 'manager' | 'staff'

// 表示順つきの選択肢（管理画面のセレクトはこれを map して作る）
export const MEMBER_ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: 'executive', label: '経営層' },
  { value: 'manager', label: '管理職' },
  { value: 'staff', label: '従業員' },
]

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  executive: '経営層',
  manager: '管理職',
  staff: '従業員',
}

// 区分の表示ラベル（未設定は空文字を返す）
export function memberRoleLabel(role: string | null | undefined): string {
  return role ? MEMBER_ROLE_LABELS[role as MemberRole] ?? '' : ''
}

// 「従業員」かどうか。
// 未設定（null）は従業員扱いにしない＝既存メンバーの表示を勝手に減らさない安全側。
export function isStaffRole(role: string | null | undefined): boolean {
  return role === 'staff'
}

// ===== 区分ごとのポータル表示設定 =====
// 管理画面「設定」の「区分ごとの表示設定」で会社ごとに編集し、
// companies.portal_role_visibility(jsonb) に保存する。ポータルの出し分けはこれを唯一の判定源にする。

// 区分で出し分けできるポータルページ（会社レベルの機能トグルがあるものを対象）。
// featureKey が false の会社ではそもそも非表示なので、区分設定は「機能が有効な会社」でのみ効く。
// featureKey が無いページ（サーベイ結果など）は会社レベルの機能トグルを持たず、区分のみで出し分ける。
export const GATEABLE_PORTAL_PAGES: { key: string; label: string; featureKey?: string }[] = [
  { key: 'kpi', label: '目標・KPI', featureKey: 'kpi_enabled' },
  { key: 'timeline', label: 'タイムライン', featureKey: 'timeline_enabled' },
  { key: 'learning', label: 'ラーニング', featureKey: 'learning_enabled' },
  { key: 'survey', label: 'サーベイ結果' },
  { key: 'brand_score', label: 'ブランドスコア' },
]

export type RoleVisibilityConfig = Record<string, Partial<Record<MemberRole, boolean>>>

// 既定値: 目標・KPI とサーベイ結果は従業員に非表示、それ以外は全区分に表示。
export const DEFAULT_ROLE_VISIBILITY: RoleVisibilityConfig = {
  kpi: { executive: true, manager: true, staff: false },
  timeline: { executive: true, manager: true, staff: true },
  learning: { executive: true, manager: true, staff: true },
  survey: { executive: true, manager: true, staff: false },
  brand_score: { executive: true, manager: true, staff: false },
}

// 指定ページを、その区分のメンバーが見られるか。
// 管理者・区分未設定は常に true。機能トグル自体のオン/オフは呼び出し側で別途 AND すること。
export function isPortalPageVisibleForRole(
  company: Record<string, unknown> | null | undefined,
  pageKey: string,
  roleCategory: string | null | undefined,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true
  if (!roleCategory) return true
  const role = roleCategory as MemberRole
  const stored = (company?.portal_role_visibility as RoleVisibilityConfig | undefined)?.[pageKey]
  return stored?.[role] ?? DEFAULT_ROLE_VISIBILITY[pageKey]?.[role] ?? true
}

// 設定画面の初期表示・保存用に、保存値と既定値をマージした完全な設定を返す。
export function resolveRoleVisibility(
  company: Record<string, unknown> | null | undefined,
): RoleVisibilityConfig {
  const stored = (company?.portal_role_visibility as RoleVisibilityConfig | undefined) ?? {}
  const result: RoleVisibilityConfig = {}
  for (const page of GATEABLE_PORTAL_PAGES) {
    const def = DEFAULT_ROLE_VISIBILITY[page.key] ?? {}
    const s = stored[page.key] ?? {}
    result[page.key] = {
      executive: s.executive ?? def.executive ?? true,
      manager: s.manager ?? def.manager ?? true,
      staff: s.staff ?? def.staff ?? true,
    }
  }
  return result
}
