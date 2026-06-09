// AI生成への「要素間の関係グラフ（element_relations）」注入の共通ロジック。
//
// 目的:
//   コピー・草案生成のプロンプトに、企業ごとの型付き関係（提供価値↔証拠、バリュー↔行動指針、
//   主張↔禁則、矛盾しうる組 等）を要約して渡し、要素間の整合を保った出力を促す。
//
// フォールバック方針（guardrails と同方針・重要）:
//   関係が0件・取得失敗の企業では空文字を返し、呼び出し側の従来挙動を一切変えない。
//   取得は getSupabaseAdmin()（service_role）でRLSをバイパスして確実に読む。
//
// conflictsWith は「整合性の注意点」として分離して渡し、矛盾を助長しない。
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  fetchElementsCatalog,
  KIND_LABELS,
  type ElementKind,
} from '@/lib/brand/elements-catalog'

type RelationRow = {
  source_kind: ElementKind
  source_id: string
  target_kind: ElementKind
  target_id: string
  relation_type: string
  note: string | null
}

// relation_type → 自然文（source/target ラベルを差し込む）。conflictsWith は別扱い。
const PHRASE: Record<string, (s: string, t: string) => string> = {
  guides: (s, t) => `${s} は ${t} を方向づける`,
  evidencedBy: (s, t) => `${s} は ${t} に裏づけられる`,
  promisedTo: (s, t) => `${s} は ${t} に約束されている`,
  communicatedAs: (s, t) => `${s} は ${t} として表現される`,
  constrainedBy: (s, t) => `${s} は ${t} に制約される`,
}

/**
 * companyId の関係グラフを取得→整形し、systemプロンプトへ追記する文字列を返す。
 * 0件・取得失敗なら空文字（＝注入なし＝従来挙動）。
 * 呼び出し側は guardrails と同様に
 *   const system = [SYSTEM_PROMPT, guardrails, relations].filter(Boolean).join('\n\n')
 * の形で追記する。
 */
export async function getRelationsPromptForCompany(companyId: string): Promise<string> {
  if (!companyId) return ''
  const supabase = getSupabaseAdmin()

  const [relRes, catalog] = await Promise.all([
    supabase
      .from('element_relations')
      .select('source_kind, source_id, target_kind, target_id, relation_type, note')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true }),
    fetchElementsCatalog(supabase, companyId),
  ])

  const rows: RelationRow[] = Array.isArray(relRes.data) ? (relRes.data as RelationRow[]) : []
  if (relRes.error) console.error('[relations] element_relations 取得失敗:', relRes.error)
  if (rows.length === 0) return ''

  const map = new Map(catalog.map((e) => [`${e.kind}:${e.id}`, e.label]))
  const ref = (kind: ElementKind, id: string) =>
    `${KIND_LABELS[kind]}「${map.get(`${kind}:${id}`) ?? '不明な要素'}」`

  const positive = rows.filter((r) => r.relation_type !== 'conflictsWith')
  const conflicts = rows.filter((r) => r.relation_type === 'conflictsWith')

  const sections: string[] = []

  if (positive.length > 0) {
    const lines = positive.map((r) => {
      const s = ref(r.source_kind, r.source_id)
      const t = ref(r.target_kind, r.target_id)
      const phrase = (PHRASE[r.relation_type] ?? ((a: string, b: string) => `${a} → ${b}`))(s, t)
      const note = r.note ? `（補足: ${r.note}）` : ''
      return `- ${phrase}${note}`
    })
    sections.push(
      [
        '# 要素間の関係（ブランド構造）',
        'コピー・草案生成では以下の関係の整合を保つこと。提供価値の主張は対応する証拠に紐づけ、行動指針はバリューに沿わせ、表現は禁則の制約内に収める。',
        ...lines,
      ].join('\n'),
    )
  }

  if (conflicts.length > 0) {
    const lines = conflicts.map((r) => {
      const note = r.note ? `（補足: ${r.note}）` : ''
      return `- ${ref(r.source_kind, r.source_id)} と ${ref(r.target_kind, r.target_id)} は矛盾しうる${note}`
    })
    sections.push(
      [
        '# 整合性の注意点（矛盾しうる要素）',
        '以下は矛盾しうる要素の組。両者を同時に強く打ち出す表現は避け、トーンの一貫性に注意すること。矛盾を助長してはならない。',
        ...lines,
      ].join('\n'),
    )
  }

  return sections.join('\n\n')
}
