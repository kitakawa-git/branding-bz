// オントロジー出力テストAPI（superadmin限定・読み取り専用・DB書込なし）
// POST /api/superadmin/output-test  body: { companyId, topic }
// 同じお題で「注入あり/なし」の2回生成を行い比較結果を返す（手動実行のみ・結果は永続化しない）。
// コスト: 1テスト＝Claude 2回呼び出し（注入データ皆無の会社は1回で A=B）。
import { NextRequest, NextResponse } from 'next/server'
import { runOutputTest } from '@/lib/brand/output-test'
import { OUTPUT_TEST_TOPICS, type OutputTestTopic } from '@/lib/brand/output-test-types'
import { requireSuperadmin } from '@/lib/auth/caller'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const companyId = body?.companyId as string | undefined
    const topic = body?.topic as OutputTestTopic | undefined
    if (!companyId) {
      return NextResponse.json({ error: 'companyId は必須です' }, { status: 400 })
    }
    if (!topic || !OUTPUT_TEST_TOPICS.some((t) => t.value === topic)) {
      return NextResponse.json({ error: 'topic が不正です' }, { status: 400 })
    }

    // superadmin 認証（判定は lib/auth/caller に一本化。Bearer と cookie の両方を受ける）
    const caller = await requireSuperadmin(request)
    if (caller.error) return caller.error

    const result = await runOutputTest(companyId, topic)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[output-test] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
