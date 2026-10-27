// ブランドパーソナリティ診断 セッション作成API
// POST /api/tools/personality/sessions
import { createToolSessionPost } from '@/lib/tools/session-handlers'

// パーソナリティ診断セッションのデフォルトデータ
const DEFAULT_SESSION_DATA = {
  current_step: 1,
  basic_info: {},
  framework: '', // 'aaker' | 'archetype'（Step 1 で選択）
  answers: {},
  diagnosis: {},
  completed: false,
}

// 作成処理（進行中の復帰・月次の無料上限・新規作成）は lib/tools/session-handlers に共通化（3ツール共通）

export const POST = createToolSessionPost({
  appType: 'personality',
  logTag: 'PersonalitySessions',
  defaultSessionData: DEFAULT_SESSION_DATA,
  createFailedLog: 'セッション作成失敗',
})
