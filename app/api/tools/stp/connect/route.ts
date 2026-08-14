// STP分析ツール branding.bz連携API
// GET  /api/tools/stp/connect?sessionId=&companyId= — 連携プレフライト（既存値の有無）
// POST /api/tools/stp/connect — 選択された項目のみ brand_personas / companies に反映
//
// 書き込み先マッピング（/admin/brand/strategy の表示元と一致させる）:
// - segmentation は本体に同期しない（STPツール内の下書きデータのみ。target説明文の補完に内部参照する）
// - targeting    → brand_personas[0].target（ターゲット概要文）
//                + companies.target_segments（主なターゲット一覧 [{name, description}]）
// - positioning  → brand_personas[0].positioning_map_data
//                + companies.strengths（Step4「自社・競合の一覧」の自社=is_self項目のtraits）
//                + companies.competitors_analysis（同・競合項目のtraits [{name, traits}]）
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { guardCompanyFeature } from '@/lib/billing/guard'

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
  targeting?: boolean
  positioning?: boolean
  target_fit_map?: boolean         // 新規
  brand_stance_statements?: boolean // 新規
}

interface Confirm {
  overwriteTargeting?: boolean
  overwritePositioning?: boolean
  overwriteTargetFitMap?: boolean        // 新規
  overwriteBrandStance?: boolean          // 新規
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

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const sessionId = request.nextUrl.searchParams.get('sessionId') || ''
    const companyId = request.nextUrl.searchParams.get('companyId') || ''
    if (!sessionId || !companyId) {
      return NextResponse.json({ error: 'sessionId と companyId が必要です' }, { status: 400 })
    }

    // 本体連携は standard 以上
    const denied = await guardCompanyFeature(companyId, 'portalSync')
    if (denied) return denied

    const [{ data: rows }, { data: companyRow }] = await Promise.all([
      supabaseAdmin
        .from('brand_personas')
        .select('target, positioning_map_data, target_fit_map_data, brand_stance_statements, sort_order')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: true }),
      supabaseAdmin
        .from('companies')
        .select('target_segments, strengths, competitors_analysis')
        .eq('id', companyId)
        .maybeSingle(),
    ])

    const first = (rows && rows[0]) || null
    const companyTargets = (companyRow?.target_segments as Array<{ name?: string }> | null) || []
    const hasTargetOverview = !!(first?.target && String(first.target).trim().length > 0)
    const hasMainTargets = Array.isArray(companyTargets) && companyTargets.some(t => (t?.name || '').trim().length > 0)
    const hasTargetFitMap = !!((first?.target_fit_map_data as { x_axis?: { left?: string } })?.x_axis?.left)
    const hasBrandStance = !!((first?.brand_stance_statements as { statements?: unknown[] })?.statements?.length)

    return NextResponse.json({
      existing: {
        hasTarget: hasTargetOverview || hasMainTargets,
        hasPositioning: hasPositioningContent(first?.positioning_map_data),
        hasTargetFitMap,
        hasBrandStance,
      },
      // Step4「自社・競合の一覧」の traits 復元用（過去の connect() で companies に保存済みの自社の強み・競合分析）
      companyTraits: {
        strengths: (companyRow?.strengths as string) || '',
        competitorsAnalysis: (companyRow?.competitors_analysis as Array<{ name: string; traits: string }> | null) || [],
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

    // 本体連携は standard 以上
    const denied = await guardCompanyFeature(companyId, 'portalSync')
    if (denied) return denied

    // 後方互換: selections 未指定なら全て連携
    const selections: Required<Selections> = {
      targeting: selectionsRaw?.targeting ?? true,
      positioning: selectionsRaw?.positioning ?? true,
      target_fit_map: selectionsRaw?.target_fit_map ?? true,
      brand_stance_statements: selectionsRaw?.brand_stance_statements ?? true,
    }

    if (!selections.targeting && !selections.positioning
        && !selections.target_fit_map && !selections.brand_stance_statements) {
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

    // 2. positioning_map_data 変換（軸根拠・配置根拠・確信度も連携）
    const positioningMapData = {
      x_axis: positioning.x_axis || { left: '', right: '' },
      y_axis: positioning.y_axis || { bottom: '', top: '' },
      axis_rationale: positioning.axis_rationale || '',
      items: (positioning.items || []).map((item: {
        name: string
        color: string
        x: number
        y: number
        is_self: boolean
        reasoning?: string
        confidence?: 'high' | 'medium' | 'low'
      }) => ({
        name: item.name,
        color: item.color,
        x: item.x,
        y: item.y,
        size: item.is_self ? 'lg' : 'md',
        reasoning: item.reasoning || '',
        confidence: item.confidence || 'medium',
      })),
    }

    // 3. 既存レコード取得
    const [{ data: existingPersonas }, { data: existingCompany }] = await Promise.all([
      supabaseAdmin
        .from('brand_personas')
        .select('id, sort_order, target, positioning_map_data, target_fit_map_data, brand_stance_statements')
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
    const hasExistingFitMap = !!(first?.target_fit_map_data && (first.target_fit_map_data as { x_axis?: { left?: string } })?.x_axis?.left)
    if (first && selections.target_fit_map && hasExistingFitMap && !confirm.overwriteTargetFitMap) {
      return NextResponse.json(
        { error: '既存のターゲット適合マップがあります。上書き確認が必要です。', needsConfirm: 'target_fit_map' },
        { status: 409 }
      )
    }
    const hasExistingStance = !!((first?.brand_stance_statements as { statements?: unknown[] })?.statements?.length)
    if (first && selections.brand_stance_statements && hasExistingStance && !confirm.overwriteBrandStance) {
      return NextResponse.json(
        { error: '既存の自社の立ち位置があります。上書き確認が必要です。', needsConfirm: 'brand_stance_statements' },
        { status: 409 }
      )
    }

    // 5. brand_personas[0] 更新内容を組み立て
    const personaUpdates: Record<string, unknown> = {}
    if (selections.targeting) {
      // ターゲット概要は AI生成の長文（target_summary）を優先。無ければ短いdescriptionを使う
      personaUpdates.target = (targeting.target_summary && String(targeting.target_summary).trim())
        || (targeting.target_description && String(targeting.target_description).trim())
        || null
      // 購買決定要因 → 既存の brand_personas.decision_factors（JSONB array）に連携
      if (Array.isArray(targeting.buying_factors)) {
        personaUpdates.decision_factors = targeting.buying_factors
      }
    }
    if (selections.positioning) personaUpdates.positioning_map_data = positioningMapData
    if (selections.target_fit_map && targeting.target_fit_map) {
      personaUpdates.target_fit_map_data = targeting.target_fit_map
    }
    if (selections.brand_stance_statements && sessionData.brand_stance_statements) {
      personaUpdates.brand_stance_statements = sessionData.brand_stance_statements
    }

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

    // 6. companies を更新（主なターゲット一覧＋自社の強み＋競合分析）
    // 自社の強み・競合分析は Step4「自社・競合の一覧」で入力する特徴（traits）が出所（selections.positioning で連携）
    const companyUpdates: Record<string, unknown> = {}
    if (selections.targeting) {
      const newTargetSegments = buildTargetSegments(targeting, segmentation)
      companyUpdates.target_segments = newTargetSegments.length > 0 ? newTargetSegments : null
    }
    if (selections.positioning) {
      const positioningItems = (positioning.items || []) as Array<{ name?: string; traits?: string; is_self?: boolean }>
      // 自社の強み（自社=is_self項目のtraits）
      const selfTraits = positioningItems.find((item) => item.is_self)?.traits?.trim()
      if (selfTraits) {
        companyUpdates.strengths = selfTraits
      }
      // 競合分析（[{name, traits}]）。自社（is_self）と特徴未入力の項目は除外
      const cleaned = positioningItems
        .filter((item) => !item.is_self && item.name?.trim() && item.traits?.trim())
        .map((item) => ({ name: (item.name as string).trim(), traits: (item.traits as string).trim() }))
      companyUpdates.competitors_analysis = cleaned.length > 0 ? cleaned : []
    }
    if (Object.keys(companyUpdates).length > 0) {
      const { error: companyError } = await supabaseAdmin
        .from('companies')
        .update(companyUpdates)
        .eq('id', companyId)

      if (companyError) {
        console.error('[STP Connect] companies更新エラー:', companyError)
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
