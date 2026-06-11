// ブランドパーソナリティ診断 — AI診断実行API
// POST /api/tools/personality/diagnose
// セッションの回答を正としてサーバー側で読み、1回のAI呼び出しで
// Aaker 5次元＋アーキタイプ主副＋archetype_traits＋トーン＋期待タグ＋tone_rules を一括算出する。
// 増幅層: session.company_id があれば理念体系・ペルソナ・要素間関係・表現ルールを注入（なければゼロから動く）。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { callClaude } from '@/lib/claude-api'
import { fetchPhilosophy } from '@/lib/brand/philosophy'
import { getRelationsPromptForCompany } from '@/lib/brand/relations'
import { getGuardrailsPromptForCompany } from '@/lib/brand/guardrails'
import { getMonthBoundsJst } from '@/lib/competitors/suggest'
import { PERSONALITY_DIAGNOSIS_MONTHLY_LIMIT } from '@/lib/constants/ai-limits'
import {
  buildSystemPrompt,
  buildUserMessage,
  validateAndNormalize,
} from '@/app/tools/personality/lib/diagnosis'
import { DIAGNOSIS_QUESTIONS, type DiagnosisAnswers, type FrameworkKey } from '@/app/tools/personality/lib/questions'

const FEATURE_KEY = 'personality_diagnosis'

// 増幅層の先頭セクション（文面は設計確認で承認済み・2026-06-11）
async function buildAmplificationPrompt(companyId: string): Promise<string> {
  const supabaseAdmin = getSupabaseAdmin()

  const [phil, personasRes, relationsPrompt, guardrailsPrompt] = await Promise.all([
    fetchPhilosophy(supabaseAdmin, companyId),
    supabaseAdmin
      .from('brand_personas')
      .select('name, target, description')
      .eq('company_id', companyId),
    getRelationsPromptForCompany(companyId),
    getGuardrailsPromptForCompany(companyId),
  ])

  const personas = Array.isArray(personasRes.data) ? personasRes.data : []

  const lines: string[] = []
  if (phil.mission) lines.push(`- ミッション: ${phil.mission}`)
  if (phil.vision) lines.push(`- ビジョン: ${phil.vision}`)
  const values = phil.values.filter(v => v.name)
  if (values.length > 0) {
    lines.push('- バリュー:')
    values.forEach(v => lines.push(`  - ${v.name}${v.description ? `: ${v.description}` : ''}`))
  }
  const services = phil.services.filter(s => s.title)
  if (services.length > 0) {
    lines.push('- 事業・サービス:')
    services.forEach(s => lines.push(`  - ${s.title}${s.description ? `: ${s.description}` : ''}`))
  }

  const personaLines = personas
    .filter(p => p.name)
    .map(p => `- ${p.name}${p.target ? `（${p.target}）` : ''}${p.description ? `: ${p.description}` : ''}`)

  // 本体データが何も無ければ注入なし（ゼロから動く）
  if (lines.length === 0 && personaLines.length === 0 && !relationsPrompt && !guardrailsPrompt) {
    return ''
  }

  const sections: string[] = []
  sections.push(
    [
      '# 既存ブランド定義との整合（増幅層）',
      'この企業は branding.bz に以下のブランド定義を登録済みである。診断結果はこれらと矛盾してはならない。',
      '- 人格・トーン・期待タグは、ミッション・ビジョン・バリューの方向性と整合させること',
      '- 回答から既存定義と異なる人格シグナルが読み取れる場合は、既存定義を優先し、回答のニュアンスは personality_summary と各 copy の語彙選びに反映するに留めること',
      '- tone_rules は、後述の表現ルール・禁則と重複または矛盾する内容を提案しないこと',
    ].join('\n'),
  )
  if (lines.length > 0) sections.push(['## 理念体系', ...lines].join('\n'))
  if (personaLines.length > 0) sections.push(['## ブランドペルソナ（想定顧客）', ...personaLines].join('\n'))
  if (relationsPrompt) sections.push(relationsPrompt)
  if (guardrailsPrompt) sections.push(guardrailsPrompt)

  return sections.join('\n\n')
}

function answersComplete(answers: DiagnosisAnswers): boolean {
  return DIAGNOSIS_QUESTIONS.every(q => {
    const a = answers[q.id]
    return Array.isArray(a) && a.length > 0
  })
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { sessionId, userId } = body as { sessionId?: string; userId?: string }

    if (!sessionId || !userId) {
      return NextResponse.json({ error: 'sessionId と userId が必要です' }, { status: 400 })
    }

    // セッション取得＋所有者チェック
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('mini_app_sessions')
      .select('id, user_id, company_id, session_data')
      .eq('id', sessionId)
      .eq('app_type', 'personality')
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 })
    }
    if (session.user_id !== userId) {
      return NextResponse.json({ error: 'このセッションへのアクセス権がありません' }, { status: 403 })
    }

    const sd = (session.session_data || {}) as Record<string, unknown>
    const answers = (sd.answers || {}) as DiagnosisAnswers
    const framework = (sd.framework || '') as FrameworkKey | ''
    const basicInfo = (sd.basic_info || {}) as Record<string, unknown>

    if (!framework) {
      return NextResponse.json({ error: '診断タイプが未選択です。Step 1 からやり直してください。' }, { status: 400 })
    }
    if (!answersComplete(answers)) {
      return NextResponse.json({ error: '未回答の質問があります。Step 2〜3 を完了してください。' }, { status: 400 })
    }

    // クォータ（company_id ありの場合のみ。JST月初基準・既存パターン）
    const { monthStartIso, nextMonthStartIso } = getMonthBoundsJst()
    if (session.company_id) {
      const { count, error: countError } = await supabaseAdmin
        .from('ai_feature_usage')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', session.company_id)
        .eq('feature_key', FEATURE_KEY)
        .gte('used_at', monthStartIso)

      if (countError) {
        console.error('[PersonalityDiagnose] 利用回数カウントエラー:', countError)
        return NextResponse.json({ error: '利用状況の確認に失敗しました' }, { status: 500 })
      }
      if ((count ?? 0) >= PERSONALITY_DIAGNOSIS_MONTHLY_LIMIT) {
        return NextResponse.json(
          {
            error: `今月のAI診断回数の上限（${PERSONALITY_DIAGNOSIS_MONTHLY_LIMIT}回）に達しました。`,
            resetsAt: nextMonthStartIso,
          },
          { status: 429 },
        )
      }
    }

    // プロンプト構築（増幅層は company_id がある場合のみ）
    const amplification = session.company_id
      ? await buildAmplificationPrompt(session.company_id)
      : ''
    const systemPrompt = amplification
      ? `${buildSystemPrompt(framework)}\n\n${amplification}`
      : buildSystemPrompt(framework)
    const userMessage = buildUserMessage(basicInfo, answers, framework)

    // AI呼び出し（構造不正は1回だけリトライ）
    let result: ReturnType<typeof validateAndNormalize> | null = null
    let retried = false
    for (let attempt = 1; attempt <= 2; attempt++) {
      const message = attempt === 1
        ? userMessage
        : `${userMessage}\n\n【重要】前回の出力は形式不正だった。説明文・コードフェンスを付けず、指定のJSON形式のみで出力すること。expected_tags は指定の8語以外を使わないこと。`

      let response: string
      try {
        response = await callClaude({
          system: systemPrompt,
          userMessage: message,
          maxTokens: 4096,
        })
      } catch (err) {
        console.error('[PersonalityDiagnose] Claude API エラー:', err)
        return NextResponse.json({ error: 'AI診断の実行に失敗しました。時間をおいて再度お試しください。' }, { status: 500 })
      }

      result = validateAndNormalize(response)
      if (result.ok) break
      console.warn(`[PersonalityDiagnose] 出力検証NG（attempt ${attempt}）: ${result.reason}`)
      retried = attempt === 1
    }

    if (!result || !result.ok) {
      return NextResponse.json(
        { error: 'AI診断結果の生成に失敗しました。再度お試しください。' },
        { status: 500 },
      )
    }
    // メリハリ規律等のソフト違反は警告ログのみ（承認済み方針）
    if (result.warnings.length > 0) {
      console.warn('[PersonalityDiagnose] 警告:', result.warnings.join(' / '))
    }

    const diagnosis = {
      ...result.result,
      generated_at: new Date().toISOString(),
      framework_at_generation: framework,
    }

    // セッションへ保存（JSONB部分マージ・既存パターン）
    const mergedData = { ...sd, diagnosis }
    const { error: updateError } = await supabaseAdmin
      .from('mini_app_sessions')
      .update({ session_data: mergedData })
      .eq('id', sessionId)
      .eq('app_type', 'personality')

    if (updateError) {
      console.error('[PersonalityDiagnose] 診断結果の保存エラー:', updateError)
      return NextResponse.json({ error: '診断結果の保存に失敗しました' }, { status: 500 })
    }

    // 利用ログ（company_id ありの場合のみ。INSERT失敗は致命的でないためログのみ）
    if (session.company_id) {
      const { error: insertError } = await supabaseAdmin.from('ai_feature_usage').insert({
        company_id: session.company_id,
        feature_key: FEATURE_KEY,
        metadata: { framework, retried, session_id: sessionId },
      })
      if (insertError) console.error('[PersonalityDiagnose] 利用ログINSERTエラー:', insertError)
    }

    return NextResponse.json({ diagnosis })
  } catch (err) {
    console.error('[PersonalityDiagnose] 予期しないエラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    )
  }
}
