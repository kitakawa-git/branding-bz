// ブランドプロファイリング（ステージB）: 整合性チェックの検出結果を「質問キュー」に変換し、
// 経営者の頭の中にある知識（証拠・関係・禁則）を日本語の問いで引き出す。
//
// 設計:
// - 質問生成は決定論（テンプレート変換・AI不要）。検出ロジックは integrity.ts（決定論）と
//   同一基準だが、質問には要素IDが必要なため本ファイルで再検出する（integrity.ts は変更しない）。
// - 自由記述回答の構造化（structureAnswer）のみ Claude を使う。草案は回答文に含まれる情報のみで
//   構成し、回答に無い数字の混入はコード側の照合バリデーションで破棄する（捏造防止）。
// - 本モジュールはDBへ一切書き込まない。登録は superadmin UI での人間承認後
//   （クライアント supabase INSERT/UPDATE。RLSが効く経路）。
// - 「まだ無い」「わからない」等の回答は何も登録しない（検出は残り、次回また聞ける）。
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { callClaude } from '@/lib/claude-api'
import { fetchElementsCatalog, type ElementKind } from '@/lib/brand/elements-catalog'
import { runIntegrityChecks } from '@/lib/brand/integrity'

// ---- 質問 ----

export type ProfilingQuestion =
  | {
      key: string
      type: 'unproven_promise'
      question: string
      why: string
      vp_id: string
      vp_title: string
    }
  | {
      key: string
      type: 'orphan_proof'
      question: string
      why: string
      pp_id: string
      pp_title: string
      choices: { id: string; title: string }[] // 提供価値の選択肢
    }
  | {
      key: string
      type: 'conflict_priority'
      question: string
      why: string
      relation_id: string
      a_label: string
      b_label: string
      existing_note: string | null
    }
  | {
      key: string
      type: 'no_governance'
      question: string
      why: string
    }

export const MAX_QUESTIONS_PER_SESSION = 7

export type ProfilingQuestionsResult = {
  questions: ProfilingQuestion[]
  // セッション末尾の改善表示用ベースライン（整合性チェックのカテゴリ別件数）
  baseline: Record<string, number>
}

export async function generateProfilingQuestions(
  companyId: string,
): Promise<ProfilingQuestionsResult> {
  if (!companyId) return { questions: [], baseline: {} }
  const supabase = getSupabaseAdmin()

  const [vpR, ppR, erR, govR, catalog, baselineFindings] = await Promise.all([
    supabase.from('value_propositions').select('id, title').eq('company_id', companyId).order('sort_order', { ascending: true }),
    supabase.from('proof_points').select('id, title, value_proposition_id').eq('company_id', companyId).order('sort_order', { ascending: true }),
    supabase.from('element_relations').select('id, source_kind, source_id, target_kind, target_id, relation_type, note').eq('company_id', companyId),
    supabase.from('governance_rules').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    fetchElementsCatalog(supabase, companyId),
    runIntegrityChecks(companyId), // 読み取り再利用（ベースライン件数のみ）
  ])

  type VP = { id: string; title: string | null }
  type PP = { id: string; title: string | null; value_proposition_id: string | null }
  type ER = { id: string; source_kind: ElementKind; source_id: string; target_kind: ElementKind; target_id: string; relation_type: string; note: string | null }

  const vps = (vpR.data as VP[] | null) || []
  const pps = (ppR.data as PP[] | null) || []
  const ers = (erR.data as ER[] | null) || []
  const govCount = govR.count ?? 0

  // integrity.ts と同一基準: 直接FK（proof_points.value_proposition_id）または evidencedBy 関係
  const evidencedVpIds = new Set(ers.filter((r) => r.relation_type === 'evidencedBy' && r.source_kind === 'value_proposition').map((r) => r.source_id))
  const evidencedProofIds = new Set(ers.filter((r) => r.relation_type === 'evidencedBy' && r.target_kind === 'proof_point').map((r) => r.target_id))
  const vpIdsWithDirectProof = new Set(pps.filter((p) => p.value_proposition_id).map((p) => p.value_proposition_id as string))

  const labelMap = new Map(catalog.map((e) => [`${e.kind}:${e.id}`, e.label]))
  const labelOf = (kind: ElementKind, id: string) => labelMap.get(`${kind}:${id}`) ?? '不明な要素'

  // warn 系（証拠なき約束）を優先し、次いで禁則ゼロ→孤立した証拠→矛盾の順で最大7問
  const unproven: ProfilingQuestion[] = vps
    .filter((vp) => !vpIdsWithDirectProof.has(vp.id) && !evidencedVpIds.has(vp.id))
    .map((vp) => ({
      key: `unproven:${vp.id}`,
      type: 'unproven_promise' as const,
      question: `「${vp.title || '(無題)'}」を約束していますが、それを裏づける実績・事実はありますか？（数字・事例・受賞など）`,
      why: '証拠の無い約束は、AIの提案が一般論になる原因です',
      vp_id: vp.id,
      vp_title: vp.title || '(無題)',
    }))

  const noGov: ProfilingQuestion[] =
    govCount === 0
      ? [
          {
            key: 'no_governance',
            type: 'no_governance' as const,
            question: '競合は言いそうだが、御社が絶対に言わないことはありますか？',
            why: '「言わないこと」はブランドの輪郭です。登録するとAIの生成から確実に排除されます',
          },
        ]
      : []

  const orphan: ProfilingQuestion[] = pps
    .filter((pp) => !pp.value_proposition_id && !evidencedProofIds.has(pp.id))
    .map((pp) => ({
      key: `orphan:${pp.id}`,
      type: 'orphan_proof' as const,
      question: `「${pp.title || '(無題)'}」は、どの提供価値の裏づけですか？`,
      why: '孤立した証拠は、AIがどの約束の根拠として使えるか判断できません',
      pp_id: pp.id,
      pp_title: pp.title || '(無題)',
      choices: vps.map((v) => ({ id: v.id, title: v.title || '(無題)' })),
    }))

  const conflicts: ProfilingQuestion[] = ers
    .filter((r) => r.relation_type === 'conflictsWith')
    .map((r) => ({
      key: `conflict:${r.id}`,
      type: 'conflict_priority' as const,
      question: `「${labelOf(r.source_kind, r.source_id)}」と「${labelOf(r.target_kind, r.target_id)}」はぶつかる場面がありますか？ どちらを優先しますか？`,
      why: '優先順位が決まっていると、AIの表現が場面によってブレなくなります',
      relation_id: r.id,
      a_label: labelOf(r.source_kind, r.source_id),
      b_label: labelOf(r.target_kind, r.target_id),
      existing_note: r.note,
    }))

  const questions = [...unproven, ...noGov, ...orphan, ...conflicts].slice(0, MAX_QUESTIONS_PER_SESSION)

  const baseline: Record<string, number> = {}
  for (const f of baselineFindings) baseline[f.category] = (baseline[f.category] || 0) + 1

  return { questions, baseline }
}

// ---- 回答の構造化（自由記述 → 草案。Claude 使用） ----

export type ProofDraft = {
  kind: 'proof_point'
  vp_id: string
  vp_title: string
  proof: { title: string; description: string; source_type: string }
}

export type RuleDraft = {
  kind: 'governance_rule'
  rule: { rule_type: string; rule_text: string; ng_example: string; ok_example: string; severity: string }
}

export type StructuredDraft = ProofDraft | RuleDraft

const PROOF_SOURCE_TYPES = new Set(['jisseki', 'jirei', 'data', 'voice', 'award', 'other'])
const RULE_TYPES = new Set(['banned_word', 'discouraged_expression', 'tone_rule', 'claim_rule', 'compliance_rule'])
const SEVERITIES = new Set(['block', 'warn', 'info'])

const PROOF_SYSTEM = `あなたはブランド管理者のアシスタントです。経営者の回答を、ブランドの「証拠・実績」レコードの草案に構造化してください。

厳守事項（最重要）:
- 草案は回答文に含まれる情報のみで構成する。回答に無い数字・固有名詞・実績・date を推測で補ってはならない。
- 回答が曖昧（数字なし）なら、草案も数字なしで書く。誇張・具体化をしない。
- title は回答の要点を30字以内で要約。description は回答の内容を1〜2文で整理（情報の追加禁止）。
- source_type は jisseki（実績）/ jirei（事例）/ data（データ）/ voice（顧客の声）/ award（受賞）から最も近いもの。判断がつかなければ "other"。
- 回答に実質的な情報が無い場合（「わからない」「特にない」「まだ無い」「なし」等のみの場合）は、JSONオブジェクトの代わりに null とだけ出力する。

出力は以下のJSONオブジェクトのみ。前後に説明文やMarkdownのコードブロックを付けないこと:
{ "title": "...", "description": "...", "source_type": "..." }`

const RULE_SYSTEM = `あなたはブランド管理者のアシスタントです。経営者の「御社が絶対に言わないこと」への回答を、ブランドの「表現ルール（禁則）」レコードの草案に構造化してください。

厳守事項（最重要）:
- 草案は回答文に含まれる情報のみで構成する。回答に無い数字・固有名詞・例を推測で補ってはならない。
- rule_text は「〜と言わない／〜という表現をしない」の形で1文に整理（情報の追加禁止）。
- ng_example / ok_example は回答から直接導ける場合のみ書く。導けなければ空文字 "" にする。
- rule_type は banned_word（禁止ワード）/ discouraged_expression（非推奨表現）/ tone_rule（トーン）/ claim_rule（主張）/ compliance_rule（コンプラ）から最も近いもの。
- severity は回答のニュアンスから block（絶対遵守）または warn（原則遵守）。迷ったら warn。
- 回答に実質的な情報が無い場合（「わからない」「特にない」「まだ無い」「なし」等のみの場合）は、JSONオブジェクトの代わりに null とだけ出力する。

出力は以下のJSONオブジェクトのみ。前後に説明文やMarkdownのコードブロックを付けないこと:
{ "rule_type": "...", "rule_text": "...", "ng_example": "...", "ok_example": "...", "severity": "..." }`

// Claude応答からJSONオブジェクトを抽出（Markdownコードブロック対応・失敗時は null）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractJsonObject(text: string): any | null {
  let s = (text || '').trim()
  const m = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (m) s = m[1].trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start < 0 || end < 0) return null
  try {
    const parsed = JSON.parse(s.slice(start, end + 1))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

const normalizeDigits = (s: string) =>
  (s || '').replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))

// 捏造防止の照合バリデーション（純関数・ユニットテスト可能）:
// 草案テキストに含まれる数値が、すべて回答文に実在するか。1つでも回答に無い数値があれば false。
export function draftNumbersGroundedInAnswer(draftTexts: string[], answer: string): boolean {
  const ans = normalizeDigits(answer)
  for (const t of draftTexts) {
    const nums = normalizeDigits(t).match(/\d+(?:\.\d+)?/g) || []
    for (const n of nums) {
      if (!ans.includes(n)) return false
    }
  }
  return true
}

// 自由記述回答を構造化草案に変換する。対象は unproven_promise / no_governance のみ
// （選択式の orphan_proof / conflict_priority はAI不要・クライアント側で直接草案化する）。
// 草案を作れない・捏造を検出した場合は null（UIは「破棄した」旨を表示し、何も登録しない）。
export async function structureAnswer(
  question: ProfilingQuestion,
  answerText: string,
): Promise<StructuredDraft | null> {
  const answer = (answerText || '').trim()
  if (!answer) return null

  try {
    if (question.type === 'unproven_promise') {
      const raw = await callClaude({
        system: PROOF_SYSTEM,
        userMessage: `# 質問\n提供価値「${question.vp_title}」を裏づける実績・事実はありますか？\n\n# 経営者の回答\n"""\n${answer}\n"""`,
        maxTokens: 1024,
      })
      const obj = extractJsonObject(raw)
      if (!obj) return null
      const title = typeof obj.title === 'string' ? obj.title.trim() : ''
      const description = typeof obj.description === 'string' ? obj.description.trim() : ''
      if (!title) return null
      const source_type = PROOF_SOURCE_TYPES.has(obj.source_type) ? (obj.source_type as string) : 'other'
      // 捏造防止: 回答に無い数値が混入した草案は破棄
      if (!draftNumbersGroundedInAnswer([title, description], answer)) {
        console.warn('[profiling] 草案に回答外の数値が混入したため破棄:', { title, description })
        return null
      }
      return { kind: 'proof_point', vp_id: question.vp_id, vp_title: question.vp_title, proof: { title, description, source_type } }
    }

    if (question.type === 'no_governance') {
      const raw = await callClaude({
        system: RULE_SYSTEM,
        userMessage: `# 質問\n競合は言いそうだが、御社が絶対に言わないことはありますか？\n\n# 経営者の回答\n"""\n${answer}\n"""`,
        maxTokens: 1024,
      })
      const obj = extractJsonObject(raw)
      if (!obj) return null
      const rule_text = typeof obj.rule_text === 'string' ? obj.rule_text.trim() : ''
      if (!rule_text) return null
      const ng_example = typeof obj.ng_example === 'string' ? obj.ng_example.trim() : ''
      const ok_example = typeof obj.ok_example === 'string' ? obj.ok_example.trim() : ''
      const rule_type = RULE_TYPES.has(obj.rule_type) ? (obj.rule_type as string) : 'discouraged_expression'
      const severity = SEVERITIES.has(obj.severity) ? (obj.severity as string) : 'warn'
      if (!draftNumbersGroundedInAnswer([rule_text, ng_example, ok_example], answer)) {
        console.warn('[profiling] 草案に回答外の数値が混入したため破棄:', { rule_text })
        return null
      }
      return { kind: 'governance_rule', rule: { rule_type, rule_text, ng_example, ok_example, severity } }
    }

    return null // 選択式はこの関数の対象外
  } catch (err) {
    console.error('[profiling] 構造化失敗:', err)
    return null
  }
}
