// STP分析ツール セッション作成API
// POST /api/tools/stp/sessions
// ログイン中のユーザーのセッション作成（進行中があればそれを返す）
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireSelf } from '@/lib/auth/caller'
import { createToolSessionPost } from '@/lib/tools/session-handlers'

// STPセッションのデフォルトデータ
const DEFAULT_SESSION_DATA = {
  current_step: 1,
  basic_info: {
    company_name: '',
    industry_category: '',
    industry_subcategory: '',
    business_descriptions: [] as Array<{ title: string; description: string }>,
    target_segments: [] as Array<{ name: string; description: string }>,
    competitors: [] as Array<{ name: string; url: string }>,
  },
  segmentation: {
    mode: 'ai',
    variables: [],
  },
  targeting: {
    evaluations: [],
    main_target: '',
    sub_targets: [],
    target_description: '',
  },
  positioning: {
    x_axis: { left: '', right: '' },
    y_axis: { bottom: '', top: '' },
    items: [],
  },
  completed: false,
}

// 作成処理（進行中の復帰・月次の無料上限・新規作成）は lib/tools/session-handlers に共通化（3ツール共通）

// GET /api/tools/stp/sessions?userId= — ユーザーのSTPセッション一覧（履歴選択UI用）
export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const self = await requireSelf(request, request.nextUrl.searchParams.get('userId'))
    if (self.error) return self.error
    const userId = self.authId
    const { data, error } = await supabaseAdmin
      .from('mini_app_sessions')
      .select('id, status, current_step, session_data, created_at, updated_at')
      .eq('user_id', userId)
      .eq('app_type', 'stp')
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(50)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const sessions = (data || []).map((s) => {
      const sd = (s.session_data || {}) as {
        basic_info?: { company_name?: string }
        targeting?: { main_target?: string }
      }
      return {
        id: s.id,
        status: s.status,
        current_step: s.current_step,
        company_name: sd.basic_info?.company_name || '',
        main_target: sd.targeting?.main_target || '',
        created_at: s.created_at,
        updated_at: s.updated_at,
      }
    })
    return NextResponse.json({ sessions })
  } catch (err) {
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}

export const POST = createToolSessionPost({
  appType: 'stp',
  logTag: 'STPSessions',
  defaultSessionData: DEFAULT_SESSION_DATA,
  createFailedLog: 'ステップ3失敗',
})
