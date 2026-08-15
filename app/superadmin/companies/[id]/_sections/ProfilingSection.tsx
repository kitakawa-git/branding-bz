'use client'

// スーパー管理画面 企業詳細: 「ブランドプロファイリング」セクション
// - 整合性チェックの検出結果から生成された質問（/api/superadmin/profiling・決定論）に1問ずつ回答する。
// - 自由記述回答は /api/superadmin/profiling/structure（Claude）で構造化草案に変換。
//   選択式（繋がっていない実績の紐づけ・矛盾の優先順位）はAI不要でクライアント側で草案化。
// - 草案は〔承認して登録〕した時だけ DB へ書く（クライアント supabase INSERT/UPDATE。RLSが効く経路）。
//   「まだ無い」「わからない」「特にない」「どれでもない」・スキップは何も登録しない。
// - セッション末尾に整合性チェック（決定論）を再実行し、カテゴリ別件数の改善を表示する。
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { RULE_TYPES } from '@/lib/brand/rule-display'
import { Button } from '@/components/ui/button'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { Play, Check, X, Info, Sparkles, SkipForward, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import type { ProfilingQuestion, ProofDraft, RuleDraft } from '@/lib/brand/profiling'
import type { BackingKind } from '@/lib/brand/backing-targets'

type LocalDraft =
  | ProofDraft
  | RuleDraft
  // relation: 実績 → 裏づけ対象（提供価値 or バリュー）への evidencedBy 草案
  | { kind: 'relation'; target_kind: BackingKind; vp_id: string; vp_title: string; pp_id: string; pp_title: string }
  | { kind: 'conflict_note'; relation_id: string; note: string; existing_note: string | null }

const SOURCE_TYPES: { value: string; label: string }[] = [
  { value: 'jisseki', label: '実績' },
  { value: 'jirei', label: '事例' },
  { value: 'data', label: 'データ' },
  { value: 'voice', label: '顧客の声' },
  { value: 'award', label: '受賞' },
  { value: 'other', label: 'その他' },
]
const SEVERITIES: { value: string; label: string }[] = [
  { value: 'block', label: '絶対遵守' },
  { value: 'warn', label: '原則遵守' },
  { value: 'info', label: '参考' },
]

const SELECT_CLASS =
  'h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-ds-app-accent-soft focus:ring-1 focus:ring-ds-app-accent-soft'
const INPUT_CLASS =
  'h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-ds-app-accent-soft focus:ring-1 focus:ring-ds-app-accent-soft'

const CONFLICT_CHOICES: { value: 'a' | 'b' | 'case'; label: (a: string, b: string) => string }[] = [
  { value: 'a', label: (a) => `「${a}」を優先` },
  { value: 'b', label: (_, b) => `「${b}」を優先` },
  { value: 'case', label: () => '場面による' },
]

export default function ProfilingSection({
  companyId,
  onDataChanged,
  autoStart = false,
}: {
  companyId: string
  // 承認登録のたびに通知（ウィザードのステップ判定更新用・任意）
  onDataChanged?: () => void
  // true なら表示時に質問を自動生成（質問生成は決定論・AI不要のためコストゼロ。ウィザード用）
  autoStart?: boolean
}) {
  const [questions, setQuestions] = useState<ProfilingQuestion[] | null>(null)
  const [baseline, setBaseline] = useState<Record<string, number>>({})
  const [idx, setIdx] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [structuring, setStructuring] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finished, setFinished] = useState(false)
  const [afterCounts, setAfterCounts] = useState<Record<string, number> | null>(null)
  const [registeredCount, setRegisteredCount] = useState(0)
  // 保留済み（profiling_acknowledgments に記録あり）の件数。「保留した質問をもう一度見る」の表示判定
  const [pendingCount, setPendingCount] = useState(0)

  // 質問ごとの入力
  const [answerText, setAnswerText] = useState('')
  const [orphanVpId, setOrphanVpId] = useState('')
  const [conflictChoice, setConflictChoice] = useState<'' | 'a' | 'b' | 'case'>('')
  const [conflictNote, setConflictNote] = useState('')
  const [draft, setDraft] = useState<LocalDraft | null>(null)

  const token = async () => (await supabase.auth.getSession()).data.session?.access_token || ''
  const current = questions && idx < questions.length ? questions[idx] : null

  const resetPerQuestion = () => {
    setAnswerText('')
    setOrphanVpId('')
    setConflictChoice('')
    setConflictNote('')
    setDraft(null)
  }

  // includePending: true で保留済み（まだ無い/わからない）の質問も再表示する
  const generate = async (includePending = false) => {
    setGenerating(true)
    try {
      const res = await fetch(
        `/api/superadmin/profiling?companyId=${companyId}${includePending ? '&includeAcknowledged=1' : ''}`,
        { headers: { Authorization: `Bearer ${await token()}` } },
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setQuestions(json.questions as ProfilingQuestion[])
      setBaseline((json.baseline as Record<string, number>) || {})
      setPendingCount((json.acknowledgedUnprovenCount as number) || 0)
      setIdx(0)
      setFinished(false)
      setAfterCounts(null)
      setRegisteredCount(0)
      resetPerQuestion()
    } catch (err) {
      console.error('[Profiling] 質問生成エラー:', err)
      toast.error('質問の生成に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
    } finally {
      setGenerating(false)
    }
  }

  // autoStart 時は表示と同時に質問を自動生成（未生成のときのみ。再生成はボタンから）
  useEffect(() => {
    if (autoStart && questions === null && !generating) generate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, companyId])

  // セッション終了: 整合性チェック（決定論）を再実行し改善を表示
  const finish = async () => {
    setFinishing(true)
    try {
      const res = await fetch(`/api/superadmin/integrity?companyId=${companyId}`, {
        headers: { Authorization: `Bearer ${await token()}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      const counts: Record<string, number> = {}
      for (const f of (json.findings as { category: string }[]) || []) {
        counts[f.category] = (counts[f.category] || 0) + 1
      }
      setAfterCounts(counts)
    } catch (err) {
      console.error('[Profiling] 再チェックエラー:', err)
      toast.error('整合性チェックの再実行に失敗しました')
      setAfterCounts(null)
    } finally {
      setFinishing(false)
      setFinished(true)
    }
  }

  const next = async () => {
    if (questions && idx + 1 < questions.length) {
      setIdx(idx + 1)
      resetPerQuestion()
    } else {
      await finish()
    }
  }

  // 「特にない」「どれでもない」・スキップ: 何も登録せず次へ（保留記録もしない）
  const skip = async () => {
    await next()
  }

  // 「まだ無い」「わからない」: 保留として永続化（profiling_acknowledgments）して次へ。
  // 保留した質問は次回の生成でデフォルト除外され、ウィザードStep5の完了判定では
  // 「保留済みでカバーされた検出」として扱われる。実績が登録されたら保留は解除される。
  const acknowledge = async () => {
    if (current?.type === 'unproven_promise') {
      const { error } = await supabase.from('profiling_acknowledgments').upsert(
        { company_id: companyId, target_ref: `${current.target_kind}:${current.vp_id}` },
        { onConflict: 'company_id,target_ref' },
      )
      if (error) {
        console.error('[Profiling] 保留の保存エラー:', error)
        toast.error('保留の保存に失敗しました: ' + error.message)
        return // 保存できていないのに進めない（スキップしたい場合はスキップボタン）
      }
      setPendingCount((n) => n + 1)
      toast.success('保留しました（後からいつでも回答できます）')
      onDataChanged?.()
    }
    await next()
  }

  // 実績が登録された裏づけ対象の保留記録を解除（無ければ何も起きない）
  const clearAcknowledgment = async (targetRef: string) => {
    const { error } = await supabase
      .from('profiling_acknowledgments')
      .delete()
      .eq('company_id', companyId)
      .eq('target_ref', targetRef)
    if (error) console.error('[Profiling] 保留解除エラー:', error)
  }

  // 自由記述 → 構造化草案（Claude）
  const structure = async () => {
    if (!current || !answerText.trim()) {
      toast.error('回答を入力してください')
      return
    }
    setStructuring(true)
    try {
      const res = await fetch('/api/superadmin/profiling/structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ question: current, answer: answerText }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      if (!json.draft) {
        // 破棄・失敗の理由はAPIが返す（例: 草案中の『20000』が回答内に見つかりませんでした）
        toast.error(json.reason || '回答から草案を作成できませんでした。表現を変えてもう一度お試しください')
        return
      }
      setDraft(json.draft as LocalDraft)
    } catch (err) {
      console.error('[Profiling] 構造化エラー:', err)
      toast.error('構造化に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
    } finally {
      setStructuring(false)
    }
  }

  // 選択式（繋がっていない実績 → 裏づけ対象の紐づけ）: AI不要・直接関係草案
  const makeOrphanDraft = () => {
    if (!current || current.type !== 'orphan_proof') return
    const target = current.choices.find((c) => c.id === orphanVpId)
    if (!target) {
      toast.error('紐づけ先を選択してください')
      return
    }
    setDraft({ kind: 'relation', target_kind: target.kind, vp_id: target.id, vp_title: target.title, pp_id: current.pp_id, pp_title: current.pp_title })
  }

  // 選択式（矛盾の優先順位）: AI不要・既存 conflictsWith 関係の note 追記草案
  const makeConflictDraft = () => {
    if (!current || current.type !== 'conflict_priority') return
    const choice = CONFLICT_CHOICES.find((c) => c.value === conflictChoice)
    if (!choice) {
      toast.error('優先順位を選択してください')
      return
    }
    const note = `優先順位: ${choice.label(current.a_label, current.b_label)}${conflictNote.trim() ? `。${conflictNote.trim()}` : ''}`
    setDraft({ kind: 'conflict_note', relation_id: current.relation_id, note, existing_note: current.existing_note })
  }

  const nextSortOrder = async (table: string) => {
    const { data } = await supabase
      .from(table)
      .select('sort_order')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: false })
      .limit(1)
    return data && data.length > 0 ? ((data[0] as { sort_order: number }).sort_order ?? 0) + 1 : 0
  }

  // 承認して登録（ここで初めてDBに書く）
  const approve = async () => {
    if (!draft) return
    setRegistering(true)
    try {
      if (draft.kind === 'proof_point') {
        if (!draft.proof.title.trim()) throw new Error('タイトルは必須です')
        const order = await nextSortOrder('proof_points')
        const { data: inserted, error } = await supabase
          .from('proof_points')
          .insert({
            company_id: companyId,
            value_proposition_id: null,
            title: draft.proof.title.trim(),
            description: draft.proof.description.trim() || null,
            source_type: draft.proof.source_type || null,
            source_url: null,
            evidence_date: null,
            sort_order: order,
          })
          .select('id')
          .single()
        if (error) throw error
        // evidencedBy 関係草案も併せて登録（裏づけ対象 → 新しい実績）
        const relOrder = await nextSortOrder('element_relations')
        const { error: relErr } = await supabase.from('element_relations').insert({
          company_id: companyId,
          source_kind: draft.target_kind,
          source_id: draft.vp_id,
          target_kind: 'proof_point',
          target_id: (inserted as { id: string }).id,
          relation_type: 'evidencedBy',
          note: 'プロファイリング回答より',
          sort_order: relOrder,
        })
        if (relErr) throw relErr
        await clearAcknowledgment(`${draft.target_kind}:${draft.vp_id}`) // 実績が付いたので保留は解除
      } else if (draft.kind === 'governance_rule') {
        if (!draft.rule.rule_text.trim()) throw new Error('ルール本文は必須です')
        const order = await nextSortOrder('governance_rules')
        const { error } = await supabase.from('governance_rules').insert({
          company_id: companyId,
          rule_type: draft.rule.rule_type,
          scope: 'global',
          source: 'manual',
          target_value_proposition_id: null,
          rule_text: draft.rule.rule_text.trim(),
          ng_example: draft.rule.ng_example.trim() || null,
          ok_example: draft.rule.ok_example.trim() || null,
          severity: draft.rule.severity,
          sort_order: order,
        })
        if (error) throw error
      } else if (draft.kind === 'relation') {
        const order = await nextSortOrder('element_relations')
        const { error } = await supabase.from('element_relations').insert({
          company_id: companyId,
          source_kind: draft.target_kind,
          source_id: draft.vp_id,
          target_kind: 'proof_point',
          target_id: draft.pp_id,
          relation_type: 'evidencedBy',
          note: 'プロファイリング回答より',
          sort_order: order,
        })
        if (error) throw error
        await clearAcknowledgment(`${draft.target_kind}:${draft.vp_id}`) // 実績が紐づいたので保留は解除
      } else if (draft.kind === 'conflict_note') {
        const newNote = draft.existing_note ? `${draft.existing_note}\n${draft.note}` : draft.note
        const { error } = await supabase
          .from('element_relations')
          .update({ note: newNote })
          .eq('id', draft.relation_id)
        if (error) throw error
      }
      setRegisteredCount((n) => n + 1)
      toast.success('登録しました')
      onDataChanged?.()
      await next()
    } catch (err) {
      console.error('[Profiling] 登録エラー:', err)
      toast.error('登録に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
    } finally {
      setRegistering(false)
    }
  }

  // ---- 草案カード（修正可能な状態で表示） ----
  const renderDraft = () => {
    if (!draft) return null
    return (
      <div className="border border-green-200 bg-green-50/40 rounded-xl p-4 mt-3 space-y-3">
        <div className="text-xs font-bold text-green-800">構造化草案（承認するまで登録されません。内容は修正できます）</div>

        {draft.kind === 'proof_point' && (
          <>
            <p className="text-[13px] text-muted-foreground m-0">
              実績・エピソードとして登録し、{draft.target_kind === 'value_proposition' ? '提供価値' : 'バリュー'}「{draft.vp_title}」へ evidencedBy 関係を張ります
            </p>
            <div>
              <label className="text-xs font-bold text-foreground mb-1.5 block">タイトル</label>
              <input
                className={INPUT_CLASS}
                value={draft.proof.title}
                onChange={(e) => setDraft({ ...draft, proof: { ...draft.proof, title: e.target.value } })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground mb-1.5 block">説明</label>
              <AutoResizeTextarea
                value={draft.proof.description}
                onChange={(e) => setDraft({ ...draft, proof: { ...draft.proof, description: e.target.value } })}
                className="min-h-[60px]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground mb-1.5 block">出典種別</label>
              <select
                className={SELECT_CLASS}
                value={draft.proof.source_type}
                onChange={(e) => setDraft({ ...draft, proof: { ...draft.proof, source_type: e.target.value } })}
              >
                {SOURCE_TYPES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {draft.kind === 'governance_rule' && (
          <>
            <p className="text-[13px] text-muted-foreground m-0">表現ルール（禁則）として登録します</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block">種別</label>
                <select
                  className={SELECT_CLASS}
                  value={draft.rule.rule_type}
                  onChange={(e) => setDraft({ ...draft, rule: { ...draft.rule, rule_type: e.target.value } })}
                >
                  {RULE_TYPES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block">遵守レベル</label>
                <select
                  className={SELECT_CLASS}
                  value={draft.rule.severity}
                  onChange={(e) => setDraft({ ...draft, rule: { ...draft.rule, severity: e.target.value } })}
                >
                  {SEVERITIES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-foreground mb-1.5 block">ルール本文</label>
              <AutoResizeTextarea
                value={draft.rule.rule_text}
                onChange={(e) => setDraft({ ...draft, rule: { ...draft.rule, rule_text: e.target.value } })}
                className="min-h-[60px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block">NG例（任意）</label>
                <input
                  className={INPUT_CLASS}
                  value={draft.rule.ng_example}
                  onChange={(e) => setDraft({ ...draft, rule: { ...draft.rule, ng_example: e.target.value } })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block">OK例（任意）</label>
                <input
                  className={INPUT_CLASS}
                  value={draft.rule.ok_example}
                  onChange={(e) => setDraft({ ...draft, rule: { ...draft.rule, ok_example: e.target.value } })}
                />
              </div>
            </div>
          </>
        )}

        {draft.kind === 'relation' && (
          <p className="text-[13px] text-foreground m-0">
            {draft.target_kind === 'value_proposition' ? '提供価値' : 'バリュー'}「{draft.vp_title}」 —evidencedBy→ 実績「{draft.pp_title}」 の関係を登録します
          </p>
        )}

        {draft.kind === 'conflict_note' && (
          <div>
            <label className="text-xs font-bold text-foreground mb-1.5 block">矛盾関係のメモに追記する内容</label>
            <AutoResizeTextarea
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              className="min-h-[60px]"
            />
          </div>
        )}

        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={approve} disabled={registering}>
            <Check size={14} />
            {registering ? '登録中...' : '承認して登録'}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setDraft(null)} disabled={registering}>
            <X size={14} />
            破棄
          </Button>
        </div>
      </div>
    )
  }

  // ---- 質問カード ----
  const renderQuestion = () => {
    if (!current || !questions) return null
    return (
      <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 mt-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="py-0.5 px-2 bg-blue-100 text-blue-800 rounded text-[11px] font-semibold">
            質問 {idx + 1} / {questions.length}
          </span>
        </div>
        <p className="text-sm font-bold text-foreground mb-1">{current.question}</p>
        <p className="inline-flex items-center gap-1.5 text-[13px] text-blue-900 bg-blue-100/60 rounded-md px-2.5 py-1 mb-3">
          <Info size={13} className="shrink-0" />
          なぜ聞くか: {current.why}
        </p>

        {!draft && (current.type === 'unproven_promise' || current.type === 'no_governance') && (
          <>
            <AutoResizeTextarea
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder={current.type === 'unproven_promise' ? '例: 導入企業の継続率は95%です／〇〇賞を受賞しました' : '例: 効果を保証するような言い方は絶対にしない'}
              className="min-h-[72px] bg-white"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              <Button type="button" size="sm" onClick={structure} disabled={structuring}>
                <Sparkles size={14} />
                {structuring ? '構造化中...' : '回答を構造化'}
              </Button>
              {current.type === 'unproven_promise' ? (
                <>
                  <Button type="button" size="sm" variant="outline" onClick={acknowledge} disabled={structuring}>まだ無い</Button>
                  <Button type="button" size="sm" variant="outline" onClick={acknowledge} disabled={structuring}>わからない</Button>
                </>
              ) : (
                <Button type="button" size="sm" variant="outline" onClick={skip} disabled={structuring}>特にない</Button>
              )}
              <Button type="button" size="sm" variant="ghost" onClick={skip} disabled={structuring}>
                <SkipForward size={14} />
                スキップ
              </Button>
            </div>
          </>
        )}

        {!draft && current.type === 'orphan_proof' && (
          <>
            <select className={SELECT_CLASS} value={orphanVpId} onChange={(e) => setOrphanVpId(e.target.value)}>
              <option value="">
                {current.choices[0]?.kind === 'value_proposition' ? '提供価値' : 'バリュー'}を選択してください
              </option>
              {current.choices.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2 mt-2">
              <Button type="button" size="sm" onClick={makeOrphanDraft}>
                <Check size={14} />
                これに紐づける
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={skip}>どれでもない</Button>
              <Button type="button" size="sm" variant="ghost" onClick={skip}>
                <SkipForward size={14} />
                スキップ
              </Button>
            </div>
          </>
        )}

        {!draft && current.type === 'conflict_priority' && (
          <>
            <div className="space-y-1.5 mb-2">
              {CONFLICT_CHOICES.map((c) => (
                <label key={c.value} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input
                    type="radio"
                    name="conflict-choice"
                    checked={conflictChoice === c.value}
                    onChange={() => setConflictChoice(c.value)}
                  />
                  {c.label(current.a_label, current.b_label)}
                </label>
              ))}
            </div>
            <AutoResizeTextarea
              value={conflictNote}
              onChange={(e) => setConflictNote(e.target.value)}
              placeholder="補足（任意）: どんな場面でどちらを優先するか等"
              className="min-h-[60px] bg-white"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              <Button type="button" size="sm" onClick={makeConflictDraft}>
                <Check size={14} />
                草案を作成
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={skip}>
                <SkipForward size={14} />
                スキップ
              </Button>
            </div>
          </>
        )}

        {renderDraft()}
      </div>
    )
  }

  // ---- セッション終了（改善表示） ----
  const renderResult = () => {
    if (!finished) return null
    const categories = Array.from(new Set([...Object.keys(baseline), ...Object.keys(afterCounts || {})]))
    return (
      <div className="border border-green-200 bg-green-50/40 rounded-xl p-4 mt-4">
        <div className="text-xs font-bold text-green-800 mb-2">セッション完了（{registeredCount}件を登録）</div>
        {afterCounts === null ? (
          <p className="text-sm text-muted-foreground m-0">整合性チェックの再実行に失敗したため、改善の比較は表示できません</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-foreground m-0">整合性チェックの検出はゼロです。ブランド体系に綻びは見つかりませんでした</p>
        ) : (
          <div className="space-y-1">
            {categories.map((cat) => {
              const before = baseline[cat] || 0
              const after = afterCounts[cat] || 0
              const improved = after < before
              return (
                <p key={cat} className="text-sm m-0">
                  <span className="text-foreground">{cat}: </span>
                  <span className={improved ? 'font-bold text-green-700' : 'text-foreground'}>
                    {before}件 → {after}件
                  </span>
                </p>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {(questions === null || finished) && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => generate()} disabled={generating} className="py-2 px-4 text-[13px]">
            {finished ? <RotateCcw size={16} /> : <Play size={16} />}
            {generating ? '生成中...' : finished ? 'もう一度質問を生成' : '質問を生成'}
          </Button>
          {pendingCount > 0 && (
            <Button type="button" variant="outline" onClick={() => generate(true)} disabled={generating} className="py-2 px-4 text-[13px]">
              保留した質問をもう一度見る（{pendingCount}）
            </Button>
          )}
        </div>
      )}

      {/* 質問も保留も無いときは何も出さない（穴が無い旨は「オントロジー構築完了」バナーが伝えている）。
          保留があるときだけ、呼び戻すボタンとセットで案内する。 */}
      {questions !== null && questions.length === 0 && !finished && pendingCount > 0 && (
        <div className="mt-3">
          <p className="text-sm text-foreground border border-border bg-muted/40 rounded-xl p-3 mb-2">
            未回答の質問はありません（保留中 {pendingCount}件）。保留した項目は後からいつでも回答できます
          </p>
          <Button type="button" variant="outline" onClick={() => generate(true)} disabled={generating} className="py-2 px-4 text-[13px]">
            保留した質問をもう一度見る（{pendingCount}）
          </Button>
        </div>
      )}

      {!finished && renderQuestion()}
      {finishing && <p className="text-sm text-muted-foreground mt-3 mb-0">整合性チェックを再実行中...</p>}
      {renderResult()}
    </div>
  )
}
