// STP分析ツール branding.bz連携API
// GET  /api/tools/stp/connect?sessionId=&companyId= — 連携プレフライト（既存値の有無）
// POST /api/tools/stp/connect — 選択された項目のみ brand_personas / companies に反映
//
// 書き込み先マッピング（/admin/brand/strategy の表示元と一致させる）:
// - segmentation → brand_personas[0].segmentation_data（履歴・後方互換のため保持）
// - targeting    → brand_personas[0].target（ターゲット概要文）
//                + companies.target_segments（主なターゲット一覧 [{name, description}]）
// - positioning  → brand_personas[0].positioning_map_data
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

interface SegmentNode { name: string; description?: string; selected?: boolean }
interface VariableNode { name?: string; segments?: SegmentNode[] }

// セグメンテーション結果から、指定された name の description を引く
function findSegmentDescription(segmentation: { variables?: VariableNode[] } | null | undefined, name: string): string {
  if (!segmentation?.variables) return ''
  for (const v of segmentation.variables) {
    for (const s of v.segments || []) {
      if (s?.name && s.name.trim() === name.trim()) return s.description || ''
    }
  }
  return ''
}

interface TargetingInput {
  main_target?: string
  sub_targets?: string[]
  target_description?: string
  target_summary?: string
}

// targeting + segmentation から companies.target_segments を組み立てる
function buildTargetSegments(
  targeting: TargetingInput,
  segmentation: { variables?: VariableNode[] } | null | undefined,
): Array<{ name: string; description: string }> {
  const result: Array<{ name: string; description: string }> = []
  const main = (targeting.main_target || '').trim()
  if (main) {
    // メインターゲットの description は target_description を優先（無ければセグ説明）
    const mainDesc = (targeting.target_description || '').trim() || findSegmentDescription(segmentation, main)
    result.push({ name: main, description: mainDesc })
  }
  for (const sub of targeting.sub_targets || []) {
    const name = (sub || '').trim()
    if (!name) continue
    result.push({ name, description: findSegmentDescription(segmentation, name) })
  }
  return result
}

interface Selections {
  segmentation?: boolean
  targeting?: boolean
  positioning?: boolean
}

interface Confirm {
  overwriteSegmentation?: boolean
  overwriteTargeting?: boolean
  overwritePositioning?: boolean
}

function hasPositioningContent(d: unknown): boolean {
  if (!d || typeof d !== 'object') return false
  const obj = d as Record<string, unknown>
  const items = obj.items as unknown[] | undefined
  if (Array.isArray(items) && items.length > 0) return true
  const x = obj.x_axis as { left?: string; right?: string } | undefined
  const y = obj.y_axis as { bottom?: string; top?: string } | undefined
  if (x && (x.left || x.right)) return true
  if (y && (y.bottom || y.top)) return true
  return false
}

function hasSegmentationContent(d: unknown): boolean {
  if (!d || typeof d !== 'object') return false
  const vars = (d as { variables?: unknown[] }).variables
  return Array.isArray(vars) && vars.length > 0
}

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const sessionId = request.nextUrl.searchParams.get('sessionId') || ''
    const companyId = request.nextUrl.searchParams.get('companyId') || ''
    if (!sessionId || !companyId) {
      return NextResponse.json({ error: 'sessionId と companyId が必要です' }, { status: 400 })
    }

    const [{ data: rows }, { data: companyRow }] = await Promise.all([
      supabaseAdmin
        .from('brand_personas')
        .select('segmentation_data, target, positioning_map_data, sort_order')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: true }),
      supabaseAdmin
        .from('companies')
        .select('target_segments')
        .eq('id', companyId)
        .maybeSingle(),
    ])

    const first = (rows && rows[0]) || null
    const companyTargets = (companyRow?.target_segments as Array<{ name?: string }> | null) || []
    const hasTargetOverview = !!(first?.target && String(first.target).trim().length > 0)
    const hasMainTargets = Array.isArray(companyTargets) && companyTargets.some(t => (t?.name || '').trim().length > 0)

    return NextResponse.json({
      existing: {
        hasSegmentation: hasSegmentationContent(first?.segmentation_data),
        hasTarget: hasTargetOverview || hasMainTargets,
        hasPositioning: hasPositioningContent(first?.positioning_map_data),
      },
    })
  } catch (err) {
    console.error('[STP Connect GET] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { sessionId, companyId } = body as { sessionId?: string; companyId?: string }
    const selectionsRaw = (body.selections || null) as Selections | null
    const confirm = (body.confirm || {}) as Confirm

    if (!sessionId || !companyId) {
      return NextResponse.json(
        { error: 'sessionId と companyId が必要です' },
        { status: 400 }
      )
    }

    // 後方互換: selections 未指定なら全て連携
    const selections: Required<Selections> = {
      segmentation: selectionsRaw?.segmentation ?? true,
      targeting: selectionsRaw?.targeting ?? true,
      positioning: selectionsRaw?.positioning ?? true,
    }

    if (!selections.segmentation && !selections.targeting && !selections.positioning) {
      return NextResponse.json({ error: '連携する項目が選択されていません' }, { status: 400 })
    }

    // 1. セッションデータ取得
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('mini_app_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      )
    }

    const sessionData = session.session_data
    const targeting = sessionData.targeting || {}
    const positioning = sessionData.positioning || {}
    const segmentation = sessionData.segmentation || {}

    // 2. positioning_map_data 変換
    const positioningMapData = {
      x_axis: positioning.x_axis || { left: '', right: '' },
      y_axis: positioning.y_axis || { bottom: '', top: '' },
      items: (positioning.items || []).map((item: {
        name: string
        color: string
        x: number
        y: number
        is_self: boolean
      }) => ({
        name: item.name,
        color: item.color,
        x: item.x,
        y: item.y,
        size: item.is_self ? 'lg' : 'md',
      })),
    }

    // 3. 既存レコード取得
    const [{ data: existingPersonas }, { data: existingCompany }] = await Promise.all([
      supabaseAdmin
        .from('brand_personas')
        .select('id, sort_order, segmentation_data, target, positioning_map_data')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: true }),
      supabaseAdmin
        .from('companies')
        .select('target_segments')
        .eq('id', companyId)
        .maybeSingle(),
    ])

    const first = existingPersonas && existingPersonas[0]
    const existingTargetSegments = (existingCompany?.target_segments as Array<{ name?: string }> | null) || []
    const hasExistingTargetOverview = !!(first?.target && String(first.target).trim().length > 0)
    const hasExistingMainTargets =
      Array.isArray(existingTargetSegments) && existingTargetSegments.some(t => (t?.name || '').trim().length > 0)

    // 4. 上書き確認チェック（書き込み前に全て確認）
    if (first && selections.segmentation && hasSegmentationContent(first.segmentation_data) && !confirm.overwriteSegmentation) {
      return NextResponse.json(
        { error: '既存のセグメンテーションがあります。上書き確認が必要です。', needsConfirm: 'segmentation' },
        { status: 409 }
      )
    }
    if (selections.targeting && (hasExistingTargetOverview || hasExistingMainTargets) && !confirm.overwriteTargeting) {
      return NextResponse.json(
        { error: '既存のターゲットがあります。上書き確認が必要です。', needsConfirm: 'targeting' },
        { status: 409 }
      )
    }
    if (first && selections.positioning && hasPositioningContent(first.positioning_map_data) && !confirm.overwritePositioning) {
      return NextResponse.json(
        { error: '既存のポジショニングマップがあります。上書き確認が必要です。', needsConfirm: 'positioning' },
        { status: 409 }
      )
    }

    // 5. brand_personas[0] 更新内容を組み立て
    const personaUpdates: Record<string, unknown> = {}
    if (selections.segmentation) personaUpdates.segmentation_data = segmentation
    if (selections.targeting) {
      // ターゲット概要は AI生成の長文（target_summary）を優先。無ければ短いdescriptionを使う
      personaUpdates.target = (targeting.target_summary && String(targeting.target_summary).trim())
        || (targeting.target_description && String(targeting.target_description).trim())
        || null
    }
    if (selections.positioning) personaUpdates.positioning_map_data = positioningMapData

    if (Object.keys(personaUpdates).length > 0) {
      if (first) {
        const { error: updateError } = await supabaseAdmin
          .from('brand_personas')
          .update(personaUpdates)
          .eq('id', first.id)

        if (updateError) {
          console.error('[STP Connect] brand_personas更新エラー:', updateError)
          return NextResponse.json(
            { error: 'ブランド戦略の更新に失敗しました' },
            { status: 500 }
          )
        }
      } else {
        const { error: insertError } = await supabaseAdmin
          .from('brand_personas')
          .insert({
            company_id: companyId,
            name: '',
            sort_order: 0,
            ...personaUpdates,
          })

        if (insertError) {
          console.error('[STP Connect] brand_personas挿入エラー:', insertError)
          return NextResponse.json(
            { error: 'ブランド戦略の作成に失敗しました' },
            { status: 500 }
          )
        }
      }
    }

    // 6. companies.target_segments を更新（主なターゲット一覧）
    if (selections.targeting) {
      const newTargetSegments = buildTargetSegments(targeting, segmentation)
      const { error: companyError } = await supabaseAdmin
        .from('companies')
        .update({ target_segments: newTargetSegments.length > 0 ? newTargetSegments : null })
        .eq('id', companyId)

      if (companyError) {
        console.error('[STP Connect] companies.target_segments更新エラー:', companyError)
        // ここで失敗してもターゲット概要は反映済みなので warning のみ
      }
    }

    // 7. セッション完了化
    const { error: completeError } = await supabaseAdmin
      .from('mini_app_sessions')
      .update({
        session_data: { ...sessionData, completed: true },
        status: 'completed',
      })
      .eq('id', sessionId)

    if (completeError) {
      console.error('[STP Connect] セッション更新エラー:', completeError)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[STP Connect] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
