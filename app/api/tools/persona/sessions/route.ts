// ペルソナビルダー セッション作成API
// POST /api/tools/persona/sessions
import { createToolSessionPost } from '@/lib/tools/session-handlers'

// ペルソナセッションのデフォルトデータ
const DEFAULT_SESSION_DATA = {
  current_step: 1,
  basic_info: {},
  target_info: {},
  demographics: {},
  goals: {},
  journey_map: {},
  completed: false,
}

// 作成処理（進行中の復帰・月次の無料上限・新規作成）は lib/tools/session-handlers に共通化（3ツール共通）

export const POST = createToolSessionPost({
  appType: 'persona',
  logTag: 'PersonaSessions',
  defaultSessionData: DEFAULT_SESSION_DATA,
  createFailedLog: 'ステップ3失敗',
})
