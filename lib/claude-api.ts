// Claude API ユーティリティ（サーバーサイド専用）
import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
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
}): Promise<string> {
  const client = getClient()

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
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
          model: 'claude-sonnet-4-20250514',
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
