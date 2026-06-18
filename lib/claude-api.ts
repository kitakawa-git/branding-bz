// Claude API ユーティリティ（サーバーサイド専用）
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { join } from 'path'

let _client: Anthropic | null = null

// .env.local からAPIキーを直接読み取る（process.envが親プロセスに上書きされている場合のフォールバック）
function loadApiKeyFromEnvFile(): string | undefined {
  try {
    const envPath = join(process.cwd(), '.env.local')
    const content = readFileSync(envPath, 'utf-8')
    const match = content.match(/^ANTHROPIC_API_KEY=(.+)$/m)
    return match?.[1]?.trim()
  } catch {
    return undefined
  }
}

function getClient(): Anthropic {
  if (!_client) {
    // process.env を優先し、空の場合は .env.local から直接読み取る
    const apiKey = process.env.ANTHROPIC_API_KEY || loadApiKeyFromEnvFile()
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY が設定されていません。.env.local に追加してください。')
    }
    _client = new Anthropic({ apiKey })
  }
  return _client
}

/**
 * Claude API にメッセージを送信（非ストリーミング）
 */
export async function callClaude(options: {
  system: string
  userMessage: string
  maxTokens?: number
  model?: string // 既定＝生成器モデル。インスペクター等が claude-opus-4-8 を渡せる（出題者≠採点者）
}): Promise<string> {
  const client = getClient()

  const message = await client.messages.create({
    model: options.model || 'claude-sonnet-4-6',
    max_tokens: options.maxTokens || 4096,
    system: options.system,
    messages: [{ role: 'user', content: options.userMessage }],
  })

  // テキストブロックの内容を結合して返す
  const textContent = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('')

  return textContent
}

/**
 * Claude API に web_search ツール付きでメッセージを送信（非ストリーミング）
 * 実在情報の検索が必要な機能（競合提案等）で使用する。SDK初期化・モデルは callClaude と共通。
 * 戻り値は全テキストブロックを結合した文字列（検索の途中経過テキストも含む）。
 * web_search 実行失敗や API エラー時は例外を throw する（呼び出し側で 500 扱い）。
 */
export async function callClaudeWithWebSearch(options: {
  system: string
  userMessage: string
  maxTokens?: number
  maxSearchUses?: number
}): Promise<string> {
  const client = getClient()

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: options.maxTokens || 2048,
    system: options.system,
    messages: [{ role: 'user', content: options.userMessage }],
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: options.maxSearchUses ?? 5,
      },
    ],
  })

  // テキストブロックのみ結合（server_tool_use / web_search_tool_result ブロックは除外）
  const textContent = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('')

  return textContent
}

/**
 * Claude API にメッセージを送信（ストリーミング）
 * ReadableStream を返す
 */
export function streamClaude(options: {
  system: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  maxTokens?: number
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      try {
        const client = getClient()

        const stream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: options.maxTokens || 4096,
          system: options.system,
          messages: options.messages,
        })

        // content_block の種別を追跡し、thinking ブロックを除外する
        let currentBlockType = ''

        for await (const event of stream) {
          if (event.type === 'content_block_start') {
            currentBlockType = event.content_block.type // 'text' | 'thinking' 等
          }
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta' &&
            currentBlockType === 'text'
          ) {
            const chunk = `data: ${JSON.stringify({ type: 'text', content: event.delta.text })}\n\n`
            controller.enqueue(encoder.encode(chunk))
          }
        }

        // 完了イベント
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
        controller.close()
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', content: errorMsg })}\n\n`)
        )
        controller.close()
      }
    },
  })
}
