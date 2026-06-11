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
import { backingNoun, isProofLinked, isTargetBacked, resolveBackingTargets, type BackingKind } from '@/lib/brand/backing-targets'

// ---- 質問 ----

export type ProfilingQuestion =
  | {
      key: string
      type: 'unproven_promise'
      question: string
      why: string
      // 裏づけ対象（提供価値があればVP、無ければバリュー）。vp_id/vp_title は互換のため名前を維持
      target_kind: BackingKind
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
      choices: { id: string; title: string; kind: BackingKind }[] // 裏づけ対象の選択肢
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
  // 「裏づけのない約束」（warn・プロファイリング対象）の現存数
  openUnprovenCount: number
  // うち保留済み（profiling_acknowledgments に記録あり）
  acknowledgedUnprovenCount: number
  // 未解消かつ未保留（ウィザード Step5 完了判定: これが0＋ステップ1〜4充足で完了）
  uncoveredWarnCount: number
  // 裏づけ対象の総数（ハブの「裏づけ N/M」の分母）＋呼称
  backingTotal: number
  backingNoun: string
}

export async function generateProfilingQuestions(
  companyId: string,
  options?: { includeAcknowledged?: boolean }, // true: 保留済みの質問も再表示する
): Promise<ProfilingQuestionsResult> {
  if (!companyId) {
    return { questions: [], baseline: {}, openUnprovenCount: 0, acknowledgedUnprovenCount: 0, uncoveredWarnCount: 0, backingTotal: 0, backingNoun: '提供価値' }
  }
  const supabase = getSupabaseAdmin()

  const [vpR, ppR, erR, govR, philR, catalog, baselineFindings, ackR] = await Promise.all([
    supabase.from('value_propositions').select('id, title').eq('company_id', companyId).order('sort_order', { ascending: true }),
    supabase.from('proof_points').select('id, title, value_proposition_id').eq('company_id', companyId).order('sort_order', { ascending: true }),
    supabase.from('element_relations').select('id, source_kind, source_id, target_kind, target_id, relation_type, note').eq('company_id', companyId),
    supabase.from('governance_rules').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('philosophy_elements').select('id, element_type, title, body').eq('company_id', companyId).order('sort_order', { ascending: true }),
    fetchElementsCatalog(supabase, companyId),
    runIntegrityChecks(companyId), // 読み取り再利用（ベースライン件数のみ）
    supabase.from('profiling_acknowledgments').select('target_ref').eq('company_id', companyId),
  ])

  type VP = { id: string; title: string | null }
  type PP = { id: string; title: string | null; value_proposition_id: string | null }
  type ER = { id: string; source_kind: ElementKind; source_id: string; target_kind: ElementKind; target_id: string; relation_type: string; note: string | null }
  type Phil = { id: string; element_type: string; title: string | null; body: string | null }

  const vps = (vpR.data as VP[] | null) || []
  const pps = (ppR.data as PP[] | null) || []
  const ers = (erR.data as ER[] | null) || []
  const phils = (philR.data as Phil[] | null) || []
  const govCount = govR.count ?? 0

  const vpIdsWithDirectProof = new Set(pps.filter((p) => p.value_proposition_id).map((p) => p.value_proposition_id as string))

  // 裏づけ対象 = 提供価値があればVP、無ければバリュー（integrity.ts と同一基準）
  const valuePhils = phils.filter((p) => p.element_type === 'value')
  const { targets: backingTargets, mode: backingMode } = resolveBackingTargets(vps, valuePhils)
  const noun = backingNoun(backingMode)

  const labelMap = new Map(catalog.map((e) => [`${e.kind}:${e.id}`, e.label]))
  const labelOf = (kind: ElementKind, id: string) => labelMap.get(`${kind}:${id}`) ?? '不明な要素'

  // 保留済み（まだ無い/わからない）の target_ref 集合
  const ackSet = new Set((((ackR.data as { target_ref: string }[] | null) || []).map((a) => a.target_ref)))

  // 現存する「裏づけのない約束」（warn・プロファイリング対象）と保留カバレッジ
  const refOfTarget = (t: { kind: BackingKind; id: string }) => `${t.kind}:${t.id}`
  const openUnproven = backingTargets.filter((t) => !isTargetBacked(t, ers, vpIdsWithDirectProof))
  const acknowledgedUnprovenCount = openUnproven.filter((t) => ackSet.has(refOfTarget(t))).length
  const uncoveredWarnCount = openUnproven.length - acknowledgedUnprovenCount

  // warn 系（裏づけのない約束）を優先し、次いで禁則ゼロ→繋がっていない実績→矛盾の順で最大7問。
  // 保留済みはデフォルトで質問から除外（includeAcknowledged 指定時のみ再表示）
  const unproven: ProfilingQuestion[] = openUnproven
    .filter((t) => options?.includeAcknowledged || !ackSet.has(refOfTarget(t)))
    .map((t) => ({
      key: `unproven:${t.kind}:${t.id}`,
      type: 'unproven_promise' as const,
      question: `${noun}「${t.label}」を体現する実績・事実はありますか？（数字・事例・受賞など）`,
      why: '裏づけの無い約束は、AIの提案が一般論になる原因です',
      target_kind: t.kind,
      vp_id: t.id,
      vp_title: t.label,
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

  // 紐づけ先候補が無い（提供価値もバリューも0）なら orphan 質問は出さない（答えられないため）
  const orphan: ProfilingQuestion[] =
    backingTargets.length === 0
      ? []
      : pps
          .filter((pp) => !isProofLinked(pp, ers))
          .map((pp) => ({
            key: `orphan:${pp.id}`,
            type: 'orphan_proof' as const,
            question: `「${pp.title || '(無題)'}」は、どの${noun}の裏づけですか？`,
            why: 'どの約束にも繋がっていない実績は、AIがどの約束の根拠として使えるか判断できません',
            pp_id: pp.id,
            pp_title: pp.title || '(無題)',
            choices: backingTargets.map((t) => ({ id: t.id, title: t.label, kind: t.kind })),
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

  return {
    questions,
    baseline,
    openUnprovenCount: openUnproven.length,
    acknowledgedUnprovenCount,
    uncoveredWarnCount,
    backingTotal: backingTargets.length,
    backingNoun: noun,
  }
}

// ---- 回答の構造化（自由記述 → 草案。Claude 使用） ----

export type ProofDraft = {
  kind: 'proof_point'
  target_kind: BackingKind // 紐づけ先の種別（提供価値 or バリュー）
  vp_id: string // 紐づけ先の id
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
- 数値は回答の表記のまま転記する。言い換え・単位変換・桁の書き換えをしない（例: 回答が「2万個」なら草案も「2万個」と書く。「20,000個」等に変換しない）。
- title は回答の要点を30字以内で要約。description は回答の内容を1〜2文で整理（情報の追加禁止）。
- source_type は jisseki（実績）/ jirei（事例）/ data（データ）/ voice（顧客の声）/ award（受賞）から最も近いもの。判断がつかなければ "other"。
- 回答に実質的な情報が無い場合（「わからない」「特にない」「まだ無い」「なし」等のみの場合）は、JSONオブジェクトの代わりに null とだけ出力する。

出力は以下のJSONオブジェクトのみ。前後に説明文やMarkdownのコードブロックを付けないこと:
{ "title": "...", "description": "...", "source_type": "..." }`

const RULE_SYSTEM = `あなたはブランド管理者のアシスタントです。経営者の「御社が絶対に言わないこと」への回答を、ブランドの「表現ルール（禁則）」レコードの草案に構造化してください。

厳守事項（最重要）:
- 草案は回答文に含まれる情報のみで構成する。回答に無い数字・固有名詞・例を推測で補ってはならない。
- rule_text は「〜と言わない／〜という表現をしない」の形で1文に整理（情報の追加禁止）。
- 数値は回答の表記のまま転記する。言い換え・単位変換・桁の書き換えをしない。
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

// テキストから数値を「正規化された値」の集合として抽出する。
// 同一視する表記: 全角数字、桁区切りカンマ（2,000=2000）、漢数字の万・千（2万=20000・3千=3000・
// 2万5千=25000）、年号（昭和N=1925+N・平成N=1988+N・令和N=2018+N。元年=1年）。
export function extractNumberValues(input: string): Set<string> {
  let s = normalizeDigits(input || '')
  // 桁区切りカンマのみ除去（数字,3桁。列挙のカンマは残す）
  s = s.replace(/(\d),(?=\d{3}(?!\d))/g, '$1')
  const out = new Set<string>()
  // 年号 → 西暦（消費して二重抽出を防ぐ）
  s = s.replace(/(昭和|平成|令和)\s*(元|\d+)\s*年/g, (_m, era: string, n: string) => {
    const base = era === '昭和' ? 1925 : era === '平成' ? 1988 : 2018
    out.add(String(base + (n === '元' ? 1 : parseInt(n, 10))))
    return ' '
  })
  // 万・千（2万 / 3千 / 2万5千 / 1.5万）
  s = s.replace(
    /(\d+(?:\.\d+)?)万(?:(\d+(?:\.\d+)?)千)?|(\d+(?:\.\d+)?)千/g,
    (_m, man: string | undefined, manSen: string | undefined, sen: string | undefined) => {
      const v =
        man !== undefined
          ? parseFloat(man) * 10000 + (manSen !== undefined ? parseFloat(manSen) * 1000 : 0)
          : parseFloat(sen as string) * 1000
      out.add(String(v))
      return ' '
    },
  )
  // 通常の数値
  for (const m of s.match(/\d+(?:\.\d+)?/g) || []) out.add(String(parseFloat(m)))
  return out
}

// 捏造防止の照合バリデーション（純関数・ユニットテスト可能）:
// 草案テキストに含まれる数値のうち、回答文に見つからないもの（正規化後の値）を返す。
export function findUngroundedNumbers(draftTexts: string[], answer: string): string[] {
  const ans = extractNumberValues(answer)
  const missing: string[] = []
  for (const t of draftTexts) {
    for (const n of extractNumberValues(t)) {
      if (!ans.has(n) && !missing.includes(n)) missing.push(n)
    }
  }
  return missing
}


// structureAnswer の結果。draft が null のときは reason に破棄・失敗の理由（ユーザー向け日本語）が入る。
export type StructureResult = { draft: StructuredDraft | null; reason: string | null }

const ok = (draft: StructuredDraft): StructureResult => ({ draft, reason: null })
const ng = (reason: string): StructureResult => ({ draft: null, reason })

const NO_INFO_REASON =
  '回答に登録できる情報が見つかりませんでした（「わからない」「特にない」の場合は専用ボタンをご利用ください）'

const ungroundedReason = (nums: string[]): string =>
  `草案中の『${nums.join('』『')}』が回答内に見つかりませんでした。数値の表記を確認して、もう一度お試しください`

// 自由記述回答を構造化草案に変換する。対象は unproven_promise / no_governance のみ
// （選択式の orphan_proof / conflict_priority はAI不要・クライアント側で直接草案化する）。
// 草案を作れない・捏造を検出した場合は draft: null＋reason（UIは理由を表示し、何も登録しない）。
export async function structureAnswer(
  question: ProfilingQuestion,
  answerText: string,
): Promise<StructureResult> {
  const answer = (answerText || '').trim()
  if (!answer) return ng('回答が空です')

  try {
    if (question.type === 'unproven_promise') {
      const raw = await callClaude({
        system: PROOF_SYSTEM,
        userMessage: `# 質問\n${question.target_kind === 'value_proposition' ? '提供価値' : 'バリュー'}「${question.vp_title}」を体現する実績・事実はありますか？\n\n# 経営者の回答\n"""\n${answer}\n"""`,
        maxTokens: 1024,
      })
      const obj = extractJsonObject(raw)
      if (!obj) return ng(NO_INFO_REASON)
      const title = typeof obj.title === 'string' ? obj.title.trim() : ''
      const description = typeof obj.description === 'string' ? obj.description.trim() : ''
      if (!title) return ng(NO_INFO_REASON)
      const source_type = PROOF_SOURCE_TYPES.has(obj.source_type) ? (obj.source_type as string) : 'other'
      // 捏造防止: 回答に無い数値が混入した草案は破棄（理由に対象の数値を明示）
      const missing = findUngroundedNumbers([title, description], answer)
      if (missing.length > 0) {
        console.warn('[profiling] 草案に回答外の数値が混入したため破棄:', { title, description, missing })
        return ng(ungroundedReason(missing))
      }
      return ok({ kind: 'proof_point', target_kind: question.target_kind, vp_id: question.vp_id, vp_title: question.vp_title, proof: { title, description, source_type } })
    }

    if (question.type === 'no_governance') {
      const raw = await callClaude({
        system: RULE_SYSTEM,
        userMessage: `# 質問\n競合は言いそうだが、御社が絶対に言わないことはありますか？\n\n# 経営者の回答\n"""\n${answer}\n"""`,
        maxTokens: 1024,
      })
      const obj = extractJsonObject(raw)
      if (!obj) return ng(NO_INFO_REASON)
      const rule_text = typeof obj.rule_text === 'string' ? obj.rule_text.trim() : ''
      if (!rule_text) return ng(NO_INFO_REASON)
      const ng_example = typeof obj.ng_example === 'string' ? obj.ng_example.trim() : ''
      const ok_example = typeof obj.ok_example === 'string' ? obj.ok_example.trim() : ''
      const rule_type = RULE_TYPES.has(obj.rule_type) ? (obj.rule_type as string) : 'discouraged_expression'
      const severity = SEVERITIES.has(obj.severity) ? (obj.severity as string) : 'warn'
      const missing = findUngroundedNumbers([rule_text, ng_example, ok_example], answer)
      if (missing.length > 0) {
        console.warn('[profiling] 草案に回答外の数値が混入したため破棄:', { rule_text, missing })
        return ng(ungroundedReason(missing))
      }
      return ok({ kind: 'governance_rule', rule: { rule_type, rule_text, ng_example, ok_example, severity } })
    }

    return ng('この質問種別は構造化の対象外です') // 選択式はこの関数の対象外
  } catch (err) {
    console.error('[profiling] 構造化失敗:', err)
    return ng('AI呼び出しに失敗しました。時間をおいてもう一度お試しください')
  }
}
