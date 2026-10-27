// ブランドプロファイリング 回答構造化API（superadmin限定）
// POST /api/superadmin/profiling/structure  body: { question, answer }
// 自由記述回答を Claude で構造化草案に変換して返すだけ。DBへは書き込まない
// （登録はUIでの承認後、クライアント supabase INSERT。Claude を呼ぶため POST・明示実行のみ）。
import { NextRequest, NextResponse } from 'next/server'
import { structureAnswer, type ProfilingQuestion } from '@/lib/brand/profiling'
import { requireSuperadmin } from '@/lib/auth/caller'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const question = body?.question as ProfilingQuestion | undefined
    const answer = body?.answer as string | undefined
    if (!question?.type || typeof answer !== 'string' || !answer.trim()) {
      return NextResponse.json({ error: 'question と answer は必須です' }, { status: 400 })
    }
    if (question.type !== 'unproven_promise' && question.type !== 'no_governance') {
      return NextResponse.json({ error: 'この質問種別は構造化の対象外です' }, { status: 400 })
    }

    // superadmin 認証（判定は lib/auth/caller に一本化。Bearer と cookie の両方を受ける）
    const caller = await requireSuperadmin(request)
    if (caller.error) return caller.error

    const { draft, reason } = await structureAnswer(question, answer)
    return NextResponse.json({ draft, reason })
  } catch (err) {
    console.error('[profiling/structure] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
