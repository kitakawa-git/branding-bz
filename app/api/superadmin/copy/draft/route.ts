// コピーAI ドラフト生成API（superadmin限定・書込）
// POST /api/superadmin/copy/draft  { projectId, role, register, injectOntology? }
//   → project から company/persona/brief を引き（company_id はサーバ側で再取得＝所有検証）、
//     generateCopyDraft を実行。bodies を copy_drafts に 1案=1行で INSERT し、INSERT 行を返す。
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { generateCopyDraft } from '@/lib/copy/generate'
import { COPY_ROLE_MATRIX, type CopyRole, type Register } from '@/lib/copy/role-matrix'

const GENERATION_MODEL = 'claude-sonnet-4-6'
const VALID_REGISTERS: Register[] = ['casual', 'neutral', 'formal', 'reverent']

async function requireSuperadmin(request: NextRequest): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, res: NextResponse.json({ error: '認証が必要です。再ログインしてください。' }, { status: 401 }) }
  }
  const token = authHeader.replace('Bearer ', '')
  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
  if (authError || !user) {
    return { ok: false, res: NextResponse.json({ error: '認証エラー: セッションが無効です。' }, { status: 401 }) }
  }
  const supabaseAdmin = getSupabaseAdmin()
  const { data: adminUser } = await supabaseAdmin
    .from('admin_users')
    .select('is_superadmin')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!adminUser?.is_superadmin) {
    return { ok: false, res: NextResponse.json({ error: 'スーパー管理者権限が必要です。' }, { status: 403 }) }
  }
  return { ok: true }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireSuperadmin(request)
    if (!guard.ok) return guard.res

    const body = await request.json().catch(() => ({}))
    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : ''
    const role = body.role as CopyRole
    const register: Register = VALID_REGISTERS.includes(body.register) ? body.register : 'neutral'
    const injectOntology = body.injectOntology === false ? false : true

    if (!projectId) return NextResponse.json({ error: 'projectId は必須です' }, { status: 400 })
    if (!role || !(role in COPY_ROLE_MATRIX)) {
      return NextResponse.json({ error: `role が不正です（${Object.keys(COPY_ROLE_MATRIX).join(' / ')}）` }, { status: 400 })
    }

    // project をサーバ側で再取得し company_id を確定（クライアントの company を信用しない＝所有検証）
    const supabaseAdmin = getSupabaseAdmin()
    const { data: project, error: projErr } = await supabaseAdmin
      .from('copy_projects')
      .select('id, company_id, persona_id, brief')
      .eq('id', projectId)
      .maybeSingle()
    if (projErr) {
      console.error('[copy/draft] project 取得エラー:', projErr)
      return NextResponse.json({ error: 'プロジェクトの取得に失敗しました' }, { status: 500 })
    }
    if (!project) return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })

    // 人間ゲートで選択済みのインサイト本文・切り口をサーバ側で取得（クライアントから本文は受け取らない）。
    // 無ければ従来どおり brief 駆動。injectOntology=false（ベースライン）では注入しない。
    let chosenInsight: string | undefined
    let chosenAngle: string | undefined
    if (injectOntology) {
      const [{ data: selInsight }, { data: selAngle }] = await Promise.all([
        supabaseAdmin.from('copy_insights').select('body').eq('project_id', project.id).eq('is_selected', true).order('created_at', { ascending: true }).limit(1).maybeSingle(),
        supabaseAdmin.from('copy_angles').select('stance, premise').eq('project_id', project.id).eq('is_selected', true).order('created_at', { ascending: true }).limit(1).maybeSingle(),
      ])
      chosenInsight = selInsight?.body ?? undefined
      chosenAngle = selAngle ? [selAngle.stance, selAngle.premise ? `（根拠: ${selAngle.premise}）` : ''].filter(Boolean).join('') : undefined
    }

    const { bodies, injectedProofIds } = await generateCopyDraft({
      companyId: project.company_id,
      role,
      register,
      brief: project.brief ?? undefined,
      personaId: project.persona_id ?? undefined,
      chosenInsight,
      chosenAngle,
      injectOntology,
    })

    const rows = bodies.map((b) => ({
      project_id: project.id,
      copy_role: role,
      register,
      body: b,
      status: 'draft',
      generation_meta: {
        role,
        register,
        model: GENERATION_MODEL,
        pipeline: 'v1',
        injectedProofIds,
        injectOntology,
      },
    }))

    const { data: drafts, error: insErr } = await supabaseAdmin
      .from('copy_drafts')
      .insert(rows)
      .select('*')
    if (insErr) {
      console.error('[copy/draft] INSERT エラー:', insErr)
      return NextResponse.json({ error: 'ドラフトの保存に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ drafts })
  } catch (err) {
    console.error('[copy/draft] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
