// ブランドパーソナリティ診断 セッション取得・更新API
// GET  /api/tools/personality/sessions/[sessionId] — セッション取得
// PATCH /api/tools/personality/sessions/[sessionId] — ステップ進行・データ保存
import { createToolSessionGet, createToolSessionPatch } from '@/lib/tools/session-handlers'

// 取得・保存の処理は lib/tools/session-handlers に共通化（3ツール共通）
const config = { appType: 'personality' as const, logTag: 'PersonalitySessions' }

export const GET = createToolSessionGet(config)
export const PATCH = createToolSessionPatch(config)
