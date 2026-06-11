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

type VP = { id: string; title: string | null; description: string | null }
type PP = { id: string; title: string | null; value_proposition_id: string | null }
type ER = { source_kind: ElementKind; source_id: string; target_kind: ElementKind; target_id: string; relation_type: string; note: string | null }
type Term = { avoided_term: string | null; preferred_term: string | null }
type BG = { slogan: string | null; brand_statement: string | null; brand_story: string | null }
type Phil = { id: string; element_type: string; title: string | null; body: string | null }

export async function runIntegrityChecks(companyId: string): Promise<IntegrityFinding[]> {
  if (!companyId) return []
  const supabase = getSupabaseAdmin()

  const [vpR, ppR, erR, termsR, bgR, philR, catalog] = await Promise.all([
    supabase.from('value_propositions').select('id, title, description').eq('company_id', companyId).order('sort_order', { ascending: true }),
    supabase.from('proof_points').select('id, title, value_proposition_id').eq('company_id', companyId).order('sort_order', { ascending: true }),
    supabase.from('element_relations').select('source_kind, source_id, target_kind, target_id, relation_type, note').eq('company_id', companyId),
    supabase.from('brand_terms').select('avoided_term, preferred_term').eq('company_id', companyId),
    supabase.from('brand_guidelines').select('slogan, brand_statement, brand_story').eq('company_id', companyId).maybeSingle(),
    supabase.from('philosophy_elements').select('id, element_type, title, body').eq('company_id', companyId),
    fetchElementsCatalog(supabase, companyId),
  ])

  const vps = (vpR.data as VP[] | null) || []
  const pps = (ppR.data as PP[] | null) || []
  const ers = (erR.data as ER[] | null) || []
  const terms = (termsR.data as Term[] | null) || []
  const bg = (bgR.data as BG | null) || null
  const phils = (philR.data as Phil[] | null) || []

  const findings: IntegrityFinding[] = []

  // 直接FK（proof_points.value_proposition_id）
  const vpIdsWithDirectProof = new Set(pps.filter((p) => p.value_proposition_id).map((p) => p.value_proposition_id as string))

  // 裏づけ対象 = 提供価値があればVP、無ければバリュー（提供価値未選定の会社への対応）。
  const valuePhils = phils.filter((p) => p.element_type === 'value')
  const { targets: backingTargets, mode: backingMode } = resolveBackingTargets(vps, valuePhils)
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
  const labelMap = new Map(catalog.map((e) => [`${e.kind}:${e.id}`, e.label]))
  const refOf = (kind: ElementKind, id: string) => labelMap.get(`${kind}:${id}`) ?? '不明な要素'
  for (const r of ers.filter((r) => r.relation_type === 'conflictsWith')) {
    const a = refOf(r.source_kind, r.source_id)
    const b = refOf(r.target_kind, r.target_id)
    findings.push({
      severity: 'info',
      category: '矛盾の明示',
      message: `「${a}」と「${b}」が矛盾関係として登録されています。同時に強く打ち出す表現は注意してください${r.note ? `（補足: ${r.note}）` : ''}`,
      refs: [
        { kind: KIND_LABELS[r.source_kind], label: a },
        { kind: KIND_LABELS[r.target_kind], label: b },
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

  // 7. 理念から辿れない要素（info）: mission（無ければ vision、どちらも無ければ value 全件）を根に、
  //    関係（向きは無視・無向）＋証拠の直接FK（proof_points.value_proposition_id）を辺として
  //    到達可能性を見る。届かない要素は「島」＝論理の根拠が未登録のサイン。
  //    - 検出対象: 理念（根自身を除く）/提供価値/実績/表現ルール。ペルソナは対象外
  //      （理念由来でなくてよい）が、経路としては通過できる。
  //    - 根が1つも無い会社（理念未登録）はチェック自体をスキップ（全要素が島になり煩雑なため）。
  //    - ラベルはカタログ由来（title が null の理念も body で表示される。幽霊エッジ誤診の教訓）。
  //    - info のためウィザード Step5 の完了判定には影響しない。
  {
    const rootPhils = (() => {
      const m = phils.filter((p) => p.element_type === 'mission')
      if (m.length > 0) return m
      const v = phils.filter((p) => p.element_type === 'vision')
      if (v.length > 0) return v
      return phils.filter((p) => p.element_type === 'value')
    })()
    if (rootPhils.length > 0) {
      const adj = new Map<string, string[]>()
      const addEdge = (a: string, b: string) => {
        if (!adj.has(a)) adj.set(a, [])
        if (!adj.has(b)) adj.set(b, [])
        adj.get(a)!.push(b)
        adj.get(b)!.push(a)
      }
      for (const r of ers) addEdge(`${r.source_kind}:${r.source_id}`, `${r.target_kind}:${r.target_id}`)
      for (const p of pps) {
        if (p.value_proposition_id) addEdge(`value_proposition:${p.value_proposition_id}`, `proof_point:${p.id}`)
      }
      const reachable = new Set<string>(rootPhils.map((p) => `philosophy_element:${p.id}`))
      const queue = [...reachable]
      for (let i = 0; i < queue.length; i++) {
        for (const nb of adj.get(queue[i]) || []) {
          if (!reachable.has(nb)) {
            reachable.add(nb)
            queue.push(nb)
          }
        }
      }
      const rootIds = new Set(rootPhils.map((p) => p.id))
      const unreachable = catalog.filter(
        (e) =>
          e.kind !== 'persona' &&
          !(e.kind === 'philosophy_element' && rootIds.has(e.id)) &&
          !reachable.has(`${e.kind}:${e.id}`),
      )
      if (unreachable.length > 0) {
        findings.push({
          severity: 'info',
          category: '理念から辿れない要素',
          message: `理念からの線が繋がっていない要素が${unreachable.length}件あります。関係性ステップでAIスキャンを再実行するか、手動で関係を追加してください`,
        })
        for (const e of unreachable) {
          findings.push({
            severity: 'info',
            category: '理念から辿れない要素',
            message: `「${e.label}」は理念からの線が繋がっていません（島になっています）`,
            refs: [{ kind: KIND_LABELS[e.kind], label: e.label }],
          })
        }
      }
    }
  }

  return findings
}
