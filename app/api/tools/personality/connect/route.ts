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
// POSTは全項目を冪等に設計（部分失敗後の再実行で残りが完治する）。
// 既存値の上書き（traits・期待タグ・アーキタイプ）はクライアントの確認後フラグ必須（サーバー側でも強制）。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { DiagnosisResult } from '@/app/tools/personality/lib/diagnosis'
import { AAKER_BY_DIMENSION, type AakerDimension } from '@/app/tools/personality/lib/archetypes'
import { guardCompanyFeature } from '@/lib/billing/guard'

// AI出力の severity（low/medium/high）→ governance_rules の既存語彙（info/warn/block）
const SEVERITY_MAP: Record<string, string> = {
  low: 'info',
  medium: 'warn',
  high: 'block',
}

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
    const userId = request.nextUrl.searchParams.get('userId') || ''
    if (!sessionId || !userId) {
      return NextResponse.json({ error: 'sessionId と userId が必要です' }, { status: 400 })
    }

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
    const { sessionId, userId } = body as { sessionId?: string; userId?: string }
    const selections = (body.selections || {}) as {
      traits?: boolean
      summary?: boolean
      tone?: boolean
      tags?: boolean
      archetype?: boolean
      toneRuleIndexes?: number[]
    }
    const confirm = (body.confirm || {}) as { overwriteTraits?: boolean; replaceTags?: boolean; overwriteArchetype?: boolean }

    if (!sessionId || !userId) {
      return NextResponse.json({ error: 'sessionId と userId が必要です' }, { status: 400 })
    }

    const ctx = await loadContext(sessionId, userId)
    if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    if (!ctx.adminCompanyId) {
      return NextResponse.json({ error: '本体連携には企業アカウント（管理者）が必要です' }, { status: 403 })
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
        { error: 'アーキタイプの連携は「タイプで診断」を選んだ場合のみ可能です。' },
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
    const needsGuidelines = selections.traits || selections.summary
    if (needsGuidelines) {
      const existing = existingGuidelines
      const updates: Record<string, unknown> = {}

      if (selections.traits) {
        if (ctx.framework === 'archetype') {
          // アーキタイプ特性: name はAI生成の特性名（dimension key を持たないためそのまま）
          updates.traits = d.archetype_traits.map((item, i) => ({
            name: item.name,
            score: item.score,
            copy: item.copy || '',
            description: item.description || '',
            added_index: i,
          }))
        } else {
          // Aaker 5次元: name はセッションのラベルスナップショットではなく
          // dimension key から archetypes.ts の現行ラベルに正規化（改名後の旧ラベル復活を防ぐ）
          updates.traits = d.aaker_scores.map((item, i) => ({
            name: AAKER_BY_DIMENSION[item.dimension as AakerDimension]?.label ?? item.label,
            score: item.score,
            copy: item.copy || '',
            description: item.description || '',
            added_index: i,
          }))
        }
        updates.traits_sort = 'registered'
        written.traits = (updates.traits as unknown[]).length
      }

      if (selections.summary) {
        updates.personality_summary = d.personality_summary
        written.summary = true
      }

      if (existing?.id) {
        const { error } = await supabaseAdmin.from('brand_guidelines').update(updates).eq('id', existing.id)
        if (error) throw new Error(`brand_guidelines 更新エラー: ${error.message}`)
      } else {
        const { error } = await supabaseAdmin.from('brand_guidelines').insert({ company_id: companyId, ...updates })
        if (error) throw new Error(`brand_guidelines 作成エラー: ${error.message}`)
      }
    }

    // --- brand_personalities（communication_style / archetype）---
    if (selections.tone || archetypeSelected) {
      const { data: existing } = await supabaseAdmin
        .from('brand_personalities')
        .select('id')
        .eq('company_id', companyId)
        .maybeSingle()

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

      if (existing?.id) {
        const { error } = await supabaseAdmin.from('brand_personalities').update(personalityData).eq('id', existing.id)
        if (error) throw new Error(`brand_personalities 更新エラー: ${error.message}`)
      } else {
        const { error } = await supabaseAdmin.from('brand_personalities').insert({ company_id: companyId, ...personalityData })
        if (error) throw new Error(`brand_personalities 作成エラー: ${error.message}`)
      }
    }

    // --- brand_personality_tag_mappings（期待タグ。行は削除せず UPSERT で is_expected を切替）---
    // 計測側（brand_micro_feedbacks）の語彙行と (company_id, tag) を共有するため、行の削除は一切しない。
    // 新セット → is_expected=true で UPSERT（既存 false 行があっても衝突せず true 化）。
    // 新セットに含まれない旧期待タグ → is_expected=false に降格（行は残す）。
    if (selections.tags) {
      const newTags = d.expected_tags

      // 1. 新セットを is_expected=true で UPSERT（行が無ければ作成、あれば true 化）
      if (newTags.length > 0) {
        const { error: upsertError } = await supabaseAdmin
          .from('brand_personality_tag_mappings')
          .upsert(
            newTags.map(tag => ({ company_id: companyId, tag, is_expected: true })),
            { onConflict: 'company_id,tag' },
          )
        if (upsertError) throw new Error(`期待タグ登録エラー: ${upsertError.message}`)
      }

      // 2. 新セットに含まれない既存の期待タグを is_expected=false に降格（削除はしない）
      const { data: currentExpected } = await supabaseAdmin
        .from('brand_personality_tag_mappings')
        .select('tag')
        .eq('company_id', companyId)
        .eq('is_expected', true)
      const toDemote = (currentExpected || []).map(r => r.tag as string).filter(t => !newTags.includes(t))
      if (toDemote.length > 0) {
        const { error: demoteError } = await supabaseAdmin
          .from('brand_personality_tag_mappings')
          .update({ is_expected: false })
          .eq('company_id', companyId)
          .in('tag', toDemote)
        if (demoteError) throw new Error(`旧期待タグ降格エラー: ${demoteError.message}`)
      }

      written.tags = newTags.length
    }

    // --- governance_rules（tone_rules・選択分のみ）---
    const ruleIndexes = Array.isArray(selections.toneRuleIndexes) ? selections.toneRuleIndexes : []
    if (ruleIndexes.length > 0) {
      const selectedRules = ruleIndexes
        .filter(i => Number.isInteger(i) && i >= 0 && i < d.tone_rules.length)
        .map(i => d.tone_rules[i])

      if (selectedRules.length > 0) {
        // 置換方式: 既存の source='personality_diagnosis' な tone_rule を全削除→新規INSERT。
        // 手動追加分（source='manual'）は保持。AI出力の rule_text が微妙に変わっても正しく置換される。
        const { error: deleteError } = await supabaseAdmin
          .from('governance_rules')
          .delete()
          .eq('company_id', companyId)
          .eq('rule_type', 'tone_rule')
          .eq('source', 'personality_diagnosis')
        if (deleteError) throw new Error(`旧 personality tone_rule 削除エラー: ${deleteError.message}`)

        // sort_order は残った手動ルールの末尾に連番
        const { data: remainingRules } = await supabaseAdmin
          .from('governance_rules')
          .select('sort_order')
          .eq('company_id', companyId)
        const maxOrder = (remainingRules || []).reduce((m, r) => Math.max(m, (r.sort_order as number) ?? 0), 0)
        const baseOrder = maxOrder + 1

        const { error } = await supabaseAdmin.from('governance_rules').insert(
          selectedRules.map((r, i) => ({
            company_id: companyId,
            rule_type: 'tone_rule',
            scope: 'global',
            source: 'personality_diagnosis',
            rule_text: r.rule_text,
            ng_example: r.ng_example,
            ok_example: r.ok_example,
            severity: SEVERITY_MAP[r.severity] ?? 'warn',
            sort_order: baseOrder + i,
          })),
        )
        if (error) throw new Error(`governance_rules 登録エラー: ${error.message}`)
        written.tone_rules = selectedRules.length
      }
    }

    return NextResponse.json({ ok: true, written })
  } catch (err) {
    console.error('[PersonalityConnect POST] エラー:', err)
    return NextResponse.json(
      { error: `連携エラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    )
  }
}
