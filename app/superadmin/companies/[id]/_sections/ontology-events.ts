// ブランドオントロジーカード内のコンポーネント間イベント名（疎結合な同期用）。
// - ONTOLOGY_DATA_CHANGED_EVENT: ステップパネル内のCRUDが発火。ウィザード（ステップ判定）・
//   ハブ（件数/点検/島チップ）・常設ブランドマップが購読して再取得する。
// - ONTOLOGY_GOTO_STEP_EVENT: ハブのクイックアクション→該当ステップへの切替（detail: ステップ番号）。
export const ONTOLOGY_DATA_CHANGED_EVENT = 'ontology-data-changed'
export const ONTOLOGY_GOTO_STEP_EVENT = 'ontology-goto-step'

/** ステップ遷移と一緒に「この要素の繋ぎ先を考えたい」を伝えるための焦点要素 */
export type OntologyFocusRef = { kind: string; id: string; label: string }

/**
 * 遷移イベントの detail。数値だけの旧形式も受ける（既存の呼び出しを壊さないため）。
 * focus 付きの場合は遷移先ステップ側が焦点パネルを出す。
 */
export type OntologyGotoDetail = number | { step: number; focus?: OntologyFocusRef | null }

/** detail を { step, focus } に正規化する。step が数値でなければ null */
export function parseGotoDetail(detail: unknown): { step: number; focus: OntologyFocusRef | null } | null {
  if (typeof detail === 'number') return { step: detail, focus: null }
  if (!detail || typeof detail !== 'object') return null
  const o = detail as { step?: unknown; focus?: unknown }
  if (typeof o.step !== 'number') return null
  const f = o.focus as OntologyFocusRef | null | undefined
  const focus =
    f && typeof f.kind === 'string' && typeof f.id === 'string' && f.id
      ? { kind: f.kind, id: f.id, label: typeof f.label === 'string' ? f.label : '' }
      : null
  return { step: o.step, focus }
}
