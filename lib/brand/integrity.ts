// ブランド体系の整合性チェック（第一カット・決定論的・AI不要）。
//
// 目的: 「約束はあるが証拠がない」等の綻びを既存データから検出して可視化する。
// 読み取りのみ（修正アクションは出さない）。getSupabaseAdmin（service_role）で
// RLSをバイパスし確実に読む。データ0件なら該当findingなし（エラーにしない）。
//
// 次段（本カット外）: governance_rules の tone/claim を Claude が評価するAI判定チェック。
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { fetchElementsCatalog, KIND_LABELS, type ElementKind } from '@/lib/brand/elements-catalog'
import { backingNoun, isProofLinked, isTargetBacked, resolveBackingTargets } from '@/lib/brand/backing-targets'
// 未来設計（C案）の判定は lib/brand/future-design を再利用する（重複実装しない）
import { evaluate } from '@/lib/brand/future-design/evaluate'
import { isHumanJudgmentValid } from '@/lib/brand/future-design/human-judgment'
import { validateRule } from '@/lib/brand/future-design/rule-validator'
import { fetchAdoptedProofs, fetchCurrentHumanJudgments, fetchCurrentRuleHashes } from '@/lib/brand/future-design/fetch'
import type { AchievementRuleV1, ExecutionState } from '@/lib/brand/future-design/types'

export type IntegritySeverity = 'warn' | 'info'

export type IntegrityFinding = {
  severity: IntegritySeverity
  category: string
  message: string
  refs?: { kind: string; label: string }[]
}

const PHIL_JP: Record<string, string> = {
  mission: 'ミッション',
  vision: 'ビジョン',
  value: 'バリュー',
  action_guideline: '行動指針',
}

type VP = { id: string; title: string | null; description: string | null; lifecycle_state: string | null }
type PP = { id: string; title: string | null; value_proposition_id: string | null }
// 未来設計で kind に desired_evidence が加わるため string で受ける（§10「宙に浮いた関係」の端点解決に使用）
type ER = { source_kind: string; source_id: string; target_kind: string; target_id: string; relation_type: string; note: string | null }
type DE = {
  id: string
  title: string | null
  importance_weight: number | null
  execution_state: ExecutionState
  evidence_updated_at: string
  achievement_rule: AchievementRuleV1 | null
  verification_method: string | null
}
type MEAS = {
  proof_point_id: string
  metric_key: string | null
  metric_unit: string | null
  metric_value: number | null
  measurement_scope: string | null
}
type Term = { avoided_term: string | null; preferred_term: string | null }
type BG = { slogan: string | null; brand_statement: string | null; brand_story: string | null }
type Phil = { id: string; element_type: string; title: string | null; body: string | null }

export async function runIntegrityChecks(companyId: string): Promise<IntegrityFinding[]> {
  if (!companyId) return []
  const supabase = getSupabaseAdmin()

  const [vpR, ppR, erR, termsR, bgR, philR, catalog, deR, measR] = await Promise.all([
    supabase.from('value_propositions').select('id, title, description, lifecycle_state').eq('company_id', companyId).order('sort_order', { ascending: true }),
    supabase.from('proof_points').select('id, title, value_proposition_id').eq('company_id', companyId).order('sort_order', { ascending: true }),
    supabase.from('element_relations').select('source_kind, source_id, target_kind, target_id, relation_type, note').eq('company_id', companyId),
    supabase.from('brand_terms').select('avoided_term, preferred_term').eq('company_id', companyId),
    supabase.from('brand_guidelines').select('slogan, brand_statement, brand_story').eq('company_id', companyId).maybeSingle(),
    supabase.from('philosophy_elements').select('id, element_type, title, body').eq('company_id', companyId),
    fetchElementsCatalog(supabase, companyId),
    // 未来設計（M1〜M5）。テーブル未適用・0件でも空配列で安全に続行する。
    supabase
      .from('desired_evidence')
      .select('id, title, importance_weight, execution_state, evidence_updated_at, achievement_rule, verification_method')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('proof_point_measurements')
      .select('proof_point_id, metric_key, metric_unit, metric_value, measurement_scope')
      .eq('company_id', companyId),
  ])

  const vps = (vpR.data as VP[] | null) || []
  const pps = (ppR.data as PP[] | null) || []
  const ers = (erR.data as ER[] | null) || []
  const terms = (termsR.data as Term[] | null) || []
  const bg = (bgR.data as BG | null) || null
  const phils = (philR.data as Phil[] | null) || []
  const des = (deR.data as DE[] | null) || []
  const measurements = (measR.data as MEAS[] | null) || []

  const findings: IntegrityFinding[] = []

  // 直接FK（proof_points.value_proposition_id）
  const vpIdsWithDirectProof = new Set(pps.filter((p) => p.value_proposition_id).map((p) => p.value_proposition_id as string))

  // 裏づけ対象 = 提供価値があればVP、無ければバリュー（提供価値未選定の会社への対応）。
  const valuePhils = phils.filter((p) => p.element_type === 'value')
  // §10【変更】warn 対象は lifecycle_state='current' の提供価値に限定（target/retired は「未来の約束」等で別チェック）。
  // M4 の既定で既存VPは全て 'current'（null も current 扱い）＝既存挙動は不変。
  // ※ ウィザード完了判定は lib/brand/profiling.ts の uncoveredWarnCount 側で独立算出しており、ここの変更の影響を受けない。
  const isCurrentVp = (v: VP) => (v.lifecycle_state ?? 'current') === 'current'
  const currentVps = vps.filter(isCurrentVp)
  const { targets: backingTargets, mode: backingMode } = resolveBackingTargets(currentVps, valuePhils)
  const noun = backingNoun(backingMode)

  // 1. 裏づけのない約束（warn・旧称: 証拠なき約束）: 実績で裏づけられていない裏づけ対象
  //    ※ category 文字列はウィザードの点検サマリ（OntologyBuilderSection）と
  //      プロファイリングの改善表示が表示キーとして参照する。リネーム時は両側を同時に更新すること。
  //      （Step5完了判定は category 照合ではなく lib/brand/profiling.ts の uncoveredWarnCount を使う）
  for (const t of backingTargets) {
    if (!isTargetBacked(t, ers, vpIdsWithDirectProof)) {
      findings.push({
        severity: 'warn',
        category: '裏づけのない約束',
        message: `${noun}「${t.label}」を裏づける実績・エピソードが登録されていません`,
        refs: [{ kind: noun, label: t.label }],
      })
    }
  }

  // 2. どの約束にも繋がっていない実績（info・旧称: 孤立した証拠）: どの対象にも結びついていない実績
  for (const pp of pps) {
    if (!isProofLinked(pp, ers)) {
      findings.push({
        severity: 'info',
        category: 'どの約束にも繋がっていない実績',
        message: `実績「${pp.title || '(無題)'}」がどの${noun}にも紐づいていません`,
        refs: [{ kind: '実績・エピソード', label: pp.title || '(無題)' }],
      })
    }
  }

  // 3. 用語規定違反（info）: avoided_term が主要テキストに使われていないか走査（部分一致）。
  //    言い換え推奨の性質上、機械検出は参考情報に留める（v1.1で warn から降格）。
  const texts: { loc: string; text: string }[] = []
  if (bg?.slogan) texts.push({ loc: 'スローガン', text: bg.slogan })
  if (bg?.brand_statement) texts.push({ loc: 'メッセージ', text: bg.brand_statement })
  if (bg?.brand_story) texts.push({ loc: 'ブランドストーリー', text: bg.brand_story })
  for (const vp of vps) {
    if (vp.title) texts.push({ loc: `提供価値「${vp.title}」`, text: vp.title })
    if (vp.description) texts.push({ loc: `提供価値「${vp.title || '(無題)'}」の説明`, text: vp.description })
  }
  for (const p of phils) {
    const jp = PHIL_JP[p.element_type] || p.element_type
    if (p.title) texts.push({ loc: `理念（${jp}）`, text: p.title })
    if (p.body) texts.push({ loc: `理念（${jp}）`, text: p.body })
  }
  for (const term of terms) {
    const av = (term.avoided_term || '').trim()
    if (!av) continue
    for (const { loc, text } of texts) {
      if (text.includes(av)) {
        const rec = term.preferred_term ? `（推奨: ${term.preferred_term}）` : ''
        findings.push({
          severity: 'info',
          category: '用語規定違反',
          message: `避けたい用語「${av}」が ${loc} に使われています${rec}`,
        })
      }
    }
  }

  // 4. 矛盾の明示（info）: conflictsWith を列挙
  // §10【変更】端点解決に desired_evidence を含める（elements-catalog は5種のままなのでここで合成）
  const labelMap = new Map(catalog.map((e) => [`${e.kind}:${e.id}`, e.label]))
  for (const d of des) labelMap.set(`desired_evidence:${d.id}`, d.title || '(無題)')
  const kindLabel = (kind: string) =>
    kind === 'desired_evidence' ? '獲得目標' : (KIND_LABELS[kind as ElementKind] ?? kind)
  const refOf = (kind: string, id: string) => labelMap.get(`${kind}:${id}`) ?? '不明な要素'
  for (const r of ers.filter((r) => r.relation_type === 'conflictsWith')) {
    const a = refOf(r.source_kind, r.source_id)
    const b = refOf(r.target_kind, r.target_id)
    findings.push({
      severity: 'info',
      category: '矛盾の明示',
      message: `「${a}」と「${b}」が矛盾関係として登録されています。同時に強く打ち出す表現は注意してください${r.note ? `（補足: ${r.note}）` : ''}`,
      refs: [
        { kind: kindLabel(r.source_kind), label: a },
        { kind: kindLabel(r.target_kind), label: b },
      ],
    })
  }

  // （旧5. 証拠の鮮度チェックは撤去（2026-06-11）。evidence_date の入力経路が手動フォームのみで
  //   AI草案・プロファイリング経由はすべて null となり、ほぼ発火しない休眠チェックだったため。
  //   evidence_date カラムと手動入力欄は残置。AI推定による evidence_date 補完は
  //   捏造防止の原則（元データに無い値を作らない）に反するため不採用と判断した。）

  // 6. 宙に浮いた関係（info）: 端点が解決できない関係（削除済み要素・別company要素を指す幽霊エッジ）。
  //    削除時トリガ cleanup_element_relations_on_delete で再発しないはずだが、防御として検出を残す。
  //    info のためウィザード Step5 の完了判定（uncoveredWarnCount=裏づけのない約束ベース）には影響しない。
  for (const r of ers) {
    const srcOk = labelMap.has(`${r.source_kind}:${r.source_id}`)
    const tgtOk = labelMap.has(`${r.target_kind}:${r.target_id}`)
    if (srcOk && tgtOk) continue
    const side = !srcOk && !tgtOk ? '起点と対象' : !srcOk ? '起点' : '対象'
    const known = srcOk
      ? `起点「${refOf(r.source_kind, r.source_id)}」`
      : tgtOk
        ? `対象「${refOf(r.target_kind, r.target_id)}」`
        : ''
    findings.push({
      severity: 'info',
      category: '宙に浮いた関係',
      message: `関係（${r.relation_type}）の${side}の要素が見つかりません。削除済みの要素を指している可能性があります${known ? `（${known}）` : ''}。関係グラフから削除を推奨します`,
    })
  }

  // 7.（廃止）理念から辿れない要素の findings
  //    判定そのものは lib/brand/map-data.ts の findUnreachableFromPhilosophy に残っていて、
  //    スーパー管理の「未接続 N件」「理念に届かない N件」チップが使っている。
  //    チップは行クリックで該当ステップへ飛べる＝直す導線があるのに対し、
  //    ここの info は同じ内容を読み上げるだけで数十件を占有していたため出力をやめた。

  // 8. 誰にも約束されていないペルソナ（info）: promisedTo で結ばれていないペルソナ。
  //    ペルソナは「誰に約束するか」の軸であり、繋がっていなければオントロジー上は飾りになる。
  //    ※ 接続チップの到達可能性判定はペルソナを対象外にしている（理念由来でなくてよい）ため、
  //      この意味的な穴はここでしか検出されない。
  for (const e of catalog.filter((c) => c.kind === 'persona')) {
    const promised = ers.some(
      (r) => r.relation_type === 'promisedTo' && r.target_kind === 'persona' && r.target_id === e.id,
    )
    if (!promised) {
      findings.push({
        severity: 'info',
        category: '約束されていないペルソナ',
        message: `ペルソナ「${e.label}」に、どの提供価値・理念も約束されていません。関係性ステップでAIスキャンを実行するか、promisedTo の関係を追加してください`,
        refs: [{ kind: KIND_LABELS.persona, label: e.label }],
      })
    }
  }

  // ===== §10 未来設計（C案）の整合性チェック（すべて info・自動修正なし） =====
  // DE が0件（M1適用直後・未入力）の会社では以下すべて発火しない＝既存挙動不変。
  if (des.length > 0 || vps.some((v) => (v.lifecycle_state ?? 'current') !== 'current')) {
    const deIds = des.map((d) => d.id)
    // 判定素材は future-design の読み取りIOを再利用（重複実装しない）
    const [proofsByDe, hjByDe, ruleHashByDe] = await Promise.all([
      fetchAdoptedProofs(companyId, deIds),
      fetchCurrentHumanJudgments(companyId, deIds),
      fetchCurrentRuleHashes(companyId, deIds),
    ])
    const deById = new Map(des.map((d) => [d.id, d]))
    const measByProof = new Map<string, MEAS[]>()
    for (const m of measurements) {
      const arr = measByProof.get(m.proof_point_id) ?? []
      arr.push(m)
      measByProof.set(m.proof_point_id, arr)
    }
    const deLabel = (d: DE) => d.title || '(無題)'

    // 8'. 未来の約束に獲得計画が無い（info）: lifecycle_state='target' の提供価値に toBeEvidencedBy(DE) が無い
    const targetVps = vps.filter((v) => (v.lifecycle_state ?? 'current') === 'target')
    for (const v of targetVps) {
      const planned = ers.some(
        (r) => r.relation_type === 'toBeEvidencedBy' && r.source_kind === 'value_proposition' && r.source_id === v.id,
      )
      if (!planned) {
        findings.push({
          severity: 'info',
          category: '未来の約束に獲得計画が無い',
          message: `未来の約束「${v.title || '(無題)'}」に、裏づけを獲得する計画（獲得目標）が紐づいていません`,
          refs: [{ kind: '提供価値', label: v.title || '(無題)' }],
        })
      }
    }

    // 9'. 理想に紐づかない獲得目標（info）: requires(vision → DE) が無い
    for (const d of des) {
      const required = ers.some(
        (r) => r.relation_type === 'requires' && r.target_kind === 'desired_evidence' && r.target_id === d.id,
      )
      if (!required) {
        findings.push({
          severity: 'info',
          category: '理想に紐づかない獲得目標',
          message: `獲得目標「${deLabel(d)}」が、どの理想（ビジョン）からも必要とされていません`,
          refs: [{ kind: '獲得目標', label: deLabel(d) }],
        })
      }
    }

    // 10'. 判定条件が未設定（info）: achievement_rule が空/不正（manual 扱い）
    for (const d of des) {
      const rule = d.achievement_rule
      const empty = !rule || typeof rule !== 'object' || Object.keys(rule).length === 0
      const invalid = !empty && !validateRule(rule).ok
      if (empty || invalid) {
        findings.push({
          severity: 'info',
          category: '判定条件が未設定',
          message: `獲得目標「${deLabel(d)}」の達成条件が${empty ? '未設定です' : '不正です'}。人手による判断（manual）として扱われます`,
          refs: [{ kind: '獲得目標', label: deLabel(d) }],
        })
      }
    }

    // 11'. 立証方法の欠落（info）: verification_method も achievement_rule も無い
    for (const d of des) {
      const noMethod = !(d.verification_method || '').trim()
      const noRule = !d.achievement_rule || Object.keys(d.achievement_rule).length === 0
      if (noMethod && noRule) {
        findings.push({
          severity: 'info',
          category: '立証方法の欠落',
          message: `獲得目標「${deLabel(d)}」に、達成をどう確かめるか（立証方法・判定条件）が登録されていません`,
          refs: [{ kind: '獲得目標', label: deLabel(d) }],
        })
      }
    }

    // 自動評価（人間判断は使わず素の判定を見る。昇格レビュー待ち・判定不能の検出に使用）
    const autoEval = new Map<string, ReturnType<typeof evaluate>>()
    for (const d of des) {
      if (!d.achievement_rule) continue
      autoEval.set(
        d.id,
        evaluate(
          {
            rule: d.achievement_rule,
            importance_weight: Number(d.importance_weight ?? 1),
            execution_state: d.execution_state,
            evidence_updated_at: d.evidence_updated_at,
          },
          proofsByDe.get(d.id) ?? [],
        ),
      )
    }

    // 12'. 昇格レビュー待ち（info）: toBeEvidencedBy する全DEが met なのに VP が target/transition_candidate のまま
    for (const v of vps) {
      const state = v.lifecycle_state ?? 'current'
      if (state !== 'target' && state !== 'transition_candidate') continue
      const linkedDeIds = ers
        .filter((r) => r.relation_type === 'toBeEvidencedBy' && r.source_kind === 'value_proposition' && r.source_id === v.id)
        .map((r) => r.target_id)
        .filter((id) => deById.has(id))
      if (linkedDeIds.length === 0) continue
      const allMet = linkedDeIds.every((id) => autoEval.get(id)?.state === 'met')
      if (allMet) {
        findings.push({
          severity: 'info',
          category: '昇格レビュー待ち',
          message: `未来の約束「${v.title || '(無題)'}」が必要とする獲得目標は全て達成済みです。現在の約束（current）へ昇格するか確認してください`,
          refs: [{ kind: '提供価値', label: v.title || '(無題)' }],
        })
      }
    }

    // 13'. 単位・指標不一致の測定値／14'. 測定値なしで判定不能／15'. 対象範囲の混在（いずれも aggregate 対象）
    for (const d of des) {
      const rule = d.achievement_rule
      if (!rule || rule.type !== 'aggregate') continue
      const proofs = proofsByDe.get(d.id) ?? []
      const all = proofs.flatMap((p) => measByProof.get(p.id) ?? [])
      const matched = all.filter((m) => m.metric_key === rule.metric_key && m.metric_unit === rule.unit)
      const mismatched = all.filter((m) => m.metric_key !== rule.metric_key || m.metric_unit !== rule.unit)

      if (mismatched.length > 0) {
        findings.push({
          severity: 'info',
          category: '単位・指標不一致の測定値',
          message: `獲得目標「${deLabel(d)}」（指標 ${rule.metric_key}／単位 ${rule.unit}）を立証する実績に、指標・単位が一致しない測定値が${mismatched.length}件あります。判定の対象外になっています`,
          refs: [{ kind: '獲得目標', label: deLabel(d) }],
        })
      }

      const ev = autoEval.get(d.id)
      if (ev && ev.state === 'indeterminate' && (ev.reason_code === 'NO_MATCHING_MEASUREMENT' || ev.reason_code === 'NO_MEASURED_DATE')) {
        findings.push({
          severity: 'info',
          category: '測定値なしで判定不能',
          message: `獲得目標「${deLabel(d)}」は${ev.reason_code === 'NO_MEASURED_DATE' ? '測定日のある測定値' : '一致する測定値'}が無く、達成を判定できません（未達ではなくデータ不足）`,
          refs: [{ kind: '獲得目標', label: deLabel(d) }],
        })
      }

      const scopes = Array.from(new Set(matched.map((m) => (m.measurement_scope || '').trim()).filter(Boolean)))
      if (scopes.length > 1) {
        findings.push({
          severity: 'info',
          category: '対象範囲の混在',
          message: `獲得目標「${deLabel(d)}」の集計対象に、異なる対象範囲の測定値が混在しています（${scopes.join(' / ')}）。同じ母集団か確認してください`,
          refs: [{ kind: '獲得目標', label: deLabel(d) }],
        })
      }
    }

    // 16'. override 要再確認（info）: 現行 automatic_override が rule/データ変更で失効（§6-1）
    for (const d of des) {
      const hj = hjByDe.get(d.id)
      if (!hj || hj.source !== 'automatic_override') continue
      const valid = isHumanJudgmentValid(hj, ruleHashByDe.get(d.id) ?? null, d.evidence_updated_at)
      if (!valid) {
        findings.push({
          severity: 'info',
          category: 'override 要再確認',
          message: `獲得目標「${deLabel(d)}」の手動修正（override）は、その後に判定条件または関連データが変わったため失効しています。自動判定に戻っています。再確認してください`,
          refs: [{ kind: '獲得目標', label: deLabel(d) }],
        })
      }
    }

    // 17'. 表記揺れ疑い（info）: 同一company内で近い metric_key（接頭辞一致 or 編集距離1）
    {
      const keys = Array.from(new Set(measurements.map((m) => (m.metric_key || '').trim()).filter(Boolean))).sort()
      const near: string[] = []
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
          const a = keys[i]
          const b = keys[j]
          if (a === b) continue
          const prefix = a.startsWith(b) || b.startsWith(a)
          if (prefix || editDistanceAtMost1(a, b)) near.push(`${a} / ${b}`)
        }
      }
      for (const pair of near) {
        findings.push({
          severity: 'info',
          category: '表記揺れ疑い',
          message: `似た指標キーが混在しています（${pair}）。同じ指標なら表記を統一してください（別指標なら問題ありません）`,
        })
      }
    }
  }

  return findings
}

/** 編集距離が1以下か（表記揺れ検出の軽量判定・長さ差2以上は即false） */
function editDistanceAtMost1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  if (a === b) return false
  let i = 0
  let j = 0
  let diff = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++diff > 1) return false
    if (a.length === b.length) {
      i++
      j++
    } else if (a.length > b.length) i++
    else j++
  }
  if (i < a.length || j < b.length) diff++
  return diff <= 1
}
