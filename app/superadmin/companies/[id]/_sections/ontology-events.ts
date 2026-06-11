// ブランドオントロジーカード内のコンポーネント間イベント名（疎結合な同期用）。
// - ONTOLOGY_DATA_CHANGED_EVENT: ステップパネル内のCRUDが発火。ウィザード（ステップ判定）・
//   ハブ（件数/点検/島チップ）・常設ブランドマップが購読して再取得する。
// - ONTOLOGY_GOTO_STEP_EVENT: ハブのクイックアクション→該当ステップへの切替（detail: ステップ番号）。
export const ONTOLOGY_DATA_CHANGED_EVENT = 'ontology-data-changed'
export const ONTOLOGY_GOTO_STEP_EVENT = 'ontology-goto-step'
