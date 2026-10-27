// ペルソナビルダー セッション取得・更新API
// GET  /api/tools/persona/sessions/[sessionId] — セッション取得
// PATCH /api/tools/persona/sessions/[sessionId] — ステップ進行・データ保存
import { createToolSessionGet, createToolSessionPatch } from '@/lib/tools/session-handlers'

// 取得・保存の処理は lib/tools/session-handlers に共通化（3ツール共通）
const config = { appType: 'persona' as const, logTag: 'PersonaSessions' }

export const GET = createToolSessionGet(config)
export const PATCH = createToolSessionPatch(config)
