// ブランドパーソナリティ診断 — 本体連携API（承認制）
// GET  /api/tools/personality/connect?sessionId=&userId= — 連携プレフライト（管理者判定＋既存値の有無）
// POST /api/tools/personality/connect — 選択された項目のみ書き込み
//
// 書き込み先（実装指示書 ステージ4 ＋ 仕様改定: 選択フレームワーク一本化）:
// - traits（選択フレームワーク分: aaker→aaker_scores / archetype→archetype_traits）→ brand_guidelines.traits + traits_sort
//   ※ aaker の name は dimension key から archetypes.ts の現行ラベルに正規化（旧セッションの古いラベル復活を防ぐ）
// - personality_summary → brand_guidelines.personality_summary
// - communication_style → brand_personalities（トーンと接し方を1本化）
// - 期待タグ → brand_personality_tag_mappings（UPSERT。行削除は一切しない＝計測側の語彙行を壊さない）
// - tone_rules（選択分のみ）→ governance_rules（rule_type='tone_rule', scope='global' 固定。同一rule_text重複防止）
// - アーキタイプ → brand_personalities.archetype（framework=archetype のときのみ。aaker は拒否）
// element_relations へのエッジ生成はスコープ外（実装しない）。
// POSTは全項目を冪等に設計（部分失敗後の再実行で残りが完治する）。書き込み本体は lib/tools/personality-connect。
// 既存値の上書き（traits・期待タグ・アーキタイプ）はクライアントの確認後フラグ必須（サーバー側でも強制）。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { DiagnosisResult } from '@/app/tools/personality/lib/diagnosis'
import {guardCompanyFeature, requireCallerCompany } from '@/lib/billing/guard'
import {
  buildTraits,
  saveGuidelines,
  savePersonalities,
  syncExpectedTags,
  pickToneRules,
  replaceToneRules,
} from '@/lib/tools/personality-connect'

interface SessionContext {
  session: {
    id: string
    user_id: string
    company_id: string | null
    session_data: Record<string, unknown>
  }
  adminCompanyId: string | null
  diagnosis: (DiagnosisResult & { framework_at_generation?: string }) | null
  framework: 'aaker' | 'archetype'
}

async function loadContext(sessionId: string, userId: string): Promise<SessionContext | { error: string; status: number }> {
  const supabaseAdmin = getSupabaseAdmin()

  const { data: session, error: sessionError } = await supabaseAdmin
    .from('mini_app_sessions')
    .select('id, user_id, company_id, session_data')
    .eq('id', sessionId)
    .eq('app_type', 'personality')
    .single()

  if (sessionError || !session) return { error: 'セッションが見つかりません', status: 404 }
  if (session.user_id !== userId) return { error: 'このセッションへのアクセス権がありません', status: 403 }

  // 管理者判定はサーバー側で auth_id から解決する（クライアントの company_id は信用しない）
  const { data: adminUser } = await supabaseAdmin
    .from('admin_users')
    .select('company_id')
    .eq('auth_id', userId)
    .maybeSingle()

  const sd = (session.session_data || {}) as Record<string, unknown>
  const diagnosis = (sd.diagnosis && typeof sd.diagnosis === 'object' && Array.isArray((sd.diagnosis as Record<string, unknown>).aaker_scores))
    ? (sd.diagnosis as SessionContext['diagnosis'])
    : null
  const framework = sd.framework === 'archetype' ? 'archetype' : 'aaker'

  return {
    session: session as SessionContext['session'],
    adminCompanyId: adminUser?.company_id ?? null,
    diagnosis,
    framework,
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId') || ''
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId が必要です' }, { status: 400 })
    }

    // ⚠️ userId はクエリで受け取らない。受け取ると、他人の userId を渡すだけで
    //    その人の管理者権限で連携できてしまう（loadContext の所有者照合も無意味になる）
    const scope = await requireCallerCompany()
    if (scope.error) return scope.error
    const userId = scope.authId

    const ctx = await loadContext(sessionId, userId)
    if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    if (!ctx.adminCompanyId) {
      return NextResponse.json({ isAdmin: false })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const [guidelinesRes, tagsRes, personalitiesRes] = await Promise.all([
      supabaseAdmin
        .from('brand_guidelines')
        .select('traits, personality_summary')
        .eq('company_id', ctx.adminCompanyId)
        .maybeSingle(),
      supabaseAdmin
        .from('brand_personality_tag_mappings')
        .select('tag')
        .eq('company_id', ctx.adminCompanyId)
        .eq('is_expected', true),
      supabaseAdmin
        .from('brand_personalities')
        .select('archetype')
        .eq('company_id', ctx.adminCompanyId)
        .maybeSingle(),
    ])

    const existingTraits = Array.isArray(guidelinesRes.data?.traits) ? guidelinesRes.data.traits : []

    return NextResponse.json({
      isAdmin: true,
      companyId: ctx.adminCompanyId,
      existing: {
        traitsCount: existingTraits.length,
        hasSummary: !!guidelinesRes.data?.personality_summary,
        expectedTags: (tagsRes.data || []).map(t => t.tag),
        hasArchetype: !!personalitiesRes.data?.archetype,
      },
    })
  } catch (err) {
    console.error('[PersonalityConnect GET] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { sessionId } = body as { sessionId?: string }
    const selections = (body.selections || {}) as {
      traits?: boolean
      summary?: boolean
      tone?: boolean
      tags?: boolean
      archetype?: boolean
      toneRuleIndexes?: number[]
    }
    const confirm = (body.confirm || {}) as { overwriteTraits?: boolean; replaceTags?: boolean; overwriteArchetype?: boolean }

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId が必要です' }, { status: 400 })
    }

    // ⚠️ userId はクライアントから受け取らない（GET と同じ理由）
    const scope = await requireCallerCompany()
    if (scope.error) return scope.error
    const userId = scope.authId

    const ctx = await loadContext(sessionId, userId)
    if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    if (!ctx.adminCompanyId) {
      return NextResponse.json({ error: 'ブランド情報への反映には企業アカウント（管理者）が必要です' }, { status: 403 })
    }
    if (!ctx.diagnosis) {
      return NextResponse.json({ error: '診断結果がありません。AI診断を実行してください。' }, { status: 400 })
    }

    const companyId = ctx.adminCompanyId

    // 本体連携は standard 以上
    const denied = await guardCompanyFeature(companyId, 'portalSync')
    if (denied) return denied

    const d = ctx.diagnosis
    const written: Record<string, unknown> = {}

    // 仕様改定: アーキタイプ連携は framework=archetype のときのみ許可（aaker は拒否）
    const archetypeSelected = !!selections.archetype && ctx.framework === 'archetype'
    if (selections.archetype && ctx.framework !== 'archetype') {
      return NextResponse.json(
        { error: 'アーキタイプの反映は「タイプで診断」を選んだ場合のみ可能です。' },
        { status: 400 },
      )
    }

    // --- 上書き確認チェック（部分書き込みを防ぐため、すべての書き込みより先に行う）---
    const { data: existingGuidelines } = await supabaseAdmin
      .from('brand_guidelines')
      .select('id, traits')
      .eq('company_id', companyId)
      .maybeSingle()

    if (selections.traits) {
      const existingTraits = Array.isArray(existingGuidelines?.traits) ? existingGuidelines.traits : []
      // 既存値の上書きは確認後フラグ必須（サーバー側の安全弁）
      if (existingTraits.length > 0 && !confirm.overwriteTraits) {
        return NextResponse.json({ error: '既存の特性（traits）があります。上書き確認が必要です。', needsConfirm: 'traits' }, { status: 409 })
      }
    }
    if (selections.tags) {
      const { count: expectedTagCount } = await supabaseAdmin
        .from('brand_personality_tag_mappings')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('is_expected', true)
      if ((expectedTagCount ?? 0) > 0 && !confirm.replaceTags) {
        return NextResponse.json({ error: '既存の期待タグがあります。置換確認が必要です。', needsConfirm: 'tags' }, { status: 409 })
      }
    }
    if (archetypeSelected) {
      const { data: existingPers } = await supabaseAdmin
        .from('brand_personalities')
        .select('archetype')
        .eq('company_id', companyId)
        .maybeSingle()
      if (existingPers?.archetype && !confirm.overwriteArchetype) {
        return NextResponse.json({ error: '既存のアーキタイプがあります。上書き確認が必要です。', needsConfirm: 'archetype' }, { status: 409 })
      }
    }

    // --- brand_guidelines（traits / personality_summary）---
    if (selections.traits || selections.summary) {
      const updates: Record<string, unknown> = {}
      if (selections.traits) {
        updates.traits = buildTraits(ctx.framework, d)
        updates.traits_sort = 'registered'
        written.traits = (updates.traits as unknown[]).length
      }
      if (selections.summary) {
        updates.personality_summary = d.personality_summary
        written.summary = true
      }
      await saveGuidelines(supabaseAdmin, companyId, existingGuidelines?.id, updates)
    }

    // --- brand_personalities（communication_style / archetype）---
    if (selections.tone || archetypeSelected) {
      const personalityData: Record<string, unknown> = {}
      if (selections.tone) {
        personalityData.communication_style = d.communication_style
        written.tone = true
      }
      if (archetypeSelected) {
        // diagnosis.archetype の label/copy は定義表スナップショット、description は AI企業固有文（framework 不問で常に算出済み）
        personalityData.archetype = {
          primary: d.archetype.primary,
          secondary: d.archetype.secondary,
        }
        written.archetype = true
      }
      await savePersonalities(supabaseAdmin, companyId, personalityData)
    }

    // --- brand_personality_tag_mappings（期待タグ。行は削除せず is_expected を切替）---
    if (selections.tags) {
      await syncExpectedTags(supabaseAdmin, companyId, d.expected_tags)
      written.tags = d.expected_tags.length
    }

    // --- governance_rules（tone_rules・選択分のみ。personality_diagnosis 由来の行を置換）---
    const ruleIndexes = Array.isArray(selections.toneRuleIndexes) ? selections.toneRuleIndexes : []
    const selectedRules = ruleIndexes.length > 0 ? pickToneRules(d, ruleIndexes) : []
    if (selectedRules.length > 0) {
      await replaceToneRules(supabaseAdmin, companyId, selectedRules)
      written.tone_rules = selectedRules.length
    }

    return NextResponse.json({ ok: true, written })
  } catch (err) {
    console.error('[PersonalityConnect POST] エラー:', err)
    return NextResponse.json(
      { error: `反映エラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    )
  }
}
