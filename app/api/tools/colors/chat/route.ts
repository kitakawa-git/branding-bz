// カラー調整チャットAPI（SSEストリーミング）
// POST /api/tools/colors/chat
import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { streamClaude } from '@/lib/claude-api'
import { FREE_LIMITS } from '@/lib/types/color-tool'
import type { PaletteProposal } from '@/lib/types/color-tool'

const SYSTEM_PROMPT = `あなたはID INC.のシニアブランドコンサルタントです。
ユーザーが選択したカラーパレットの調整をサポートしています。

## 役割
- ユーザーのリクエストに応じて、パレットの色を調整する提案をする
- 色彩心理学・ブランディングの知識に基づいたアドバイスを提供する
- アクセシビリティ（WCAG 2.1 AA）を維持しながら調整を行う

## 応答ルール
1. テキストの応答は簡潔に（100〜200文字程度）
2. 必ず説明テキストを最初に書き、paletteブロックは応答の一番最後に置くこと
3. 具体的な色の変更を提案する場合は、必ず以下のJSON形式を応答の末尾に含める:

\`\`\`palette
{パレットの完全なJSON（PaletteProposal形式）}
\`\`\`

4. 色の変更を提案しない一般的な回答の場合は、テキストのみで応答する
5. 複数の選択肢を出す場合は、最も推奨する案を1つのpaletteブロックとして出す
6. 専門用語を避け、わかりやすい言葉で説明する
7. paletteブロック以外の場所にJSONデータやカラーコードの羅列を書かないこと

## 重要
- palette JSONブロックは応答内に最大1つまで
- HEX値は必ず#付き6桁（例: #1A73E8）
- rgb値も正確に算出する
- name（日本語の色名）も必ず付与する
- secondaryは1〜2色の配列
- neutralsはlightとdarkの両方を含む`

export async function POST(request: NextRequest) {
  console.log('[ColorChat] ===== チャットAPI呼び出し =====')

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { sessionId, message, currentPalette, history } = await request.json() as {
      sessionId: string
      message: string
      currentPalette: PaletteProposal
      history: { role: 'user' | 'assistant'; content: string }[]
    }

    if (!sessionId || !message) {
      return new Response(JSON.stringify({ error: 'sessionId と message が必要です' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // プロジェクト取得＋ターン数チェック
    const { data: project } = await supabaseAdmin
      .from('brand_color_projects')
      .select('adjustment_count')
      .eq('session_id', sessionId)
      .single()

    if (!project) {
      return new Response(JSON.stringify({ error: 'プロジェクトが見つかりません' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (project.adjustment_count >= FREE_LIMITS.chatTurnsPerSession) {
      return new Response(
        JSON.stringify({ error: `チャット回数の上限（${FREE_LIMITS.chatTurnsPerSession}回）に達しました。` }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 会話履歴にユーザーメッセージを保存
    await supabaseAdmin.from('mini_app_conversations').insert({
      session_id: sessionId,
      role: 'user',
      content: message,
    })

    // adjustment_count をインクリメント
    await supabaseAdmin
      .from('brand_color_projects')
      .update({ adjustment_count: project.adjustment_count + 1 })
      .eq('session_id', sessionId)

    // メッセージ構築（現在のパレット情報をコンテキストに追加）
    const paletteContext = `\n\n[現在のパレット]\n${JSON.stringify(currentPalette, null, 2)}`
    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      // 過去の会話履歴
      ...history.slice(-8), // 最新8ターンのみ送信
      // ユーザーの新しいメッセージ
      { role: 'user' as const, content: message + paletteContext },
    ]

    // ストリーミングレスポンス
    const stream = streamClaude({
      system: SYSTEM_PROMPT,
      messages,
      maxTokens: 2048,
    })

    // アシスタント応答を蓄積して保存するためのトランスフォーム
    let fullResponse = ''
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const transformedStream = new ReadableStream({
      async start(controller) {
        const reader = stream.getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const text = decoder.decode(value, { stream: true })
            controller.enqueue(encoder.encode(text))

            // テキストチャンクを蓄積
            const lines = text.split('\n')
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6))
                  if (data.type === 'text') {
                    fullResponse += data.content
                  }
                } catch {
                  // JSON パース失敗は無視
                }
              }
            }
          }
        } finally {
          reader.releaseLock()
        }

        // アシスタント応答をDB保存
        if (fullResponse) {
          await supabaseAdmin.from('mini_app_conversations').insert({
            session_id: sessionId,
            role: 'assistant',
            content: fullResponse,
          })

          // パレット変更があればDB更新
          const paletteMatch = fullResponse.match(/```palette\s*([\s\S]*?)\s*```/)
          if (paletteMatch) {
            try {
              const updatedPalette = JSON.parse(paletteMatch[1])
              await supabaseAdmin
                .from('brand_color_projects')
                .update({ current_palette: updatedPalette })
                .eq('session_id', sessionId)

              // パレット更新イベントを追加送信
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'palette', content: updatedPalette })}\n\n`)
              )
            } catch {
              console.error('[ColorChat] パレットJSONパースエラー')
            }
          }
        }

        controller.close()
      },
    })

    return new Response(transformedStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    console.error('[ColorChat] エラー:', err)
    return new Response(
      JSON.stringify({ error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
